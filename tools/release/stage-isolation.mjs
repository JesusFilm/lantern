import assert from 'node:assert/strict';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createDatabase } from '../../dist/server/database.js';
import { assertDatabaseTarget, databaseRoleConfig } from '../../dist/server/database-privileges.js';
import { assertOperatorEndpoint } from '../../dist/server/operator-target.js';
import { membershipWrite } from '../../dist/server/membership.js';
import { smoke } from './smoke.mjs';

export async function changeRole(db, member, from, to) {
 assert.ok(['member','career-lead'].includes(from) && ['member','career-lead'].includes(to));
 await membershipWrite(db, async client => {
  const result = await client.query('UPDATE memberships SET role=$1 WHERE user_id=$2 AND department_id=$3 AND role=$4 AND deleted_at IS NULL RETURNING role', [to,member.userId,member.departmentId,from]);
  assert.equal(result.rowCount,1,'Expected exactly one active membership; no role change committed.');
 });
}

export async function withTemporaryMember(db, member, work) {
 await changeRole(db,member,'career-lead','member');
 try { return await work(); }
 finally { await changeRole(db,member,'member','career-lead'); }
}

async function run(env, restore) {
 assert.equal(env.LANTERN_ENV,'stage');
 assert.equal(env.RELEASE_TARGET,'stage');
 assert.equal(env.APP_ORIGIN,'https://lantern-staging.up.railway.app');
 const config=databaseRoleConfig(env);
 assert.equal(config.admin,'lantern_stage_admin');
 assertOperatorEndpoint(env.ADMIN_DATABASE_URL,env.LANTERN_DB_EXPECTED_ENDPOINT);
 assert.ok(env.STAGE_ROLE_RECOVERY_FILE?.startsWith('/'),'Private absolute recovery-file path required.');
 const db=createDatabase(env.ADMIN_DATABASE_URL);
 try {
  await assertDatabaseTarget(db,{database:config.expectedDatabase,schema:config.schema,role:config.admin});
  if (restore) {
   const member=JSON.parse(await readFile(env.STAGE_ROLE_RECOVERY_FILE,'utf8'));
   // An interrupted process may already have restored the role. Accept only the saved active membership.
   const result=await db.query('SELECT role FROM memberships WHERE user_id=$1 AND department_id=$2 AND deleted_at IS NULL',[member.userId,member.departmentId]);
   assert.equal(result.rowCount,1);
   if(result.rows[0].role==='member') await changeRole(db,member,'member','career-lead');
   else assert.equal(result.rows[0].role,'career-lead');
   await unlink(env.STAGE_ROLE_RECOVERY_FILE);
   console.log('Staging lead role restored and verified.'); return;
  }
  const sessions=[];
  for(const token of [env.QA_MEMBER_A_SESSION,env.QA_MEMBER_B_SESSION]) {
   assert.ok(token,'Two existing Google sessions required.');
   const response=await fetch(env.APP_ORIGIN+'/api/session',{headers:{Cookie:`__Host-lantern-session=${token}`},signal:AbortSignal.timeout(5000)});
   assert.equal(response.status,200); sessions.push(await response.json());
  }
  const [lead,other]=sessions;
  assert.ok(lead.user && other.user && lead.user.id!==other.user.id);
  assert.equal(lead.department?.role,'career-lead');
  assert.equal(other.department?.role,'member');
  assert.equal(lead.department.id,other.department.id);
  assert.ok(!lead.localAccess && !other.localAccess);
  const member={userId:lead.user.id,departmentId:lead.department.id};
  // Exclusive, private marker survives termination. Never store cookies or credentials in it.
  await writeFile(env.STAGE_ROLE_RECOVERY_FILE,JSON.stringify(member),{flag:'wx',mode:0o600});
  const evidence=await withTemporaryMember(db,member,()=>smoke({...env,RELEASE_SMOKE_MODE:'authenticated'}));
  await unlink(env.STAGE_ROLE_RECOVERY_FILE);
  await writeFile('stage-isolation-evidence.json',JSON.stringify({...evidence,leadRoleRestored:true},null,2));
  console.log('Bidirectional staging isolation passed; lead role restored.');
 } finally {await db.end();}
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
 try {await run(process.env,process.argv[2]==='--restore');}
 catch {console.error('Staging isolation incomplete. If the private recovery file exists, run this command with --restore before continuing. No passing outcome claimed.');process.exitCode=1;}
}
