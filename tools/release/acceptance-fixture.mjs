import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {safeJourneyCheckpoint} from './acceptance-diagnostics.mjs';

const actorNames=['member','peer','lead','outsider'];
const subjectPrefix='lantern-acceptance:v1:';
const departmentPrefix='Lantern acceptance v1 ';
const subject=(runId,actor)=>`${subjectPrefix}${runId}:${actor}`;
const email=(runId,actor)=>`${actor}.${runId}@acceptance.invalid`;
const departmentName=(runId,team)=>`${departmentPrefix}${runId} ${team}`;
const uuid='[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
const subjectPattern=new RegExp(`^${subjectPrefix}(${uuid}):(member|peer|lead|outsider)$`);
const departmentPattern=new RegExp(`^${departmentPrefix}(${uuid}) (main|outsider)$`);

class FixtureError extends Error {
 constructor(code='ACCEPTANCE_FIXTURE_FAILED') {
  super('Staging acceptance fixture could not be safely completed.');this.code=code;
 }
}
function requireOwned(condition) {if(!condition)throw new FixtureError('ACCEPTANCE_FIXTURE_UNSAFE');}
async function transaction(client,work) {
 await client.query('BEGIN');
 try {
  await client.query('SELECT pg_advisory_xact_lock(603106)');
  const result=await work();await client.query('COMMIT');return result;
 } catch(error) {await client.query('ROLLBACK');throw error;}
}
async function seed(client,runId) {
 return transaction(client,async()=>{
  const departments={main:randomUUID(),outsider:randomUUID()};
  for(const [team,id] of Object.entries(departments))await client.query('INSERT INTO departments(id,name) VALUES($1,$2)',[id,departmentName(runId,team)]);
  const actors={},sessions={};
  for(const actor of actorNames) {
   const userId=randomUUID(),departmentId=departments[actor==='outsider'?'outsider':'main'];
   const address=email(runId,actor),token=randomBytes(32).toString('base64url');
   await client.query('INSERT INTO approved_emails(email) VALUES($1)',[address]);
   await client.query('INSERT INTO users(id,google_sub,email,name) VALUES($1,$2,$3,$4)',[userId,subject(runId,actor),address,`Acceptance ${actor}`]);
   await client.query('INSERT INTO memberships(user_id,department_id,role) VALUES($1,$2,$3)',[userId,departmentId,actor==='lead'?'career-lead':'member']);
   await client.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '15 minutes')",[createHash('sha256').update(token).digest('hex'),userId]);
   actors[actor]={userId,departmentId,email:address};sessions[actor]=token;
  }
  return {runId,actors,sessions};
 });
}
async function cleanup(client,runId) {
 await transaction(client,async()=>{
  // Lock the roots before checking their graph. Foreign-key writes cannot attach
  // new children between verification and deletion; membership writers also share
  // the transaction lock above. Never infer ownership from an email suffix alone.
  const departmentRows=(await client.query('SELECT id,name FROM departments WHERE name=ANY($1::text[]) FOR UPDATE',[[departmentName(runId,'main'),departmentName(runId,'outsider')]])).rows;
  requireOwned(departmentRows.length===2 && new Set(departmentRows.map(row=>row.name)).size===2);
  const departmentByTeam=Object.fromEntries(['main','outsider'].map(team=>[team,departmentRows.find(row=>row.name===departmentName(runId,team)).id]));
  const addresses=actorNames.map(actor=>email(runId,actor));
  const accounts=(await client.query('SELECT id,google_sub,email FROM users WHERE google_sub=ANY($1::text[]) OR lower(btrim(email))=ANY($2::text[]) FOR UPDATE',[actorNames.map(actor=>subject(runId,actor)),addresses])).rows;
  requireOwned(accounts.length===actorNames.length);
  const owned=new Map();
  for(const actor of actorNames) {
   const user=accounts.find(row=>row.google_sub===subject(runId,actor));
   requireOwned(user?.email===email(runId,actor));
   owned.set(user.id,{actor,departmentId:departmentByTeam[actor==='outsider'?'outsider':'main'],role:actor==='lead'?'career-lead':'member'});
  }
  const users=[...owned.keys()],departments=departmentRows.map(row=>row.id);
  const memberships=(await client.query('SELECT user_id,department_id,role FROM memberships WHERE user_id=ANY($1::uuid[]) OR department_id=ANY($2::uuid[]) FOR UPDATE',[users,departments])).rows;
  requireOwned(memberships.length===actorNames.length && memberships.every(row=>{
   const member=owned.get(row.user_id);return member && row.department_id===member.departmentId && row.role===member.role;
  }));
  const focuses=(await client.query('SELECT id,user_id,department_id,confirmed_by FROM position_focuses WHERE user_id=ANY($1::uuid[]) OR confirmed_by=ANY($1::uuid[]) OR department_id=ANY($2::uuid[]) FOR UPDATE',[users,departments])).rows;
  requireOwned(focuses.every(row=>{
   const member=owned.get(row.user_id),confirmer=owned.get(row.confirmed_by);
   return member && row.department_id===member.departmentId && (row.confirmed_by===null || confirmer?.role==='career-lead' && confirmer.departmentId===row.department_id);
  }));
  await client.query('DELETE FROM position_focuses WHERE id=ANY($1::uuid[])',[focuses.map(row=>row.id)]);
  await client.query('DELETE FROM department_direction WHERE department_id=ANY($1::uuid[])',[departments]);
  await client.query('DELETE FROM sessions WHERE user_id=ANY($1::uuid[])',[users]);
  await client.query('DELETE FROM memberships WHERE user_id=ANY($1::uuid[])',[users]);
  await client.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[users]);
  await client.query('DELETE FROM approved_emails WHERE email=ANY($1::text[])',[addresses]);
  await client.query('DELETE FROM departments WHERE id=ANY($1::uuid[])',[departments]);
 });
}
async function recover(client,report) {
 const users=await client.query("SELECT google_sub AS marker FROM users WHERE google_sub LIKE $1||'%'",[subjectPrefix]);
 const departments=await client.query("SELECT name AS marker FROM departments WHERE name LIKE $1||'%'",[departmentPrefix]);
 const runs=new Set();
 for(const [rows,pattern] of [[users.rows,subjectPattern],[departments.rows,departmentPattern]]) {
  for(const {marker} of rows) {
   const match=pattern.exec(marker);
   if(!match)throw new FixtureError('ACCEPTANCE_FIXTURE_UNSAFE');
   runs.add(match[1]);
  }
 }
 for(const runId of runs) {
  report({cleanup:'unknown'});
  try {await cleanup(client,runId);report({cleanup:'passed'});}
  catch(error) {report({cleanup:'failed'});throw error;}
 }
 return runs.size;
}

