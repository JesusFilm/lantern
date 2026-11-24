import assert from 'node:assert/strict';
import { test } from 'node:test';
import { coachingFixture, draft } from './coach-test-support.js';
import { resolveFeatureConfig } from './features.js';

test('lead review activity counts unopened requests and other authors notes with persistent scoped acknowledgements', async t => {
 const f=await coachingFixture();t.after(()=>f.close());
 const focus=await(await f.request('member','/api/focuses','POST',draft)).json();
 const path='/api/coach/focuses/'+focus.id;
 const request=await(await f.request('member',path+'/request','POST',{version:focus.version})).json();
 const activity=async()=>{const r=await f.request('lead','/api/review-activity');assert.equal(r.status,200);return r.json()};
 assert.equal((await activity()).items.length,1);
 assert.equal((await f.request('peer','/api/review-activity')).status,403);
 assert.equal((await f.request('outsider','/api/review-activity')).status,403);
 assert.equal((await f.request('lead',path+'/request-read','POST',{requestId:'00000000-0000-4000-8000-000000000000'})).status,400);
 assert.equal((await f.request('lead',path+'/request-read','POST',{requestId:request.requests[0].id})).status,204);
 assert.deepEqual((await activity()).items,[]);
 const noteRecord=await(await f.request('member',path+'/notes','POST',{version:focus.version,body:'Please check this'})).json();
 assert.equal((await activity()).items.length,1);
 const note=noteRecord.notes.at(-1);
 assert.equal((await f.request('lead',path+'/read','POST',{noteIds:[note.id]})).status,200);
 assert.deepEqual((await activity()).items,[]);
 assert.equal((await f.request('lead',path+'/notes','POST',{version:focus.version,body:'My own reply'})).status,200);
 assert.deepEqual((await activity()).items,[]);
 assert.equal((await f.request('lead',path+'/request-read','POST',{requestId:request.requests[0].id})).status,204);
});

test('hidden review activity exposes neither reads nor counts',async t=>{
 const f=await coachingFixture(undefined,resolveFeatureConfig({LANTERN_FEATURES:'review-activity=off'},'local'));t.after(()=>f.close());
 assert.equal((await f.request('lead','/api/review-activity')).status,404);
 assert.equal((await f.request('lead','/api/coach/focuses/missing/request-read','POST',{requestId:'x'})).status,404);
});
