import { Router } from 'express';
import {createHash} from 'node:crypto';
import { requireFeature } from './features.js';
import type { FeatureConfig } from './features.js';
import type { Request } from 'express';
import type { Pool } from 'pg';
import { AccessError, membership } from './membership.js';
import { progressStore } from './progress.js';

export type ProgressDiagnostic={event:'progress-save';operationId:string;phase:'committed'|'fenced'|'rejected'|'failed'|'response-received'|'response-error'|'fetch-failed'|'fetch-timeout'|'response-invalid'|'client-error'|'view-gone'|'state-update-scheduled'|'recovery-checked';httpStatus?:number};
const validOperation=(value:unknown):value is string=>typeof value==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export function progressRoutes(db: Pool, requireUser: (req: Request) => Promise<{id:string;email:string}>, features: FeatureConfig, log:(event:ProgressDiagnostic)=>void = event=>console.info(JSON.stringify(event))) {
  const router=Router(), store=progressStore(db);
  const emit=(event:ProgressDiagnostic)=>{try {log({...event,operationId:createHash('sha256').update(event.operationId).digest('hex')})} catch { /* Diagnostics must never change the result of a save. */ }};
  router.get('/api/focuses/:id/progress', async (req,res)=>{
    const user=await requireUser(req); requireFeature(features,'focus-progress',user.email);
    res.json(await store.read(user.id,String(req.params.id)));
  });
  router.get('/api/department/members/:memberId/focuses/:id/progress', async (req,res)=>{
    const user=await requireUser(req); requireFeature(features,'focus-progress',user.email);
    res.json(await store.read(user.id,String(req.params.id),String(req.params.memberId)));
  });
  router.post('/api/progress-diagnostics',async (req,res)=>{
    const user=await requireUser(req);requireFeature(features,'focus-progress',user.email);
    if(!await membership(db,user.id))throw new AccessError(403,'Active department membership is required.');
    const value=req.body;
    if(!value || typeof value!=='object' || Array.isArray(value) || Object.keys(value).some(k=>!['operationId','phase','httpStatus'].includes(k)) || !validOperation(value.operationId) || !['response-received','response-error','fetch-failed','fetch-timeout','response-invalid','client-error','view-gone','state-update-scheduled','recovery-checked'].includes(value.phase) || (value.httpStatus!==undefined && (value.phase!=='response-error' || !Number.isInteger(value.httpStatus) || value.httpStatus<400 || value.httpStatus>599)))throw new AccessError(400,'Invalid progress diagnostic.');
    emit({event:'progress-save',operationId:value.operationId,phase:value.phase,...(value.httpStatus===undefined?{}:{httpStatus:value.httpStatus})});res.sendStatus(204);
  });
  router.post('/api/focuses/:id/progress-fence',async (req,res)=>{
    const user=await requireUser(req);requireFeature(features,'focus-progress',user.email);const value=req.body;
    const validRevision=(revision:unknown)=>revision===null || validOperation(revision);
    if(!value || typeof value!=='object' || Array.isArray(value) || Object.keys(value).some(k=>!['section','goal','revision','noteRevision'].includes(k)) || !Number.isSafeInteger(value.section) || value.section<0 || (value.goal!==null && (!Number.isSafeInteger(value.goal)||value.goal<0)) || !validRevision(value.revision) || !validRevision(value.noteRevision))throw new AccessError(400,'Choose an objective or goal and valid progress revisions.');
    const operationId=req.get('X-Lantern-Progress-Operation');
    try {
      const result=await store.fenceEntry(user.id,String(req.params.id),value.section,value.goal,value.revision,value.noteRevision);
      if(validOperation(operationId))emit({event:'progress-save',operationId,phase:'fenced'});
      res.json(result);
    } catch(error) {
      if(validOperation(operationId))emit({event:'progress-save',operationId,phase:error instanceof AccessError?'rejected':'failed',...(error instanceof AccessError?{httpStatus:error.status}:{})});
      throw error;
    }
  });
  router.put('/api/focuses/:id/progress-entry', async (req,res)=>{
    const user=await requireUser(req); requireFeature(features,'focus-progress',user.email); const value=req.body;
    const validRevision=(revision:unknown)=>revision===null || typeof revision==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(revision);
    if (!value || typeof value!=='object' || Array.isArray(value) || Object.keys(value).some(k=>!['section','goal','status','body','revision','noteRevision'].includes(k)) || !Number.isSafeInteger(value.section) || value.section<0 || (value.goal!==null && (!Number.isSafeInteger(value.goal)||value.goal<0)) || ![null,'in-progress','achieved','needs-attention'].includes(value.status) || typeof value.body!=='string' || value.body.length>4000 || !validRevision(value.revision) || !validRevision(value.noteRevision)) throw new AccessError(400,'Choose an objective or goal, a valid status, and a note of up to 4000 characters.');
    const operationId=req.get('X-Lantern-Progress-Operation');
    try {
      const result=await store.saveEntry(user.id,String(req.params.id),value.section,value.goal,value.status,value.body.trim(),value.revision,value.noteRevision);
      if(validOperation(operationId))emit({event:'progress-save',operationId,phase:'committed'});
      res.json(result);
    } catch(error) {
      if(validOperation(operationId))emit({event:'progress-save',operationId,phase:error instanceof AccessError?'rejected':'failed',...(error instanceof AccessError?{httpStatus:error.status}:{})});
      throw error;
    }
  });
  return router;
}
