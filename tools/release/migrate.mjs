import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {X509Certificate} from 'node:crypto';
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
 for(const kind of ['runtime','migration','admin']) assert.equal(env[`LANTERN_DB_${kind.toUpperCase()}_ROLE`],`lantern_${target}_${kind}`);
 assert.equal(env.LANTERN_DB_SCHEMA,'lantern');
 assert.match(env.LANTERN_DB_NAME??'',/^[a-z][a-z0-9_]{0,62}$/);
 const url=new URL(env.MIGRATION_DATABASE_URL);
 assert.ok(['postgres:','postgresql:'].includes(url.protocol));
 assert.equal(url.host,env.LANTERN_DB_EXPECTED_ENDPOINT);
 assert.ok(url.hostname && !url.hostname.endsWith('.railway.internal'));
 assert.equal(decodeURIComponent(url.username),env.LANTERN_DB_MIGRATION_ROLE);
 assert.equal(decodeURIComponent(url.pathname.slice(1)),env.LANTERN_DB_NAME);
 assert.equal(url.search,'');
 const ca=new X509Certificate(env.MIGRATION_DATABASE_CA);
 assert.ok(ca.ca && Date.parse(ca.validFrom)<=Date.now() && Date.parse(ca.validTo)>Date.now());
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
