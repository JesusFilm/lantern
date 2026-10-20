import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import {test} from 'node:test';
import {privilegeFixture} from './privilege-test-support.js';
import {migrate} from './schema.js';
import {createApp} from './app.js';
import {hash} from './access.js';
import type {PositionFocus} from '../shared/focus.js';

const draft = {title:'Agreed annual focus',start:'2026-01-01',end:'2026-12-31',sections:[
  {kind:'normal',objective:'Support onboarding',goals:['Publish a guide by June']},
]};
async function fixture() {
  const f = await privilegeFixture();
  const server = createServer();
  try {
    await migrate(f.migration,f.roles);
    const lead=randomUUID(), member=randomUUID(), peer=randomUUID(), outsider=randomUUID();
    const team=randomUUID(), otherTeam=randomUUID();
    for(const id of [team,otherTeam]) await f.admin.query("INSERT INTO departments(id,name) VALUES($1,'Team')",[id]);
    for(const [id,name,role,department] of [[lead,'Lead','career-lead',team],[member,'Member','member',team],[peer,'Peer','member',team],[outsider,'Other lead','career-lead',otherTeam]]) {
      await f.admin.query("INSERT INTO users(id,google_sub,email,name) VALUES($1::uuid,$1::text,$2,$3)",[id,`${id}@example.test`,name]);
      await f.admin.query('INSERT INTO approved_emails VALUES($1)',[`${id}@example.test`]);
      await f.admin.query('INSERT INTO memberships VALUES($1,$2,$3,NULL)',[id,department,role]);
      await f.admin.query("INSERT INTO sessions VALUES($1,$2,now()+interval '1 day')",[hash(id!),id]);
    }
    await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
    const address=server.address(); assert.ok(address && typeof address!=='string');
    const origin=`http://127.0.0.1:${address.port}`;
    server.on('request',createApp(f.runtime,{origin}));
    const request=(actor:string,path:string,method='GET',body?:unknown)=>fetch(origin+path,{method,headers:{Cookie:`lantern-session=${actor}`,Origin:origin,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
    const create=async(actor=member,content=draft)=>{
      const response=await request(actor,'/api/focuses','POST',content); assert.equal(response.status,201);
      return await response.json() as PositionFocus;
    };
    const confirm=(id:string,version:number,actor:string=lead,owner:string=member)=>request(actor,`/api/department/members/${owner}/focuses/${id}/confirm`,'POST',{version});
    return {...f,server,origin,request,create,confirm,lead,member,peer,outsider,team,otherTeam,async close(){server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));await f.close();}};
  } catch(error) {server.closeAllConnections();server.close();await f.close();throw error;}
}

test('lead confirms an agreed focus; both views persist the baseline and owner updates are locked',async()=>{
  const f=await fixture();
  try {
    const focus=await f.create();
    assert.equal(focus.status,'draft');
    assert.equal(focus.confirmedAt,null);
    assert.equal(focus.confirmedBy,null);
    const response=await f.confirm(focus.id,focus.version);
    assert.equal(response.status,200);
    const confirmed=await response.json() as PositionFocus;
    assert.equal(confirmed.status,'confirmed');
    assert.equal(confirmed.version,2);
    assert.deepEqual(confirmed.confirmedBy,{id:f.lead,name:'Lead'});
    assert.ok(Number.isFinite(Date.parse(confirmed.confirmedAt!)));
    assert.deepEqual(confirmed.sections,draft.sections);
    assert.deepEqual(await (await f.request(f.member,`/api/focuses/${focus.id}`)).json(),confirmed);
    const leadView=await (await f.request(f.lead,`/api/department/members/${f.member}/focuses/${focus.id}`)).json() as {focus:PositionFocus};
    assert.deepEqual(leadView.focus,confirmed);
    const edit=await f.request(f.member,`/api/focuses/${focus.id}`,'PUT',{...draft,title:'Changed after agreement',version:confirmed.version});
    assert.equal(edit.status,409);
    assert.match((await edit.json() as {error:string}).error,/confirmed.*read.only/i);
    assert.deepEqual(await (await f.request(f.member,`/api/focuses/${focus.id}`)).json(),confirmed);
  } finally {await f.close();}
});

test('partial drafts stay editable and confirmation validates the saved focus and exact request',async()=>{
  const f=await fixture();
  try {
    for(const sections of [[],[{kind:'normal',objective:'Partial objective',goals:[]}],[{kind:'leadership',objective:'Optional objective',goals:['A goal']} ]]) {
      const focus=await f.create(f.member,{...draft,sections});
      assert.equal((await f.confirm(focus.id,focus.version)).status,400);
      assert.deepEqual(await (await f.request(f.member,`/api/focuses/${focus.id}`)).json(),focus);
      assert.equal((await f.request(f.member,`/api/focuses/${focus.id}`,'PUT',{...draft,version:focus.version})).status,200);
    }
    const focus=await f.create();
    for(const body of [null,{},[],{version:0},{version:'1'},{version:1.5},{version:1,role:'career-lead'},{version:1,confirmedBy:f.outsider},{version:1,status:'confirmed'}]) {
      const response=await f.request(f.lead,`/api/department/members/${f.member}/focuses/${focus.id}/confirm`,'POST',body);
      assert.equal(response.status,400,JSON.stringify(body));
    }
    assert.deepEqual(await (await f.request(f.member,`/api/focuses/${focus.id}`)).json(),focus);
  } finally {await f.close();}
});

test('duplicate confirmation preserves original metadata and concurrent save/confirm has one winner',async()=>{
  const f=await fixture();
  try {
    const focus=await f.create();
    const confirmed=await (await f.confirm(focus.id,1)).json() as PositionFocus;
    const duplicate=await f.confirm(focus.id,confirmed.version);
    assert.equal(duplicate.status,200);
    assert.deepEqual(await duplicate.json(),confirmed);
    assert.equal((await f.confirm(focus.id,1)).status,409);
    for(let run=0;run<4;run++) {
      const racing=await f.create();
      const [save,confirm]=await Promise.all([
        f.request(f.member,`/api/focuses/${racing.id}`,'PUT',{...draft,title:'Newer draft',version:1}),
        f.confirm(racing.id,1),
      ]);
      assert.deepEqual([save.status,confirm.status].sort(),[200,409]);
      const current=await (await f.request(f.member,`/api/focuses/${racing.id}`)).json() as PositionFocus;
      assert.equal(current.version,2);
      assert.equal(current.title,save.status===200?'Newer draft':draft.title);
      assert.equal(current.status,confirm.status===200?'confirmed':'draft');
      if(save.status===200) assert.equal((await f.confirm(racing.id,2)).status,200);
      const baseline=await (await f.request(f.member,`/api/focuses/${racing.id}`)).json() as PositionFocus;
      for(const patch of [{title:'Changed'}, {start:'2026-02-01'}, {end:'2026-11-01'}, {sections:[]}, {sections:[{kind:'normal',objective:'Changed objective',goals:['Changed goal']}]}]) {
        const rejected=await f.request(f.member,`/api/focuses/${racing.id}`,'PUT',{...draft,...patch,version:baseline.version});
        assert.equal(rejected.status,409);
      }
      assert.deepEqual(await (await f.request(f.member,`/api/focuses/${racing.id}`)).json(),baseline);
    }
  } finally {await f.close();}
});

test('confirmation requires the active lead and same-team current member; denial and storage failure preserve drafts',async()=>{
  const f=await fixture();
  try {
    const focus=await f.create();
    for(const [actor,status] of [['',401],[f.member,403],[f.peer,403],[f.outsider,404]] as const)
      assert.equal((await f.confirm(focus.id,1,actor)).status,status);
    for(const owner of [f.peer,'unknown']) assert.equal((await f.confirm(focus.id,1,f.lead,owner)).status,404);
    assert.equal((await f.confirm('unknown',1)).status,404);
    await f.admin.query('UPDATE memberships SET deleted_at=now() WHERE user_id=$1',[f.member]);
    assert.equal((await f.confirm(focus.id,1)).status,404);
    await f.admin.query('UPDATE memberships SET deleted_at=NULL WHERE user_id=$1',[f.member]);
    await f.admin.query("UPDATE memberships SET role='member' WHERE user_id=$1",[f.lead]);
    assert.equal((await f.confirm(focus.id,1)).status,403);
    await f.admin.query("UPDATE memberships SET role='career-lead' WHERE user_id=$1",[f.lead]);
    await f.admin.query('DELETE FROM approved_emails WHERE email=$1',[`${f.lead}@example.test`]);
    assert.equal((await f.confirm(focus.id,1)).status,401);
    await f.admin.query('INSERT INTO approved_emails VALUES($1)',[`${f.lead}@example.test`]);
    // Force the write (after validation and row locking) to fail, not just the read.
    await f.migration.query(`ALTER TABLE position_focuses ADD CONSTRAINT synthetic_write_failure CHECK (status <> 'confirmed')`);
    const failed=await f.confirm(focus.id,1);
    assert.equal(failed.status,503);
    assert.deepEqual(await failed.json(),{error:'The service is temporarily unavailable. Please try again.'});
    await f.migration.query('ALTER TABLE position_focuses DROP CONSTRAINT synthetic_write_failure');
    assert.deepEqual(await (await f.request(f.member,`/api/focuses/${focus.id}`)).json(),focus);
    assert.equal((await f.confirm(focus.id,1)).status,200);
    const own=await f.create(f.lead);
    assert.equal((await f.confirm(own.id,1,f.lead,f.lead)).status,200);
    const locked=await (await f.request(f.lead,`/api/focuses/${own.id}`)).json() as PositionFocus;
    assert.equal((await f.request(f.lead,`/api/focuses/${own.id}`,'PUT',{...draft,version:locked.version})).status,409);
  } finally {await f.close();}
});

test('migration upgrades existing drafts without data loss and confirmed state survives a fresh app instance',async()=>{
  const f=await fixture();
  try {
    const existing=await f.create();
    // Reconstruct the deployed schema-3 shape around real synthetic document data.
    await f.migration.query('ALTER TABLE position_focuses DROP COLUMN status, DROP COLUMN confirmed_at, DROP COLUMN confirmed_by');
    await f.migration.query('DELETE FROM schema_migrations WHERE version=4');
    const healthServer=createServer(createApp(f.runtime,{origin:f.origin},{revision:'test'}));
    await new Promise<void>(r=>healthServer.listen(0,'127.0.0.1',r));
    const address=healthServer.address();assert.ok(address && typeof address!=='string');
    const health=`http://127.0.0.1:${address.port}/health`;
    try {
      assert.equal((await fetch(health)).status,503);
      await migrate(f.migration,f.roles);
      const ready=await fetch(health);assert.equal(ready.status,200);assert.equal(ready.headers.get('x-lantern-schema'),'6');
    } finally {healthServer.closeAllConnections();await new Promise<void>(r=>healthServer.close(()=>r()));}
    assert.deepEqual(await (await f.request(f.member,`/api/focuses/${existing.id}`)).json(),existing);
    const confirmed=await (await f.confirm(existing.id,1)).json();
    await migrate(f.migration,f.roles);
    f.server.removeAllListeners('request');
    f.server.on('request',createApp(f.runtime,{origin:f.origin}));
    assert.deepEqual(await (await f.request(f.member,`/api/focuses/${existing.id}`)).json(),confirmed);
    assert.equal((await f.request(f.member,`/api/focuses/${existing.id}`,'PUT',{...draft,version:2})).status,409);
  } finally {await f.close();}
});
