import assert from 'node:assert/strict';
import { test } from 'node:test';
import { coachingFixture } from './coach-test-support.js';
import { resolveFeatureConfig } from './features.js';
import { removeMember } from './membership.js';

test('team updates show the latest dated snapshot for active department peers and reject untrusted scope', async () => {
  const f = await coachingFixture();
  try {
    const path='/api/weeks/2026-11-16';
    for (const role of ['member','peer','outsider']) {
      const plan=await(await f.request(role,path+'/plans','POST',{version:0,goals:[{text:role+' original goal',links:[]}]})).json();
      for (const body of [role+' first note',role+' latest note']) await f.request(role,path+'/updates','POST',{date:'2026-11-19',body,planVersion:1,goalStatuses:[{goalId:plan.plans[0].goals[0].id,status:'on-track'}]});
    }
    await f.request('peer',path+'/plans','POST',{version:1,goals:[{text:'Peer next plan',links:[]}]});
    const response=await f.request('member','/api/team-updates?date=2026-11-19');
    assert.equal(response.status,200);
    const view=await response.json();assert.equal(view.date,'2026-11-19');assert.equal(view.firstDate,'2026-11-19');
    assert.deepEqual(view.members.map((m:{id:string})=>m.id).sort(),[f.ids.member,f.ids.peer,f.ids.lead].sort());
    const peer=view.members.find((m:{id:string})=>m.id===f.ids.peer);
    assert.equal(peer.update.body,'peer latest note');assert.equal(peer.goals[0].text,'peer original goal');
    assert.equal(view.members.find((m:{id:string})=>m.id===f.ids.lead).update,null);
    assert.ok(!JSON.stringify(view).includes('outsider'));
    assert.equal((await f.request('missing','/api/team-updates?date=2026-11-19')).status,401);
    for(const query of ['date=2026-02-30','date=nope','date=2026-11-19&departmentId=forged','date=2026-11-19&userId=forged']) assert.equal((await f.request('member','/api/team-updates?'+query)).status,400);
    const prior=await(await f.request('member','/api/team-updates?date=2026-11-18')).json();assert.ok(prior.members.every((m:{update:unknown})=>m.update===null));
    await removeMember(f.admin,f.ids.peer);
    const after=await(await f.request('member','/api/team-updates?date=2026-11-19')).json();assert.ok(!after.members.some((m:{id:string})=>m.id===f.ids.peer));
    assert.equal((await f.request('peer','/api/team-updates?date=2026-11-19')).status,403);
  } finally { await f.close(); }
});

test('team updates are available with production defaults', async () => {
  const f=await coachingFixture(undefined,resolveFeatureConfig({},'production'));
  try { assert.equal((await f.request('member','/api/team-updates?date=2026-11-19')).status,200); }
  finally {await f.close();}
});
