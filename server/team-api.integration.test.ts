import assert from 'node:assert/strict';
import type {TeamDay} from '../shared/weekly.js';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import sharp from 'sharp';
import {test} from 'node:test';
import {coachingFixture} from './coach-test-support.js';
import {removeMember} from './membership.js';
import {resolveFeatureConfig} from './features.js';

test('team API tokens persist only a digest and provide revocable, read-only department access',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'lantern-team-api-'));
 const picture=await sharp({create:{width:2,height:2,channels:3,background:'#456789'}}).png().toBuffer();
 const f=await coachingFixture(undefined,undefined,{githubAvatars:{directory,fetch:async()=>new Response(picture)}});
 try {
  const path='/api/team-api-tokens';
  assert.equal((await f.request('missing',path,'POST',{name:'TV'})).status,401);
  assert.equal((await f.request('member',path,'POST',{name:'TV',departmentId:f.ids.outsider})).status,400);
  for(const name of ['', 'x'.repeat(81)])assert.equal((await f.request('member',path,'POST',{name})).status,400);
  const created=await f.request('member',path,'POST',{name:'Office TV'});assert.equal(created.status,201);
  const token=await created.json();assert.match(token.token,/^lantern_tv_[A-Za-z0-9_-]{43}$/);
  const stored=await f.admin.query('SELECT * FROM team_api_tokens WHERE id=$1',[token.id]);assert.ok(stored.rows[0].token_hash);assert.ok(!JSON.stringify(stored.rows).includes(token.token));
  const listed=await(await f.request('member',path)).json();assert.equal(listed.tokens.length,1);assert.ok(!JSON.stringify(listed).includes(token.token));assert.ok(!JSON.stringify(listed).includes('token_hash'));
  assert.equal((await(await f.request('outsider',path)).json()).tokens.length,0);
  const get=(authorization?:string,query='date=2026-11-19')=>fetch(f.origin+'/api/v1/team-updates?'+query,{headers:authorization?{Authorization:authorization}:{}});
  assert.equal((await get()).status,401);assert.equal((await get('Bearer invalid')).status,401);
  assert.equal((await f.request('member','/api/v1/team-updates?date=2026-11-19')).status,401);
  const response=await get('Bearer '+token.token);assert.equal(response.status,200);const team=await response.json() as TeamDay;assert.equal(team.members.length,3);assert.ok(!team.members.some((member:{id:string})=>member.id===f.ids.outsider));
  assert.equal((await get('Bearer '+token.token,'date=2026-11-19&departmentId=forged')).status,400);
  await f.request('peer','/api/integrations/github/profile','PATCH',{username:'octocat'});
  const avatar=await fetch(f.origin+'/api/v1/github-avatars/octocat',{headers:{Authorization:'Bearer '+token.token}});assert.equal(avatar.status,200);assert.equal(avatar.headers.get('content-type'),'image/webp');
  assert.equal((await f.request('member','/api/v1/github-avatars/octocat')).status,401);
  assert.equal((await fetch(f.origin+'/api/v1/github-avatars/not-in-team',{headers:{Authorization:'Bearer '+token.token}})).status,404);
  assert.equal((await fetch(f.origin+'/api/account',{method:'PATCH',headers:{Origin:f.origin,Authorization:'Bearer '+token.token,'Content-Type':'application/json'},body:JSON.stringify({name:'Forged'})})).status,401);
  assert.equal((await f.request('outsider',path+'/'+token.id,'DELETE')).status,404);
  assert.equal((await f.request('member',path+'/'+token.id,'DELETE')).status,204);assert.equal((await get('Bearer '+token.token)).status,401);
  const expired=await(await f.request('member',path,'POST',{name:'Expired'})).json();await f.admin.query("UPDATE team_api_tokens SET expires_at=now()-interval '1 second' WHERE id=$1",[expired.id]);assert.equal((await get('Bearer '+expired.token)).status,401);
  const ended=await(await f.request('peer',path,'POST',{name:'Former member'})).json();await removeMember(f.admin,f.ids.peer);assert.equal((await get('Bearer '+ended.token)).status,401);
  const transferred=await(await f.request('lead',path,'POST',{name:'Transferred'})).json();
  await f.admin.query('UPDATE memberships SET department_id=(SELECT department_id FROM memberships WHERE user_id=$1) WHERE user_id=$2',[f.ids.outsider,f.ids.lead]);assert.equal((await get('Bearer '+transferred.token)).status,401);
  const unapproved=await(await f.request('member',path,'POST',{name:'Unapproved'})).json();await f.admin.query("DELETE FROM approved_emails WHERE email='member@example.test'");assert.equal((await get('Bearer '+unapproved.token)).status,401);
 }finally{await f.close();await rm(directory,{recursive:true,force:true});}
});

test('hidden team API refuses token creation and bearer reads',async()=>{
 const f=await coachingFixture(undefined,resolveFeatureConfig({LANTERN_FEATURES:'team-api=off'},'local'));
 try{assert.equal((await f.request('member','/api/team-api-tokens','POST',{name:'TV'})).status,404);assert.equal((await f.request('member','/api/v1/team-updates?date=2026-11-19')).status,404);}finally{await f.close();}
});

test('explicit local access supports the configured synthetic identity without weakening membership checks',async()=>{
 const f=await coachingFixture(undefined,undefined,{localAccess:true});
 try{
  await f.admin.query("DELETE FROM approved_emails WHERE email='member@example.test'");
  const created=await f.request('missing','/api/team-api-tokens','POST',{name:'Local TV'});assert.equal(created.status,201);const token=await created.json();
  const read=()=>fetch(f.origin+'/api/v1/team-updates?date=2026-11-19',{headers:{Authorization:'Bearer '+token.token}});
  assert.equal((await read()).status,200);await removeMember(f.admin,f.ids.member);assert.equal((await read()).status,401);
 }finally{await f.close();}
});
