import assert from 'node:assert/strict';
import { writeFile, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { chromium as defaultChromium } from '@playwright/test';

// Hosting evidence is deliberately separate from authenticated stage/promotion evidence.
export async function hostingSmoke(env, {fetch = globalThis.fetch, chromium = defaultChromium} = {}) {
  const {APP_ORIGIN:origin, RELEASE_SHA:sha, EXPECTED_DEPLOYMENT_ID:deployment} = env;
  assert.equal(env.RELEASE_TARGET, 'stage');
  assert.equal(new URL(origin).protocol, 'https:');
  assert.match(sha ?? '', /^[a-f0-9]{40}$/);
  assert.ok(deployment, 'Deployment receipt is required.');
  async function health() {
    const response = await fetch(origin+'/health', {signal:AbortSignal.timeout(5000)});
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-lantern-revision'),sha);
    assert.equal(response.headers.get('x-lantern-deployment'),deployment);
    const schema = Number(response.headers.get('x-lantern-schema'));
    assert.ok(Number.isInteger(schema) && schema > 0);
    return schema;
  }
  // Run after the deployment receipt has succeeded; a routing mismatch fails closed.
  const schemaVersion = await health();
  const response = await fetch(origin+'/api/session', {signal:AbortSignal.timeout(5000)});
  assert.equal(response.status,200);
  const session = await response.json();
  assert.equal(session.signInAvailable,false,'Sign-in must be disabled');
  assert.equal(session.user,null);
  assert.equal(session.localAccess,false);
  for (const path of ['/api/focuses','/api/department','/api/guide']) {
    assert.equal((await fetch(origin+path,{signal:AbortSignal.timeout(5000)})).status,401);
  }
  assert.equal((await fetch(origin+'/auth/google',{redirect:'manual',signal:AbortSignal.timeout(5000)})).status,503);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors = []; page.on('pageerror',()=>errors.push('browser error'));
    await page.goto(origin);
    await page.getByRole('heading',{name:'Welcome to Lantern'}).waitFor();
    await page.getByText('Sign-in is awaiting configuration.',{exact:true}).waitFor();
    assert.equal(await page.getByRole('link',{name:'Sign in with Google'}).count(),0);
    const write = await page.request.post(origin+'/api/focuses', {
      headers:{Origin:origin},
      data:{title:'Hosting denial check',start:'2026-01-01',end:'2026-12-31',sections:[]},
    });
    assert.equal(write.status(),401,'Protected writes must remain denied');
    assert.equal(errors.length,0);
  } finally { await browser.close(); }
  assert.equal(await health(),schemaVersion);
  return {sha,deployment,schemaVersion,target:'stage',hosting:'passed',authenticatedSmoke:'pending'};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await rm('hosting-evidence.json',{force:true});
  try { await writeFile('hosting-evidence.json',JSON.stringify(await hostingSmoke(process.env),null,2)); }
  catch { console.error('Hosting checks failed; no hosting evidence recorded.'); process.exitCode=1; }
}
