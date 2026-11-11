import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import {test} from 'node:test';
import {privilegeFixture} from './privilege-test-support.js';
import {migrate} from './schema.js';
import {createApp} from './app.js';
import {hash} from './access.js';
import {resolveFeatureConfig} from './features.js';
import type {PositionFocus} from '../shared/focus.js';

const draft = {title:'Agreed annual focus',start:'2026-01-01',end:'2026-12-31',sections:[
  {kind:'normal',objective:'Support onboarding',goals:['Publish a guide by June']},
]};
async function fixture(feature = 'on') {
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
    server.on('request',createApp(f.runtime,{origin,features:resolveFeatureConfig({LANTERN_FEATURES:`focus-progress=${feature}`,LANTERN_PREVIEW_EMAILS:feature==='preview'?`${member}@example.test`:undefined},'production')}));
    const request=(actor:string,path:string,method='GET',body?:unknown)=>fetch(origin+path,{method,headers:{Cookie:`lantern-session=${actor}`,Origin:origin,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
    const create=async(actor=member,content=draft)=>{
      const response=await request(actor,'/api/focuses','POST',content); assert.equal(response.status,201);
      return await response.json() as PositionFocus;
    };
    const confirm=(id:string,version:number,actor:string=lead,owner:string=member)=>request(actor,`/api/department/members/${owner}/focuses/${id}/confirm`,'POST',{version});
    return {...f,server,origin,request,create,confirm,lead,member,peer,outsider,team,otherTeam,async close(){server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));await f.close();}};
  } catch(error) {server.closeAllConnections();server.close();await f.close();throw error;}
}

test('hidden focus progress denies all progress routes while the confirmed focus remains readable',async()=>{
  const f=await fixture('off');
  try {
    const focus=await f.create();assert.equal((await f.confirm(focus.id,focus.version)).status,200);
    assert.equal((await f.request(f.member,`/api/focuses/${focus.id}`)).status,200);
    assert.equal((await f.request(f.member,`/api/focuses/${focus.id}/progress`)).status,404);
    assert.equal((await f.request(f.lead,`/api/department/members/${f.member}/focuses/${focus.id}/progress`)).status,404);
    assert.equal((await f.request(f.member,`/api/focuses/${focus.id}/progress-entry`,'PUT',{section:0,goal:null,status:'achieved',body:'hello',revision:null,noteRevision:null})).status,404);
  } finally {await f.close();}
});

test('progress preview is limited to the server-resolved allowed account',async()=>{
  const f=await fixture('preview');
  try {
    const focus=await f.create();assert.equal((await f.confirm(focus.id,focus.version)).status,200);
    assert.equal((await f.request(f.member,`/api/focuses/${focus.id}/progress`)).status,200);
    assert.equal((await f.request(f.lead,`/api/department/members/${f.member}/focuses/${focus.id}/progress`)).status,404);
    assert.equal((await f.request(f.peer,`/api/focuses/${focus.id}/progress`)).status,404);
  } finally {await f.close();}
});

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
      const ready=await fetch(health);assert.equal(ready.status,200);assert.equal(ready.headers.get('x-lantern-schema'),'10');
    } finally {healthServer.closeAllConnections();await new Promise<void>(r=>healthServer.close(()=>r()));}
    assert.deepEqual(await (await f.request(f.member,`/api/focuses/${existing.id}`)).json(),existing);
    const confirmed=await (await f.confirm(existing.id,1)).json();
    await migrate(f.migration,f.roles);
    f.server.removeAllListeners('request');
    f.server.on('request',createApp(f.runtime,{origin:f.origin,features:resolveFeatureConfig({},'local')}));
    assert.deepEqual(await (await f.request(f.member,`/api/focuses/${existing.id}`)).json(),confirmed);
    assert.equal((await f.request(f.member,`/api/focuses/${existing.id}`,'PUT',{...draft,version:2})).status,409);
  } finally {await f.close();}
});

test('a member records progress for a confirmed goal and can read it after reload', async () => {
  const f=await fixture();
  try {
    const focus=await f.create();
    assert.equal((await f.confirm(focus.id,focus.version)).status,200);
    const path=`/api/focuses/${focus.id}/progress`;
    const entryPath=`/api/focuses/${focus.id}/progress-entry`;
    assert.equal((await f.request(f.member,entryPath,'PUT',{section:0,goal:0,status:null,body:'Published the guide.',revision:null,noteRevision:null})).status,200);
    const response=await f.request(f.member,path);
    assert.equal(response.status,200);
    const data=await response.json() as {notes:{section:number;goal:number|null;body:string}[]};
    assert.deepEqual(data.notes.map(({section,goal,body})=>({section,goal,body})),[{section:0,goal:0,body:'Published the guide.'}]);
  } finally {await f.close();}
});

