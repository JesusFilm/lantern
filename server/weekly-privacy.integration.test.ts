import assert from 'node:assert/strict';
import {test} from 'node:test';
import {coachingFixture} from './coach-test-support.js';
import {resolveFeatureConfig} from './features.js';

test('weekly visibility filters goals, links and statuses for peers, leads and TV, including older daily snapshots',async t=>{
 const f=await coachingFixture();t.after(()=>f.close());const path='/api/weeks/2026-11-23';
 const goals=['team','lead','private'].map(visibility=>({text:visibility+' goal',description:visibility+' secret description',visibility,links:[{kind:'other',label:visibility+' secret link',url:'https://example.test/'+visibility}]}));
 const saved=await f.request('member',path+'/plans','POST',{version:0,goals});assert.equal(saved.status,201);
 const plan=(await saved.json()).plans[0];
 assert.equal((await f.request('member',path+'/updates','POST',{date:'2026-11-23',body:'A team-visible daily update',planVersion:1,goalStatuses:plan.goals.map((g:{id:string})=>({goalId:g.id,status:'done'}))})).status,201);
 const day='/api/team-updates?date=2026-11-23';
 const view=async(actor:string)=>(await(await f.request(actor,day)).json()).members.find((m:{id:string})=>m.id===f.ids.member);
 assert.equal((await view('member')).goals.length,3);
 assert.equal((await view('lead')).goals.length,2);
 const peer=await view('peer');assert.equal(peer.goals.length,1);assert.equal(peer.update.goalStatuses.length,1);assert.equal(peer.update.body,'A team-visible daily update');assert.equal(peer.goals[0].description,'team secret description');assert.ok(!JSON.stringify(peer).includes('private'));assert.ok(!JSON.stringify(peer).includes('lead secret'));
 const token=await(await f.request('lead','/api/team-api-tokens','POST',{name:'TV'})).json();
 const tv=await(await fetch(f.origin+'/api/v1/team-updates?date=2026-11-23',{headers:{Authorization:'Bearer '+token.token}})).json() as import('../shared/weekly.js').TeamDay;
 assert.equal(tv.members.find((m:{id:string})=>m.id===f.ids.member)!.goals.length,1);
 const changed=plan.goals.map((g:{id:string;text:string;visibility:string;links:unknown[]})=>({id:g.id,text:g.text,visibility:'private',links:g.links}));
 assert.equal((await f.request('member',path+'/plans','POST',{version:1,goals:changed})).status,201);
 assert.deepEqual((await view('peer')).goals,[]);assert.deepEqual((await view('peer')).update.goalStatuses,[]);
 assert.deepEqual((await view('lead')).goals,[]);
 assert.equal((await(await f.request('member',path)).json()).plans[0].goals.length,3);
 assert.equal((await f.request('member',path+'/plans','POST',{version:2,goals:[{text:'Invalid',visibility:'everybody',links:[]}]})).status,400);
});

test('hidden privacy choices reject new visibility changes while preserving saved private data',async t=>{
 const f=await coachingFixture(undefined,resolveFeatureConfig({LANTERN_FEATURES:'weekly-goal-privacy=off'},'local'));t.after(()=>f.close());
 assert.equal((await f.request('member','/api/weeks/2026-11-23/plans','POST',{version:0,goals:[{text:'Hidden',visibility:'private',links:[]}]})).status,404);
});