/** Private runner only: the caller must verify the staging target before connecting. */
export async function withAcceptanceFixture(db,work,{onProgress=()=>{}}={}) {
 let client,result,callbackError,callbackFailed=false,operationError,locked=false;
 const report=event=>{try {onProgress(event);} catch {}};
 report({journey:'not-reached',journeyCheckpoint:'not-reached',cleanup:'not-reached'});
 try {
  client=await db.connect();
  // The lock connection stays checked out while the browser runs. Pool error
  // handlers only cover idle clients; suppress raw connection-error emission and
  // fail this run if its lock connection disappears in that interval.
  client.on('error',()=>{operationError=new FixtureError();});
  locked=(await client.query("SELECT pg_try_advisory_lock(hashtext('lantern-acceptance-v1'),hashtext(current_schema())) AS locked")).rows[0].locked;
  if(!locked)throw new FixtureError('ACCEPTANCE_FIXTURE_BUSY');
  // Holding the run lock proves that any existing marked fixture is abandoned.
  if(await recover(client,report))report({cleanup:'not-reached'});
  const runId=randomUUID();
  const fixture=await seed(client,runId);
  report({journey:'unknown',journeyCheckpoint:'journey'});
  try {
   result=await work(fixture);
   report({journey:'passed',journeyCheckpoint:'complete'});
  } catch(error) {
   callbackFailed=true;callbackError=error;
   report({journey:'failed',journeyCheckpoint:safeJourneyCheckpoint(error)});
  }
  report({cleanup:'unknown'});
  try {await cleanup(client,runId);report({cleanup:'passed'});}
  catch(error) {report({cleanup:'failed'});throw error;}
 } catch(error) {operationError=error instanceof FixtureError?error:new FixtureError();}
 finally {
  if(locked)try {await client.query("SELECT pg_advisory_unlock(hashtext('lantern-acceptance-v1'),hashtext(current_schema()))");}
  catch {operationError=new FixtureError();}
  // Never return a possibly locked connection to the shared pool.
  client?.release(true);
 }
 if(operationError)throw operationError;
 if(callbackFailed)throw callbackError;
 return result;
}