test('progress statuses and notes stay scoped to the confirmed focus and its participants', async () => {
  const f=await fixture();
  try {
    const focus=await f.create(), path=`/api/focuses/${focus.id}/progress`;
    const leadPath=`/api/department/members/${f.member}/focuses/${focus.id}/progress`;
    const entryPath=`/api/focuses/${focus.id}/progress-entry`;
    // Progress is unavailable on drafts: the owner's read reaches the draft check and answers
    // 409 before any progress data is touched, and the entry point refuses to write.
    // (Non-owner draft reads answer 404: the ownership predicate fails before the draft check.)
    assert.equal((await f.request(f.member,path)).status,409);
    assert.equal((await f.request(f.member,entryPath,'PUT',{section:0,goal:null,status:'achieved',body:'',revision:null,noteRevision:null})).status,409);
    assert.equal((await f.confirm(focus.id,focus.version)).status,200);
    assert.deepEqual(await (await f.request(f.member,path)).json(),{statuses:[],notes:[]});
    assert.equal((await f.request(f.member,entryPath,'PUT',{section:0,goal:null,status:'achieved',body:'',revision:null,noteRevision:null})).status,200);
    const goalStatus=await (await f.request(f.member,entryPath,'PUT',{section:0,goal:0,status:'in-progress',body:'',revision:null,noteRevision:null})).json() as {status:{revision:string}};
    const goalRevision=goalStatus.status.revision;
    const objStatus=await (await f.request(f.member,path)).json() as {statuses:{section:number;goal:number|null;status:string|null;revision?:string}[]};
    const obj=objStatus.statuses.find(s=>s.section===0&&s.goal===null)!;
    assert.equal((await f.request(f.member,entryPath,'PUT',{section:0,goal:null,status:obj.status,body:'Objective finding',revision:obj.revision??null,noteRevision:null})).status,200);
    assert.equal((await f.request(f.member,entryPath,'PUT',{section:0,goal:0,status:'in-progress',body:'Goal finding',revision:goalRevision,noteRevision:null})).status,200);
    const own=await (await f.request(f.member,path)).json() as {statuses:{section:number;goal:number|null;status:string}[];notes:{body:string}[]};
    assert.deepEqual(own.statuses.map(({section,goal,status})=>({section,goal,status})),[{section:0,goal:null,status:'achieved'},{section:0,goal:0,status:'in-progress'}]);
    assert.deepEqual(own.notes.map(n=>n.body),['Objective finding','Goal finding']);
    assert.deepEqual(await (await f.request(f.lead,leadPath)).json(),own);
    for(const actor of [f.peer,f.outsider]) assert.notEqual((await f.request(actor,leadPath)).status,200);
    assert.notEqual((await f.request(f.peer,path)).status,200);
    for(const payload of [{section:2,goal:null,status:'achieved',body:'',revision:null,noteRevision:null},{section:0,goal:1,status:'achieved',body:'',revision:null,noteRevision:null},{section:0,goal:0,status:'invalid',body:'',revision:null,noteRevision:null},{section:0,goal:0,status:'achieved',body:'',revision:null,noteRevision:null,userId:f.peer}]) assert.equal((await f.request(f.member,entryPath,'PUT',payload)).status,400);
    for(const payload of [{section:2,goal:null,body:'bad',status:null,revision:null,noteRevision:null},{section:0,goal:0,body:'x'.repeat(4001),status:null,revision:null,noteRevision:null}]) assert.equal((await f.request(f.member,entryPath,'PUT',payload)).status,400);
    for(const actor of [f.lead,f.outsider]) for(const payload of [{section:0,goal:null,status:'in-progress',body:'Lead finding',revision:obj.revision??null,noteRevision:null},{section:0,goal:0,status:'in-progress',body:'Lead finding',revision:goalRevision,noteRevision:null}]) assert.equal((await f.request(actor,entryPath,'PUT',payload)).status,404);
    for(const payload of [{section:0,goal:0,status:null,body:'x',revision:null,noteRevision:null,userId:f.peer}]) assert.equal((await f.request(f.member,entryPath,'PUT',payload)).status,400);
    assert.deepEqual(await (await f.request(f.member,path)).json(),own);
    const beforeFail=await (await f.request(f.member,path)).json() as {statuses:{section:number;goal:number|null;status:string|null;revision?:string}[];notes:{section:number;goal:number|null;revision:string}[]};
    const failStatus=beforeFail.statuses.find(s=>s.section===0&&s.goal===0)!;
    const failNote=beforeFail.notes.find(n=>n.section===0&&n.goal===0);
    await f.migration.query("ALTER TABLE focus_progress_notes ADD CONSTRAINT synthetic_failure CHECK (body <> 'fail storage')");
    assert.equal((await f.request(f.member,entryPath,'PUT',{section:0,goal:0,status:failStatus.status,body:'fail storage',revision:failStatus.revision??null,noteRevision:failNote?.revision??null})).status,503);
    await f.migration.query('ALTER TABLE focus_progress_notes DROP CONSTRAINT synthetic_failure');
    assert.deepEqual(await (await f.request(f.member,path)).json(),own);
    await f.admin.query('UPDATE memberships SET deleted_at=now() WHERE user_id=$1',[f.member]);
    assert.notEqual((await f.request(f.member,path)).status,200);
    assert.notEqual((await f.request(f.lead,leadPath)).status,200);
    await f.admin.query('UPDATE memberships SET deleted_at=NULL WHERE user_id=$1',[f.member]);
    assert.deepEqual(await (await f.request(f.member,path)).json(),own);
  } finally {await f.close();}
});

