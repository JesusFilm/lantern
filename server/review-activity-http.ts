import { Router, type Request } from 'express';
import type { Pool } from 'pg';
import { AccessError } from './membership.js';
import { requireFeature, type FeatureConfig } from './features.js';
import { reviewActivityStore } from './review-activity.js';

export function reviewActivityRoutes(db:Pool,requireUser:(req:Request)=>Promise<{id:string;email:string}>,features:FeatureConfig){
 const router=Router(),store=reviewActivityStore(db);
 router.get('/api/review-activity',async(req,res)=>{
  const user=await requireUser(req);requireFeature(features,'review-activity',user.email);
  res.json(await store.read(user.id));
 });
 router.post('/api/coach/focuses/:id/request-read',async(req,res)=>{
  const user=await requireUser(req);requireFeature(features,'review-activity',user.email);
  const value=req.body;
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>key!=='requestId')||typeof value.requestId!=='string'||!/^[0-9a-f-]{36}$/i.test(value.requestId))throw new AccessError(400,'Choose the displayed review request.');
  await store.acknowledge(user.id,String(req.params.id),value.requestId);res.sendStatus(204);
 });
 return router;
}
