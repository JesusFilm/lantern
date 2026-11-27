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

test('My team carries the latest update across days and weeks, sorted newest first, without future updates', async () => {
  const f=await coachingFixture();
  try {
    for(const [role,week,date,body] of [
      ['member','2026-11-09','2026-11-13','Earlier week update'],
      ['peer','2026-11-16','2026-11-18','Recent update'],
    ] as const) {
      await f.request(role,`/api/weeks/${week}/plans`,'POST',{version:0,goals:[{text:role+' saved goal',links:[]}]});
      await f.request(role,`/api/weeks/${week}/updates`,'POST',{date,body,planVersion:1,goalStatuses:[]});
    }
    const view=await(await f.request('member','/api/team-updates?date=2026-11-19')).json();
    assert.deepEqual(view.members.map((m:{name:string})=>m.name),['peer','member','lead']);
    assert.equal(view.members[0].update.body,'Recent update');
    assert.equal(view.members[1].update.body,'Earlier week update');
    assert.equal(view.members[1].goals[0].text,'member saved goal');
    assert.equal(view.members[2].update,null);
    const prior=await(await f.request('member','/api/team-updates?date=2026-11-17')).json();
    assert.equal(prior.members.find((m:{name:string})=>m.name==='peer').update,null);
    assert.equal(prior.members[0].update.body,'Earlier week update');
    const token=await(await f.request('member','/api/team-api-tokens','POST',{name:'TV contract check'})).json();
    const tv=await(await fetch(f.origin+'/api/v1/team-updates?date=2026-11-19',{headers:{Authorization:'Bearer '+token.token}})).json() as import('../shared/weekly.js').TeamDay;
    assert.ok(tv.members.every(member=>member.update===null));
  } finally {await f.close();}
});

test('team updates are available with production defaults', async () => {
  const f=await coachingFixture(undefined,resolveFeatureConfig({},'production'));
  try { assert.equal((await f.request('member','/api/team-updates?date=2026-11-19')).status,200); }
  finally {await f.close();}
});

test('weekly team cards use the newest save even when retrying an earlier day', async () => {
  const f=await coachingFixture();
  try {
    const path='/api/weeks/2026-11-23';
    for(const role of ['member','peer'] as const) await f.request(role,path+'/plans','POST',{version:0,goals:[{text:role+' goal',links:[]}]});
    for(const [role,date,body] of [
      ['member','2026-11-27','Friday update'],
      ['peer','2026-11-27','Peer update'],
      ['member','2026-11-26','Retried Thursday update'],
    ] as const) assert.equal((await f.request(role,path+'/updates','POST',{date,body,planVersion:1,goalStatuses:[]})).status,201);
    const view=await(await f.request('member','/api/team-updates?week=2026-11-23')).json();
    assert.deepEqual(view.members.map((member:{name:string})=>member.name),['member','peer','lead']);
    assert.equal(view.members[0].update.body,'Retried Thursday update');
    assert.equal(view.members[0].update.date,'2026-11-26');
  } finally {await f.close();}
});


test('My team reads weekly summaries with each member’s latest update and validates week scope', async () => {
  const f=await coachingFixture();
  try {
    const path='/api/weeks/2026-11-23';
    const saved=await(await f.request('peer',path+'/plans','POST',{version:0,goals:[{text:'Ship the weekly summary',links:[]}]})).json();
    await f.request('member','/api/weeks/2026-11-09/plans','POST',{version:0,goals:[{text:'Earlier planning week',links:[]}]});
    for(const [date,body,status] of [['2026-11-23','Starting the summary','on-track'],['2026-11-27','Summary is ready','done']] as const)
      await f.request('peer',path+'/updates','POST',{date,body,planVersion:1,goalStatuses:[{goalId:saved.plans[0].goals[0].id,status}]});
    const response=await f.request('member','/api/team-updates?week=2026-11-23');assert.equal(response.status,200);
    const view=await response.json();assert.equal(view.week,'2026-11-23');assert.equal(view.firstWeek,'2026-11-09');
    assert.equal(view.members[0].update.body,'Summary is ready');assert.equal(view.members[0].update.goalStatuses[0].status,'done');
    assert.ok(!JSON.stringify(view).includes('Starting the summary'));
    const next=await(await f.request('member','/api/team-updates?week=2026-11-30')).json();
    assert.ok(next.members.every((member:{update:unknown})=>member.update===null));
    const earlier=await(await f.request('member','/api/team-updates?week=2026-11-09')).json();
    assert.equal(earlier.members.find((member:{id:string})=>member.id===f.ids.member).goals[0].text,'Earlier planning week');
    assert.deepEqual(view.members.map((m:{id:string})=>m.id).sort(),[f.ids.member,f.ids.peer,f.ids.lead].sort());
    assert.equal((await f.request('outsider','/api/team-updates?week=2026-11-23')).status,200);
    const outside=await(await f.request('outsider','/api/team-updates?week=2026-11-23')).json();assert.deepEqual(outside.members.map((m:{id:string})=>m.id),[f.ids.outsider]);
    for(const query of ['week=2026-11-24','week=2026-02-30','week=nope','week=2026-11-23&date=2026-11-27','week=2026-11-23&departmentId=forged'])assert.equal((await f.request('member','/api/team-updates?'+query)).status,400);
    assert.equal((await f.request('missing','/api/team-updates?week=2026-11-23')).status,401);
  } finally {await f.close();}
});
