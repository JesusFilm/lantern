import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium as defaultChromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';
export async function smoke(env, {fetch = globalThis.fetch, chromium = defaultChromium} = {}) {
const { APP_ORIGIN: origin, RELEASE_SHA: sha, GITHUB_RUN_ID: runId } = env;
assert.ok(env.EXPECTED_DEPLOYMENT_ID, 'Deployment receipt is required.');
assert.match(sha ?? '', /^[a-f0-9]{40}$/);
assert.equal(new URL(origin).protocol, 'https:');
let health;
for (let attempt = 0; attempt < 60; attempt++) {
 try {
  const response = await fetch(origin+'/health', { signal: AbortSignal.timeout(5000) });
  if (response.ok && response.headers.get('x-lantern-revision') === sha && response.headers.get('x-lantern-deployment') === env.EXPECTED_DEPLOYMENT_ID) { health = response; break; }
 } catch { /* bounded readiness retry */ }
 await new Promise(r => setTimeout(r, 2000));
}
assert.ok(health, 'Exact revision did not become ready.');
assert.equal((await fetch(origin+'/api/focuses')).status, 401);
const browser = await chromium.launch();
try {
 const page = await browser.newPage();
 const errors = []; page.on('pageerror', () => errors.push('browser error'));
 await page.goto(origin);
 await page.getByRole('button', { name: /sign in with google/i }).or(page.getByRole('link', { name: /sign in with google/i })).waitFor();
 assert.equal(errors.length, 0, 'Login shell failed.');
 // Stage cookies come from normal, manually completed Google login. Never mint sessions or bypass authentication.
 if (env.RELEASE_TARGET === 'stage') {
  const cookies = [env.QA_MEMBER_A_SESSION, env.QA_MEMBER_B_SESSION];
  assert.ok(cookies.every(Boolean), 'Two current stage QA sessions are required.');
  const contexts = [];
  try {
   for (const value of cookies) {
    const context = await browser.newContext(); contexts.push(context);
    await context.addCookies([{name:'__Host-lantern-session', value, url:origin, secure:true, httpOnly:true, sameSite:'Lax'}]);
   }
   const [a,b] = contexts;
   const sessions = await Promise.all(contexts.map(async c => {
    const response = await c.request.get(origin+'/api/session'); assert.equal(response.status(),200);
    const session = await response.json(); assert.ok(session.user && session.department?.role === 'member', 'QA accounts must be ordinary active members.'); assert.ok(!session.localAccess); return session;
   }));
   assert.ok(sessions[0].user.id !== sessions[1].user.id, 'QA identities must differ.');
   const created = await a.request.post(origin+'/api/focuses', { headers:{Origin:origin}, data:{ title:`QA release ${sha.slice(0,12)} run ${runId}`, start:'2026-01-01', end:'2026-12-31', sections:[] } });
   assert.equal(created.status(),201,'Synthetic QA draft creation failed.');
   const focus = await created.json();
   assert.equal((await a.request.get(origin+'/api/focuses/'+focus.id)).status(),200);
   assert.equal((await b.request.get(origin+'/api/focuses/'+focus.id)).status(),404);
   const memberPage = await a.newPage(); await memberPage.goto(origin);
   await memberPage.getByText(focus.title,{exact:true}).first().waitFor();
   await memberPage.reload(); await memberPage.getByText(focus.title,{exact:true}).first().waitFor();
  } finally { await Promise.all(contexts.map(c => c.close())); }
 }
} finally { await browser.close(); }
const finalHealth = await fetch(origin+'/health', {signal:AbortSignal.timeout(5000)});
assert.equal(finalHealth.status,200);
assert.equal(finalHealth.headers.get('x-lantern-revision'),sha);
assert.equal(finalHealth.headers.get('x-lantern-deployment'),health.headers.get('x-lantern-deployment'));
// Only allowlisted, non-personnel metadata is retained. No traces, cookies, HTML or screenshots.
return {sha, stage:env.RELEASE_TARGET === 'stage' ? 'passed' : undefined, target:env.RELEASE_TARGET, deployment:health.headers.get('x-lantern-deployment'), schemaVersion:Number(health.headers.get('x-lantern-schema')), runId};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
 try { await writeFile('release-evidence.json', JSON.stringify(await smoke(process.env),null,2)); }
 catch { console.error('Release smoke failed; no passing evidence recorded.'); process.exitCode = 1; }
}
