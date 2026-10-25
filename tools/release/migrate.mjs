import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {validateHostedMigrationTarget} from './settings.mjs';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

let directory;
try {
 const env=process.env;
 const {RELEASE_SHA:sha,RELEASE_TARGET:target}=env;
 assert.match(sha??'',/^[a-f0-9]{40}$/);
 assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sha);
 assert.ok(['stage','production'].includes(target));
 for(const name of ['DATABASE_URL','ADMIN_DATABASE_URL','BOOTSTRAP_DATABASE_URL']) assert.ok(!env[name]);
 const {url,certificate:ca}=validateHostedMigrationTarget(env,target,env.MIGRATION_DATABASE_CA);
 directory=mkdtempSync(join(tmpdir(),'lantern-migration-ca-'));
 const certificate=join(directory,'ca.pem');
 writeFileSync(certificate,ca.toString(),{mode:0o600});
 // Railway's CA authenticates this database; its certificate names the private host.
 url.searchParams.set('sslmode','verify-ca');
 url.searchParams.set('uselibpqcompat','true');
 url.searchParams.set('sslrootcert',certificate);
 execFileSync(process.execPath,['dist/server/migrate.js'],{env:{...env,MIGRATION_DATABASE_URL:url.href},stdio:['ignore','pipe','pipe'],timeout:10*60*1000});
 console.log('Exact-revision database migrations completed.');
} catch {
 console.error('Database migration failed; application deployment blocked. Check target settings and migration compatibility before retrying.');
 process.exitCode=1;
} finally {if(directory) rmSync(directory,{recursive:true,force:true});}
