import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createDatabase} from '../../dist/server/database.js';
import {migrate} from '../../dist/server/schema.js';
import {withTemporaryMember} from './stage-isolation.mjs';

test('temporary member role is restored after success or a failed isolation check',async()=>{
 const owner=createDatabase(process.env.DATABASE_URL);
 const schema='role_test_'+randomUUID().replaceAll('-','');
 await owner.query(`CREATE SCHEMA ${schema}`);
 const url=new URL(process.env.DATABASE_URL);url.searchParams.set('options',`-c search_path=${schema}`);
 const db=createDatabase(url.href);
 try {
  await migrate(db);
  const member={userId:randomUUID(),departmentId:randomUUID()};
  await db.query("INSERT INTO users(id,google_sub,email,name) VALUES($1::uuid,$1::text,'synthetic@example.test','Synthetic')",[member.userId]);
  await db.query("INSERT INTO departments(id,name) VALUES($1,'Synthetic')",[member.departmentId]);
  await db.query("INSERT INTO memberships VALUES($1,$2,'career-lead',NULL)",[member.userId,member.departmentId]);
  const role=async()=> (await db.query('SELECT role FROM memberships WHERE user_id=$1',[member.userId])).rows[0].role;
  await withTemporaryMember(db,member,async()=>assert.equal(await role(),'member'));
  assert.equal(await role(),'career-lead');
  await assert.rejects(withTemporaryMember(db,member,async()=>{assert.equal(await role(),'member');throw new Error('Synthetic failure');}),/Synthetic failure/);
  assert.equal(await role(),'career-lead');
  await assert.rejects(withTemporaryMember(db,{...member,departmentId:randomUUID()},async()=>assert.fail('must not run')));
  assert.equal(await role(),'career-lead');
 } finally {await db.end();await owner.query(`DROP SCHEMA ${schema} CASCADE`);await owner.end();}
});
