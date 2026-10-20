import assert from 'node:assert/strict';
import {createHash, randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {test} from 'node:test';
import {createApp} from '../../dist/server/app.js';
import {createDatabase} from '../../dist/server/database.js';
import {migrate} from '../../dist/server/schema.js';
import {withAcceptanceFixture} from './acceptance-fixture.mjs';

const tables=['approved_emails','users','departments','memberships','position_focuses','sessions','login_attempts','department_direction'];
async function isolated(work) {
 const owner=createDatabase(process.env.DATABASE_URL);
 const schema='acceptance_'+randomUUID().replaceAll('-','');
 await owner.query(`CREATE SCHEMA ${schema}`);
 const url=new URL(process.env.DATABASE_URL);url.searchParams.set('options',`-c search_path=${schema}`);
 const db=createDatabase(url.href);
 try {await migrate(db);await work(db,url.href);}
 finally {await db.end();await owner.query(`DROP SCHEMA ${schema} CASCADE`);await owner.end();}
}
async function contents(db) {
 const result={};
 for(const table of tables)result[table]=(await db.query(`SELECT to_jsonb(t) AS row FROM ${table} t ORDER BY to_jsonb(t)::text`)).rows;
 return result;
}

test('acceptance uses expiring ordinary sessions and removes only its synthetic records',()=>isolated(async db=>{
 const manual=randomUUID(),department=randomUUID();
 await db.query("INSERT INTO users VALUES($1,$2,'manual@acceptance.invalid','Manual synthetic account')",[manual,randomUUID()]);
 await db.query("INSERT INTO approved_emails VALUES('manual@acceptance.invalid')");
 await db.query("INSERT INTO departments VALUES($1,'Manual staging team',NULL)",[department]);
 await db.query("INSERT INTO memberships VALUES($1,$2,'career-lead',NULL)",[manual,department]);
 const baseline=await contents(db);
 const server=createServer(createApp(db,{origin:'http://127.0.0.1'}));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin=`http://127.0.0.1:${server.address().port}`;
 const tokens=[];
 try {
  const result=await withAcceptanceFixture(db,async fixture=>{
   assert.match(fixture.runId,/^[a-f0-9-]{36}$/);
   assert.deepEqual(Object.keys(fixture.sessions).sort(),['lead','member','outsider','peer']);
   for(const [actor,token] of Object.entries(fixture.sessions)) {
    tokens.push(token);assert.match(token,/^[A-Za-z0-9_-]{43}$/);
    const stored=await db.query('SELECT expires_at>now() AND expires_at<=now()+interval \'15 minutes\' AS bounded FROM sessions WHERE token_hash=$1',[createHash('sha256').update(token).digest('hex')]);
    assert.deepEqual(stored.rows,[{bounded:true}]);
    const response=await fetch(origin+'/api/session',{headers:{Cookie:`lantern-session=${token}`}});
    const session=await response.json();
    assert.equal(session.user.id,fixture.actors[actor].userId);
    assert.equal(session.department.role,actor==='lead'?'career-lead':'member');
    assert.equal(session.localAccess,false);
   }
   assert.equal(new Set(tokens).size,4);
   const {member,lead}=fixture.actors;
   await db.query("INSERT INTO position_focuses(id,user_id,department_id,title,period_start,period_end,status,confirmed_at,confirmed_by) VALUES($1,$2,$3,'Synthetic confirmed focus','2026-01-01','2026-12-31','confirmed',now(),$4)",[randomUUID(),member.userId,member.departmentId,lead.userId]);
   await db.query("INSERT INTO department_direction(department_id,mission) VALUES($1,'Synthetic mission')",[member.departmentId]);
   await db.query("UPDATE sessions SET expires_at=now()-interval '1 second' WHERE user_id=$1",[fixture.actors.peer.userId]);
   const expired=await fetch(origin+'/api/focuses',{headers:{Cookie:`lantern-session=${fixture.sessions.peer}`}});
   assert.equal(expired.status,401);
   return 'completed';
  });
  assert.equal(result,'completed');
  assert.deepEqual(await contents(db),baseline);
  for(const token of tokens) {
   const response=await fetch(origin+'/api/session',{headers:{Cookie:`lantern-session=${token}`}});
   assert.equal((await response.json()).user,null);
  }
 } finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}));

test('another acceptance run cannot enter or clean a live fixture',()=>isolated(async db=>{
 await withAcceptanceFixture(db,async()=>{
  const live=await contents(db);
  await assert.rejects(withAcceptanceFixture(db,async()=>assert.fail('A concurrent run must not enter')),error=>error.code==='ACCEPTANCE_FIXTURE_BUSY');
  assert.deepEqual(await contents(db),live);
 });
 await withAcceptanceFixture(db,async()=>{});
 assert.equal((await db.query('SELECT count(*)::int AS count FROM users')).rows[0].count,0);
}));

test('a later run recovers fixtures abandoned by an abruptly terminated runner',{timeout:15000},()=>isolated(async(db,url)=>{
 const child=spawn(process.execPath,['--input-type=module','-e',`
  import {createDatabase} from ${JSON.stringify(new URL('../../dist/server/database.js',import.meta.url).href)};
  import {withAcceptanceFixture} from ${JSON.stringify(new URL('./acceptance-fixture.mjs',import.meta.url).href)};
  const db=createDatabase(process.env.DATABASE_URL);
  await withAcceptanceFixture(db,async()=>{process.stdout.write('ready');await new Promise(()=>{});});
 `],{env:{...process.env,DATABASE_URL:url},stdio:['ignore','pipe','ignore']});
 const exited=once(child,'exit');
 try {
  await Promise.race([once(child.stdout,'data'),exited.then(()=>{throw new Error('Synthetic interrupted-run child exited early.');})]);
  const abandoned=(await db.query('SELECT id FROM users')).rows.map(row=>row.id);
  assert.equal(abandoned.length,4);
  child.kill('SIGKILL');await exited;
  await withAcceptanceFixture(db,async()=>{
   assert.equal((await db.query('SELECT count(*)::int AS count FROM users')).rows[0].count,4);
   assert.equal((await db.query('SELECT id FROM users WHERE id=ANY($1::uuid[])',[abandoned])).rowCount,0);
  });
  assert.equal((await db.query('SELECT count(*)::int AS count FROM users')).rows[0].count,0);
 } finally {if(child.exitCode===null && child.signalCode===null){child.kill('SIGKILL');await exited;}}
}));

test('unexpected fixture relationships abort cleanup without changing any records',async t=>{
 const cases={
  'fixture member moved into a manual department':async(db,fixture)=>{
   const department=randomUUID(),member=fixture.actors.member.userId;
   await db.query("INSERT INTO departments VALUES($1,'Manual staging department',NULL)",[department]);
   await db.query('UPDATE memberships SET department_id=$1 WHERE user_id=$2',[department,member]);
   await db.query("INSERT INTO position_focuses(id,user_id,department_id,title,period_start,period_end) VALUES($1,$2,$3,'Manual staging focus','2026-01-01','2026-12-31')",[randomUUID(),member,department]);
  },
  'manual member belongs to fixture department':async(db,fixture)=>{
   const user=randomUUID();
   await db.query("INSERT INTO users VALUES($1,$2,'manual@example.test','Manual')",[user,randomUUID()]);
   await db.query("INSERT INTO memberships VALUES($1,$2,'member',NULL)",[user,fixture.actors.member.departmentId]);
  },
  'manual account shares an approval email':async(db,fixture)=>{
   await db.query("INSERT INTO users VALUES($1,$2,$3,'Manual duplicate email')",[randomUUID(),randomUUID(),fixture.actors.member.email]);
  },
  'one fixture account is missing':async(db,fixture)=>{
   const user=fixture.actors.peer.userId;
   await db.query('DELETE FROM sessions WHERE user_id=$1',[user]);
   await db.query('DELETE FROM memberships WHERE user_id=$1',[user]);
   await db.query('DELETE FROM users WHERE id=$1',[user]);
  },
  'fixture department has an ambiguous marker':async(db,fixture)=>{
   await db.query('INSERT INTO departments(id,name) SELECT $1,name FROM departments WHERE id=$2',[randomUUID(),fixture.actors.member.departmentId]);
  },
  'fixture focus references a manual department':async(db,fixture)=>{
   const department=randomUUID();
   await db.query("INSERT INTO departments VALUES($1,'Manual focus department',NULL)",[department]);
   await db.query("INSERT INTO position_focuses(id,user_id,department_id,title,period_start,period_end) VALUES($1,$2,$3,'Manual reference','2026-01-01','2026-12-31')",[randomUUID(),fixture.actors.member.userId,department]);
  },
  'manual focus references a fixture confirmer':async(db,fixture)=>{
   const user=randomUUID(),department=randomUUID();
   await db.query("INSERT INTO users VALUES($1,$2,'manual@example.test','Manual')",[user,randomUUID()]);
   await db.query("INSERT INTO departments VALUES($1,'Manual focus department',NULL)",[department]);
   await db.query("INSERT INTO position_focuses(id,user_id,department_id,title,period_start,period_end,status,confirmed_at,confirmed_by) VALUES($1,$2,$3,'Manual focus','2026-01-01','2026-12-31','confirmed',now(),$4)",[randomUUID(),user,department,fixture.actors.lead.userId]);
  }
 };
 for(const [name,alter] of Object.entries(cases))await t.test(name,()=>isolated(async db=>{
  let before;
  await assert.rejects(withAcceptanceFixture(db,async fixture=>{
   await alter(db,fixture);before=await contents(db);
  }),error=>error.code==='ACCEPTANCE_FIXTURE_UNSAFE');
  assert.deepEqual(await contents(db),before);
  await assert.rejects(withAcceptanceFixture(db,async()=>assert.fail('Unsafe recovery must prevent a new run')),error=>error.code==='ACCEPTANCE_FIXTURE_UNSAFE');
  assert.deepEqual(await contents(db),before);
 }));
});

test('callback failures retain their safe error and cannot redirect cleanup using returned IDs',()=>isolated(async db=>{
 const manual=randomUUID(),safeError=new Error('Deployed browser acceptance failed.');
 await db.query("INSERT INTO users VALUES($1,$2,'manual@example.test','Manual')",[manual,randomUUID()]);
 const baseline=await contents(db);
 await assert.rejects(withAcceptanceFixture(db,async fixture=>{
  fixture.runId=manual;
  for(const actor of Object.values(fixture.actors))actor.userId=manual;
  throw safeError;
 }),error=>error===safeError);
 assert.deepEqual(await contents(db),baseline);
}));

test('malformed reserved markers stop recovery without treating lookalike email addresses as owned',()=>isolated(async db=>{
 await db.query("INSERT INTO users VALUES($1,$2,'member.manual@acceptance.invalid','Manual')",[randomUUID(),'lantern-acceptance:v1:manual-id:member']);
 const baseline=await contents(db);
 await assert.rejects(withAcceptanceFixture(db,async()=>assert.fail('Malformed markers must prevent work')),error=>error.code==='ACCEPTANCE_FIXTURE_UNSAFE');
 assert.deepEqual(await contents(db),baseline);
}));

test('seed failure rolls back every fixture row and hides database error details',()=>isolated(async db=>{
 await db.query(`CREATE FUNCTION reject_acceptance_session() RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN RAISE EXCEPTION 'synthetic-private-database-detail'; END; $$;
  CREATE TRIGGER reject_acceptance_session BEFORE INSERT ON sessions FOR EACH ROW EXECUTE FUNCTION reject_acceptance_session()`);
 const baseline=await contents(db);
 await assert.rejects(withAcceptanceFixture(db,async()=>assert.fail('Failed seed must prevent work')),error=>{
  assert.equal(error.code,'ACCEPTANCE_FIXTURE_FAILED');
  assert.equal(error.message,'Staging acceptance fixture could not be safely completed.');
  assert.equal(error.cause,undefined);return true;
 });
 assert.deepEqual(await contents(db),baseline);
}));

test('cleanup failure rolls back changes, hides database details and can be recovered',()=>isolated(async db=>{
 let before;
 await assert.rejects(withAcceptanceFixture(db,async()=>{
  before=await contents(db);
  await db.query(`CREATE FUNCTION reject_acceptance_cleanup() RETURNS trigger LANGUAGE plpgsql AS $$
   BEGIN RAISE EXCEPTION 'synthetic-private-database-detail'; END; $$;
   CREATE TRIGGER reject_acceptance_cleanup BEFORE DELETE ON sessions FOR EACH ROW EXECUTE FUNCTION reject_acceptance_cleanup()`);
 }),error=>{
  assert.equal(error.code,'ACCEPTANCE_FIXTURE_FAILED');
  assert.equal(error.message,'Staging acceptance fixture could not be safely completed.');
  assert.equal(error.cause,undefined);return true;
 });
 assert.deepEqual(await contents(db),before);
 await db.query('DROP TRIGGER reject_acceptance_cleanup ON sessions');
 await withAcceptanceFixture(db,async()=>{});
 for(const rows of Object.values(await contents(db)))assert.deepEqual(rows,[]);
}));

test('losing the fixture connection fails safely and leaves recovery to the next run',{timeout:15000},()=>isolated(async(db,connection)=>{
 const url=new URL(connection),application='acceptance_connection_'+randomUUID();
 url.searchParams.set('application_name',application);
 const child=spawn(process.execPath,['--input-type=module','-e',`
  import {createDatabase} from ${JSON.stringify(new URL('../../dist/server/database.js',import.meta.url).href)};
  import {withAcceptanceFixture} from ${JSON.stringify(new URL('./acceptance-fixture.mjs',import.meta.url).href)};
  const db=createDatabase(process.env.DATABASE_URL);
  try {
   await withAcceptanceFixture(db,async()=>{process.send('ready');await new Promise(resolve=>process.once('message',resolve));});
   process.exitCode=1;
  } catch(error) {process.stdout.write(error.code+':'+error.message);}
  finally {await db.end();process.disconnect();}
 `],{env:{...process.env,DATABASE_URL:url.href},stdio:['ignore','pipe','ignore','ipc']});
 let output='';child.stdout.on('data',chunk=>{output+=chunk.toString();});
 const exited=once(child,'exit');
 try {
  await Promise.race([once(child,'message'),exited.then(()=>{throw new Error('Synthetic connection-failure child exited early.');})]);
  const killed=await db.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE application_name=$1',[application]);
  assert.equal(killed.rowCount,1);child.send('continue');
  const [code]=await exited;
  assert.equal(code,0);
  assert.equal(output,'ACCEPTANCE_FIXTURE_FAILED:Staging acceptance fixture could not be safely completed.');
  await withAcceptanceFixture(db,async()=>{});
  for(const rows of Object.values(await contents(db)))assert.deepEqual(rows,[]);
 } finally {if(child.exitCode===null && child.signalCode===null){child.kill('SIGKILL');await exited;}}
}));