test('stale progress status changes do not overwrite a newer update', async () => {
 const f=await fixture();
 try {
  const focus=await f.create();assert.equal((await f.confirm(focus.id,focus.version)).status,200);
  const path=`/api/focuses/${focus.id}/progress-entry`;
  const base={section:0,goal:0,status:'achieved',body:'Stale status note',revision:null,noteRevision:null};
  const first=await f.request(f.member,path,'PUT',base);assert.equal(first.status,200);
  const saved=await first.json() as {status:{revision:string};note:{revision:string}};assert.ok(saved.status.revision);assert.ok(saved.note.revision);
  assert.equal((await f.request(f.member,path,'PUT',{...base,status:'needs-attention'})).status,409);
  const second=await f.request(f.member,path,'PUT',{...base,status:'in-progress',revision:saved.status.revision,noteRevision:saved.note.revision});assert.equal(second.status,200);
  assert.equal((await f.request(f.member,path,'PUT',{...base,status:null,revision:saved.status.revision,noteRevision:saved.note.revision})).status,409);
  const newer=await second.json() as {status:{revision:string};note:{revision:string}};
  assert.equal((await f.request(f.member,path,'PUT',{...base,status:null,revision:newer.status.revision,noteRevision:newer.note.revision})).status,200);
  assert.equal((await f.request(f.member,path,'PUT',{...base,status:'achieved'})).status,409);
 } finally {await f.close();}
});

test('one progress edit saves status and current note together, detects stale edits, and clears both', async () => {
 const f=await fixture();
 try {
  const focus=await f.create();assert.equal((await f.confirm(focus.id,focus.version)).status,200);
  const path=`/api/focuses/${focus.id}/progress-entry`;
  const initial={section:0,goal:0,status:'in-progress',body:'Draft is ready',revision:null,noteRevision:null};
  const saved=await f.request(f.member,path,'PUT',initial);assert.equal(saved.status,200);
  const entry=await saved.json() as {status:{revision:string};note:{revision:string}};
  assert.ok(entry.status.revision);assert.ok(entry.note.revision);
  assert.equal((await f.request(f.member,path,'PUT',initial)).status,409);
  const edit={...initial,status:'achieved',body:'Published',revision:entry.status.revision,noteRevision:entry.note.revision};
  const updated=await f.request(f.member,path,'PUT',edit);assert.equal(updated.status,200);
  const current=await updated.json() as {status:{revision:string};note:{revision:string}};
  const record=await (await f.request(f.member,`/api/focuses/${focus.id}/progress`)).json() as {notes:{body:string}[]};
  assert.deepEqual(record.notes.map(n=>n.body),['Published']);
  await f.migration.query("ALTER TABLE focus_progress_notes ADD CONSTRAINT combined_failure CHECK (body <> 'force failure')");
  assert.equal((await f.request(f.member,path,'PUT',{...edit,status:'needs-attention',body:'force failure',revision:current.status.revision,noteRevision:current.note.revision})).status,503);
  const afterFailure=await (await f.request(f.member,`/api/focuses/${focus.id}/progress`)).json() as {statuses:{status:string}[];notes:{body:string}[]};
  assert.equal(afterFailure.statuses[0]!.status,'achieved');assert.equal(afterFailure.notes[0]!.body,'Published');
  await f.migration.query('ALTER TABLE focus_progress_notes DROP CONSTRAINT combined_failure');
  const cleared=await f.request(f.member,path,'PUT',{...edit,status:null,body:'',revision:current.status.revision,noteRevision:current.note.revision});assert.equal(cleared.status,200);
  const afterClear=await (await f.request(f.member,`/api/focuses/${focus.id}/progress`)).json() as {statuses:{status:null}[];notes:{body:string}[]};
  assert.equal(afterClear.statuses[0]!.status,null);assert.equal(afterClear.notes[0]!.body,'');
  assert.notEqual((await f.request(f.peer,path,'PUT',initial)).status,200);
 } finally {await f.close();}
});

test('changing only the progress status preserves the current note and its date', async () => {
 const f=await fixture();
 try {
  const focus=await f.create();assert.equal((await f.confirm(focus.id,focus.version)).status,200);
  const path=`/api/focuses/${focus.id}/progress-entry`;
  const first=await (await f.request(f.member,path,'PUT',{section:0,goal:0,status:null,body:'A useful finding',revision:null,noteRevision:null})).json() as {status:{revision:string};note:{revision:string;createdAt:string}};
  const changed=await f.request(f.member,path,'PUT',{section:0,goal:0,status:'in-progress',body:'A useful finding',revision:first.status.revision,noteRevision:first.note.revision});assert.equal(changed.status,200);
  const result=await changed.json() as {note:{revision:string;createdAt:string}};assert.equal(result.note.revision,first.note.revision);assert.equal(result.note.createdAt,first.note.createdAt);
 } finally {await f.close();}
});
