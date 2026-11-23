import { Router, type Request } from 'express';
import type { Pool } from 'pg';
import { AccessError, membership } from './membership.js';
import { githubAvatarCache, type AvatarOptions } from './github-avatars.js';

export function githubAvatarRoutes(db:Pool,requireUser:(req:Request)=>Promise<{id:string;email:string;departmentId?:string}>,options?:AvatarOptions,path='/api/github-avatars/:username') {
  const router=Router(),cache=githubAvatarCache(options);
  router.get(path,async(req,res)=>{
    res.set('Cache-Control','private, no-store');
    const user=await requireUser(req);
    const department=await membership(db,user.id);
    if(!department || (user.departmentId && department.id!==user.departmentId))throw new AccessError(403,'Active department membership is required.');
    const username=String(req.params.username).toLowerCase();
    if(Object.keys(req.query).length || username.includes('--') || !/^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/.test(username))throw new AccessError(400,'Choose a valid GitHub username.');
    const member=await db.query(`SELECT 1 FROM users u JOIN memberships m ON m.user_id=u.id WHERE m.department_id=$1 AND m.deleted_at IS NULL AND lower(u.github_username)=$2 LIMIT 1`,[department.id,username]);
    if(!member.rowCount)throw new AccessError(404,'Team avatar not found.');
    try {const image=await cache.get(username);res.set('X-Content-Type-Options','nosniff');res.type('webp').send(image);}
    catch {throw new AccessError(502,'This profile picture is temporarily unavailable.');}
  });
  return router;
}
