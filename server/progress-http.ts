import { Router } from 'express';
import { requireFeature } from './features.js';
import type { FeatureConfig } from './features.js';
import type { Request } from 'express';
import type { Pool } from 'pg';
import { AccessError } from './membership.js';
import { progressStore } from './progress.js';

export function progressRoutes(db: Pool, requireUser: (req: Request) => Promise<{id:string;email:string}>, features: FeatureConfig) {
  const router=Router(), store=progressStore(db);
  router.get('/api/focuses/:id/progress', async (req,res)=>{
    const user=await requireUser(req); requireFeature(features,'focus-progress',user.email);
    res.json(await store.read(user.id,String(req.params.id)));
  });
  router.get('/api/department/members/:memberId/focuses/:id/progress', async (req,res)=>{
    const user=await requireUser(req); requireFeature(features,'focus-progress',user.email);
    res.json(await store.read(user.id,String(req.params.id),String(req.params.memberId)));
  });
  router.put('/api/focuses/:id/progress-entry', async (req,res)=>{
    const user=await requireUser(req); requireFeature(features,'focus-progress',user.email); const value=req.body;
    const validRevision=(revision:unknown)=>revision===null || typeof revision==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(revision);
    if (!value || typeof value!=='object' || Array.isArray(value) || Object.keys(value).some(k=>!['section','goal','status','body','revision','noteRevision'].includes(k)) || !Number.isSafeInteger(value.section) || value.section<0 || (value.goal!==null && (!Number.isSafeInteger(value.goal)||value.goal<0)) || ![null,'in-progress','achieved','needs-attention'].includes(value.status) || typeof value.body!=='string' || value.body.length>4000 || !validRevision(value.revision) || !validRevision(value.noteRevision)) throw new AccessError(400,'Choose an objective or goal, a valid status, and a note of up to 4000 characters.');
    res.json(await store.saveEntry(user.id,String(req.params.id),value.section,value.goal,value.status,value.body.trim(),value.revision,value.noteRevision));
  });
  return router;
}
