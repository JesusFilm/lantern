import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { hash } from './access.js';
import { coachingFixture, checkpoint } from './coach-test-support.js';

test('AI coaching receives only purpose and pending content, validates output, never saves and shares human admission', async () => {
  let finish: (() => void) | undefined, started!: () => void;
  const running = new Promise<void>(resolve => { started = resolve; });
  const prompts: { system: string; input: string }[] = [];
  const f = await coachingFixture({ async suggest(system, input, validate) {
    prompts.push({ system, input });
    started();
    await new Promise<void>(resolve => { finish = resolve; });
    return validate({ objective: 'Useful synthetic outcome', goals: ['Complete three synthetic tasks by December.', 'Share two findings.'] });
  } }, { aiMemberManagerEmails: new Set(['member@example.test', 'peer@example.test']) });
  try {
    const member = await (await f.request('member', '/api/ai-members', 'POST', { name: 'PRIVATE NAME', purpose: 'Review synthetic changes' })).json();
    const path = '/api/ai-members/' + member.id;
    const input = { objective: 'Pending objective', goals: ['Pending first goal', 'Pending second goal'] };
    const pending = f.request('member', path + '/coach', 'POST', input);
    const early = await Promise.race([running.then(() => 'started'), pending.then(r => 'HTTP ' + r.status)]);
    assert.equal(early, 'started');
    assert.deepEqual(JSON.parse(prompts[0]!.input), { purpose: 'Review synthetic changes', ...input });
    assert.equal(prompts[0]!.system.includes('PRIVATE NAME'), false);
    assert.equal((await f.request('member', '/api/coach/suggest', 'POST', { stage: 'objective', context: checkpoint })).status, 429);
    // Provider requests do not hold storage locks; manual saves remain available.
    assert.equal((await f.request('member', path + '/focus', 'PUT', { ...input, version: 0 })).status, 200);
    finish!();
    const result = await pending;
    assert.equal(result.status, 200);
    assert.equal((await result.json()).goals.length, 2);
    assert.equal((await (await f.request('member', path)).json()).focus.objective, input.objective);
    assert.equal((await f.request('peer', path + '/coach', 'POST', input)).status, 404);
    assert.equal((await f.request('member', path + '/coach', 'POST', { ...input, name: 'forged context' })).status, 400);
    assert.equal((await fetch(f.origin + path + '/coach', { method: 'POST', headers: { Origin: f.origin, Authorization: 'Bearer lam_' + 'a'.repeat(43), 'Content-Type': 'application/json' }, body: JSON.stringify(input) })).status, 401);
  } finally { finish?.(); await f.close(); }
});

test('coach rejects malformed or goal-dropping output and rechecks eligibility after a provider response', async () => {
  let reply: unknown = { objective: 'Suggested', goals: ['One goal only'] };
  let suspend = false;
  const emails = new Set(['member@example.test']);
  const f = await coachingFixture({ async suggest(_system, _input, validate) {
    if (suspend) emails.clear();
    return validate(reply);
  } }, { aiMemberManagerEmails: emails });
  try {
    const member = await (await f.request('member', '/api/ai-members', 'POST', { name: 'Helper' })).json();
    const path = '/api/ai-members/' + member.id;
    const input = { objective: 'Pending', goals: ['First goal', 'Second goal'] };
    for (const invalid of [reply, { objective: 'Suggested', goals: ['First', ''] }, { objective: 'Suggested', goals: ['First', 'Second'], humanEmail: 'forbidden@example.test' }, { objective: 42, goals: [] }]) {
      reply = invalid;
      assert.equal((await f.request('member', path + '/coach', 'POST', input)).status, 503);
    }
    reply = { objective: 'Suggested', goals: ['First improved', 'Second improved'] };
    suspend = true;
    assert.equal((await f.request('member', path + '/coach', 'POST', input)).status, 403);
    emails.add('member@example.test');
    assert.equal((await (await f.request('member', path)).json()).focus, null);
  } finally { await f.close(); }
});

test('human and AI routes share the four-turn global admission and twenty-turn human quota', async () => {
  let wait = false;
  const finish: (() => void)[] = [];
  const f = await coachingFixture({ async suggest(_system, input, validate) {
    if (wait) await new Promise<void>(resolve => finish.push(resolve));
    return validate(JSON.parse(input).stage ? { objective: 'Human outcome' } : { objective: 'AI outcome', goals: ['First measurable goal'] });
  } }, { aiMemberManagerEmails: new Set(['member@example.test', 'peer@example.test', 'lead@example.test', 'outsider@example.test', 'fifth@example.test', 'sixth@example.test']) });
  try {
    for (const actor of ['fifth', 'sixth']) {
      const id = randomUUID();
      await f.admin.query('INSERT INTO users VALUES($1,$2,$3,$4)', [id, id, actor + '@example.test', actor]);
      await f.admin.query('INSERT INTO approved_emails VALUES($1)', [actor + '@example.test']);
      await f.admin.query("INSERT INTO memberships SELECT $1,department_id,'member',NULL FROM memberships WHERE user_id=$2", [id, f.ids.member]);
      await f.admin.query("INSERT INTO sessions VALUES($1,$2,now()+interval '1 hour')", [hash(actor), id]);
    }
    const paths: Record<string, string> = {};
    for (const actor of ['member', 'peer', 'lead', 'outsider', 'sixth']) {
      const member = await (await f.request(actor, '/api/ai-members', 'POST', { name: 'Helper' })).json();
      paths[actor] = '/api/ai-members/' + member.id + '/coach';
    }
    // Nineteen AI turns leave one shared human turn in this minute.
    for (let i = 0; i < 19; i++) assert.equal((await f.request('member', paths.member!, 'POST', { objective: '', goals: [] })).status, 200);
    assert.equal((await f.request('member', '/api/coach/suggest', 'POST', { stage: 'objective', context: checkpoint })).status, 200);
    assert.equal((await f.request('member', paths.member!, 'POST', { objective: '', goals: [] })).status, 429);
    wait = true;
    const pending = ['peer', 'lead', 'outsider'].map(actor => f.request(actor, paths[actor]!, 'POST', { objective: '', goals: [] }));
    pending.push(f.request('fifth', '/api/coach/suggest', 'POST', { stage: 'objective', context: checkpoint }));
    // A shared per-human lock applies regardless of which AI-member route is used.
    for (let i = 0; i < 100 && finish.length < 4; i++) await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(finish.length, 4);
    assert.equal((await f.request('sixth', paths.sixth!, 'POST', { objective: '', goals: [] })).status, 429);
    assert.equal((await f.request('peer', '/api/coach/suggest', 'POST', { stage: 'objective', context: checkpoint })).status, 429);
    finish.forEach(resolve => resolve());
    for (const response of await Promise.all(pending)) assert.equal(response.status, 200);
  } finally { finish.forEach(resolve => resolve()); await f.close(); }
});
