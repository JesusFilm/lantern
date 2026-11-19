import {Router,type Request,type Response,type NextFunction} from 'express';
import type {Pool} from 'pg';
import {AccessError} from './membership.js';
import {requireFeature,type FeatureConfig} from './features.js';
import {teamAPITokenStore} from './team-api-tokens.js';
import {teamWeeklyRoutes} from './team-weekly-http.js';
import {githubAvatarRoutes} from './github-avatar-http.js';
import type {AvatarOptions} from './github-avatars.js';

export function teamAPIRoutes(db:Pool,requireUser:(req:Request)=>Promise<{id:string;email:string}>,features:FeatureConfig,avatars?:AvatarOptions,localUserId?:string){
 const router=Router(),tokens=teamAPITokenStore(db,localUserId);
 async function manager(req:Request){
  const user=await requireUser(req);requireFeature(features,'team-api',user.email);requireFeature(features,'team-updates',user.email);return user;
 }
 router.get('/api/team-api-tokens',async(req,res)=>{const user=await manager(req);res.json({tokens:await tokens.list(user.id)});});
 router.post('/api/team-api-tokens',async(req,res)=>{
  const user=await manager(req);
  if(!req.body||Array.isArray(req.body)||Object.keys(req.body).some(key=>key!=='name')||typeof req.body.name!=='string')throw new AccessError(400,'Supply only a name for this token.');
  res.status(201).json(await tokens.create(user.id,req.body.name));
 });
 router.delete('/api/team-api-tokens/:id',async(req,res)=>{
  const user=await manager(req),id=String(req.params.id);
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw new AccessError(400,'Choose a valid token.');
  await tokens.revoke(user.id,id);res.sendStatus(204);
 });
 async function bearer(req:Request){
  if(features.states.get('team-api')==='off')throw new AccessError(404,'Not found.');
  const match=/^Bearer (\S+)$/i.exec(req.headers.authorization??'');
  if(!match)throw new AccessError(401,'A team API bearer token is required.');
  const user=await tokens.authenticate(match[1]!);requireFeature(features,'team-api',user.email);return user;
 }
 router.use(teamWeeklyRoutes(db,bearer,features,'/api/v1/team-updates'));
 router.use(githubAvatarRoutes(db,bearer,features,avatars,'/api/v1/github-avatars/:username'));
 router.use('/api/v1',(error:unknown,_req:Request,res:Response,next:NextFunction)=>{
  if(error instanceof AccessError && error.status===401)res.set('WWW-Authenticate','Bearer realm="Lantern team API"');
  next(error);
 });
 return router;
}
