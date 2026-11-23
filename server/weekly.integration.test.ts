import assert from 'node:assert/strict';
import { test } from 'node:test';
import { coachingFixture } from './coach-test-support.js';
import { resolveFeatureConfig } from './features.js';
import type { WeeklyGoal } from '../shared/weekly.js';
import { removeMember } from './membership.js';

const goalDrafts = (...texts: string[]) => texts.map(text => ({ text, links: [] }));

test('a member saves weekly goals and dated updates, then reopens their original plan and changes', async () => {
  const f = await coachingFixture();
  try {
    const path = '/api/weeks/2026-11-16';
    const empty = await f.request('member', path);
    assert.equal(empty.status, 200);
    assert.deepEqual(await empty.json(), { week: '2026-11-16', plans: [], updates: [] });
    const saved = await f.request('member', path + '/plans', 'POST', { version: 0, goals: goalDrafts('Try sign-in with three people', 'Investigate upload delays') });
    assert.equal(saved.status, 201);
    const first = await saved.json();
    assert.equal(first.plans[0].version, 1);
    assert.deepEqual(first.plans[0].goals.map((goal: WeeklyGoal) => goal.text), ['Try sign-in with three people', 'Investigate upload delays']);
    assert.ok(first.plans[0].createdAt);
    const updated = await f.request('member', path + '/updates', 'POST', { date: '2026-11-17', body: 'Two sessions done. Need help with the upload trace.', planVersion: 1, goalStatuses: first.plans[0].goals.map((goal: WeeklyGoal) => ({ goalId: goal.id, status: 'on-track' })) });
    assert.equal(updated.status, 201);
    const record = await updated.json();
    assert.equal(record.updates[0].date, '2026-11-17');
    assert.equal(record.updates[0].body, 'Two sessions done. Need help with the upload trace.');
    assert.equal(record.updates[0].planVersion, 1);
    const changed = await f.request('member', path + '/plans', 'POST', { version: 1, goals: goalDrafts('Complete the third sign-in session') });
    assert.equal(changed.status, 201);
    const history = await changed.json();
    assert.deepEqual(history.plans[0], first.plans[0]);
    assert.deepEqual(history.plans[1].goals.map((goal: WeeklyGoal) => goal.text), ['Complete the third sign-in session']);
    assert.deepEqual(history.updates, record.updates);
    assert.deepEqual(await (await f.request('member', path)).json(), history);
    assert.deepEqual(await (await f.request('member', '/api/weeks/2026-11-23')).json(), { week: '2026-11-23', plans: [], updates: [] });
  } finally { await f.close(); }
});

test('weekly plans reject invalid and stale writes and isolate every member including career leads', async () => {
  const f = await coachingFixture();
  try {
    const path = '/api/weeks/2026-11-16';
    assert.equal((await f.request('missing', path)).status, 401);
    for (const week of ['2026-11-17', '2026-02-30', 'not-a-date']) assert.equal((await f.request('member', '/api/weeks/' + week)).status, 400);
    assert.equal((await f.request('member', path + '/updates', 'POST', { date: '2026-11-17', body: 'Too early', planVersion: 0, goalStatuses: [] })).status, 409);
    const draft = { version: 0, goals: goalDrafts('  First goal  ') };
    for (const body of [null, [], {}, { ...draft, userId: f.ids.peer }, { ...draft, departmentId: 'forged' }, { ...draft, role: 'career-lead' },
      { ...draft, goals: ['Text-only goal'] }, { ...draft, goals: [] }, { ...draft, goals: goalDrafts(' ') }, { ...draft, goals: [3] }, { ...draft, goals: goalDrafts('x'.repeat(1001)) },
      { ...draft, goals: Array(11).fill({ text: 'Goal', links: [] }) }, { ...draft, version: -1 }, { ...draft, version: 0.5 }]) {
      assert.equal((await f.request('member', path + '/plans', 'POST', body)).status, 400);
    }
    const attempts = await Promise.all([f.request('member', path + '/plans', 'POST', draft), f.request('member', path + '/plans', 'POST', draft)]);
    assert.deepEqual(attempts.map(r => r.status).sort(), [201, 409]);
    const saved = await (await f.request('member', path)).json();
    assert.deepEqual(saved.plans[0].goals.map((goal: WeeklyGoal) => goal.text), ['First goal']);
    for (const body of [{ date: '2026-11-15', body: 'Outside' }, { date: '2026-11-23', body: 'Outside' }, { date: '2026-02-30', body: 'Invalid' },
      { date: '2026-11-17', body: '' }, { date: '2026-11-17', body: 'x'.repeat(4001) }, { date: '2026-11-17', body: 'Forged', userId: f.ids.peer }]) {
      assert.equal((await f.request('member', path + '/updates', 'POST', body)).status, 400);
    }
    assert.deepEqual(await (await f.request('member', path)).json(), saved);
    for (const actor of ['peer', 'lead', 'outsider']) {
      assert.deepEqual(await (await f.request(actor, path)).json(), { week: '2026-11-16', plans: [], updates: [] });
      assert.equal((await f.request(actor, path + '/plans', 'POST', { version: 0, goals: goalDrafts(actor + ' own goal') })).status, 201);
    }
    assert.deepEqual(await (await f.request('member', path)).json(), saved);
    const foreign = await fetch(f.origin + path + '/plans', { method: 'POST', headers: { Origin: 'https://foreign.test', Cookie: 'lantern-session=member', 'Content-Type': 'application/json' }, body: JSON.stringify({ version: 1, goals: goalDrafts('Must not save') }) });
    assert.equal(foreign.status, 403);
    await removeMember(f.admin, f.ids.member);
    assert.equal((await f.request('member', path)).status, 403);
    assert.equal((await f.request('member', path + '/plans', 'POST', { version: 1, goals: goalDrafts('Must not save') })).status, 403);
    assert.equal((await f.request('member', path + '/updates', 'POST', { date: '2026-11-17', body: 'Must not save', planVersion: 1, goalStatuses: saved.plans[0].goals.map((goal: WeeklyGoal) => ({ goalId: goal.id, status: 'on-track' })) })).status, 403);
    // Fixture-only restoration proves membership removal retained the original record.
    await f.admin.query('UPDATE memberships SET deleted_at=NULL WHERE user_id=$1', [f.ids.member]);
    assert.deepEqual(await (await f.request('member', path)).json(), saved);
    await assert.rejects(f.runtime.query('DELETE FROM weekly_plans'), { code: '42501' });
    await assert.rejects(f.runtime.query('UPDATE daily_updates SET body=$1', ['Must not change']), { code: '42501' });
  } finally { await f.close(); }
});

test('the weekly feature is hidden by default and preview follows server-resolved identity', async () => {
  for (const setting of [undefined, 'weekly-updates=preview']) {
    const f = await coachingFixture(undefined, setting ? resolveFeatureConfig({ LANTERN_FEATURES: setting, LANTERN_PREVIEW_EMAILS: 'member@example.test' }, 'production') : undefined, { defaultFeatures: false });
    try {
      for (const actor of ['member', 'peer']) {
        const visible = setting && actor === 'member';
        assert.equal((await f.request(actor, '/api/weeks/2026-11-16')).status, visible ? 200 : 404);
        assert.equal((await f.request(actor, '/api/weeks/2026-11-16/plans', 'POST', { version: 0, goals: goalDrafts('A goal') })).status, visible ? 201 : 404);
        const record = await (await f.request(actor, '/api/weeks/2026-11-16')).json();
        assert.equal((await f.request(actor, '/api/weeks/2026-11-16/updates', 'POST', { date: '2026-11-17', body: 'An update', planVersion: 1, goalStatuses: record.plans?.[0]?.goals.map((goal: WeeklyGoal) => ({ goalId: goal.id, status: 'on-track' })) ?? [] })).status, visible ? 201 : 404);
      }
    } finally { await f.close(); }
  }
});

test('weekly goals retain typed work links and stable identity through edits without trusting foreign focuses', async () => {
  const f = await coachingFixture();
  try {
    const draft = { title: 'Engineering focus', start: '2026-01-01', end: '2026-12-31', sections: [] };
    const focus = await (await f.request('member', '/api/focuses', 'POST', draft)).json();
    const peer = await (await f.request('peer', '/api/focuses', 'POST', draft)).json();
    const outsider = await (await f.request('outsider', '/api/focuses', 'POST', draft)).json();
    const path = '/api/weeks/2026-11-16';
    const links = [
      { kind: 'focus', focusId: focus.id },
      { kind: 'project', label: 'Launch', url: 'https://projects.example.test/launch' },
      { kind: 'repository', label: 'Lantern', url: 'https://github.com/example/lantern' },
      { kind: 'issue', label: 'Fix sign-in', url: 'https://github.com/example/lantern/issues/42' },
    ];
    const saved = await f.request('member', path + '/plans', 'POST', { version: 0, goals: [{ text: 'Ship sign-in', links }] });
    assert.equal(saved.status, 201);
    const first = await saved.json();
    const goal = first.plans[0].goals[0];
    assert.ok(goal.id);
    assert.equal(goal.text, 'Ship sign-in');
    assert.deepEqual(goal.links, [{ ...links[0], title: 'Engineering focus' }, ...links.slice(1)]);
    const changed = await f.request('member', path + '/plans', 'POST', { version: 1, goals: [{ id: goal.id, text: 'Ship and verify sign-in', links: [links[3]] }] });
    assert.equal(changed.status, 201);
    const history = await (await f.request('member', path)).json();
    assert.deepEqual(history.plans[0], first.plans[0]);
    assert.equal(history.plans[1].goals[0].id, goal.id);
    assert.deepEqual(history.plans[1].goals[0].links, [links[3]]);
    for (const invalid of [
      [{ kind: 'focus', focusId: peer.id }], [{ kind: 'focus', focusId: outsider.id }],
      [{ kind: 'focus', focusId: 'missing' }], [{ kind: 'focus', focusId: focus.id, title: 'Forged' }],
      [{ kind: 'issue', label: 'Unsafe', url: 'javascript:alert(1)' }],
      [{ kind: 'repository', label: 'Secret', url: 'https://user:password@example.test/repo' }],
      [{ kind: 'unknown', label: 'Unknown', url: 'https://example.test' }],
      [{ kind: 'project', label: '', url: 'https://example.test' }], Array(6).fill(links[3]),
    ]) {
      const response = await f.request('member', path + '/plans', 'POST', { version: 2, goals: [{ id: goal.id, text: 'Must not save', links: invalid }] });
      assert.ok([400, 404].includes(response.status), 'invalid links rejected');
    }
    for (const goals of [[{ id: peer.id, text: 'Forged identity', links: [] }], [{ id: goal.id, text: 'Duplicate', links: [] }, { id: goal.id, text: 'Duplicate', links: [] }]]) {
      assert.equal((await f.request('member', path + '/plans', 'POST', { version: 2, goals })).status, 400);
    }
    assert.deepEqual(await (await f.request('member', path)).json(), history);
    assert.deepEqual((await (await f.request('peer', path)).json()).plans, []);
  } finally { await f.close(); }
});

test('weekly work targets a saved objective or SMART goal with trusted labels and privacy-filtered backlinks', async t => {
  const f = await coachingFixture(); t.after(() => f.close());
  const draft = { title: 'Testing focus', start: '2026-01-01', end: '2026-12-31', sections: [{ kind: 'normal', objective: 'Improve release confidence', goals: ['Smoke test the apps'] }] };
  const created = await (await f.request('member', '/api/focuses', 'POST', draft)).json();
  await f.request('member', '/api/coach/focuses/' + created.id + '/request', 'POST', {version: created.version});
  const focus = (await (await f.request('lead', '/api/coach/focuses/' + created.id + '/confirm', 'POST', {version: created.version})).json()).focus;
  const target = { version: focus.version, section: 0, goal: 0 };
  const path = '/api/weeks/2026-11-23';
  const saved = await f.request('member', path + '/plans', 'POST', { version: 0, goals: [{ text: 'Run the smoke test', links: [{ kind: 'focus', focusId: focus.id, target }] }] });
  assert.equal(saved.status, 201);
  const goal = (await saved.json()).plans.at(-1).goals[0];
  assert.deepEqual(goal.links[0].target, { ...target, objective: 'Improve release confidence', goalText: 'Smoke test the apps' });
  const backlinks = await f.request('member', `/api/focuses/${focus.id}/weekly-work`);
  assert.equal(backlinks.status, 200);
  assert.equal((await backlinks.json()).items[0].goal.text, 'Run the smoke test');
  for (const actor of ['peer', 'outsider']) assert.equal((await f.request(actor, `/api/focuses/${focus.id}/weekly-work`)).status, 404);
  assert.equal((await f.request('member', path + '/plans', 'POST', { version: 1, goals: [{ id: goal.id, text: goal.text, links: [{ kind: 'focus', focusId: focus.id, target: { ...target, section: 50 } }] }] })).status, 400);
  assert.equal((await f.request('member', path + '/plans', 'POST', { version: 1, goals: [{ id: goal.id, text: goal.text, links: [{ kind: 'focus', focusId: focus.id, target: { ...target, goalText: 'Forged' } }] }] })).status, 400);
  const leadView=await f.request('lead', `/api/focuses/${focus.id}/weekly-work`);assert.equal(leadView.status,200);assert.equal((await leadView.json()).items.length,1);
  await f.request('member',path+'/plans','POST',{version:1,goals:[{id:goal.id,text:goal.text,visibility:'private',links:[{kind:'focus',focusId:focus.id,target}]}]});
  assert.deepEqual((await(await f.request('lead', `/api/focuses/${focus.id}/weekly-work`)).json()).items,[]);
  const unknown = await f.request('member', path + '/plans', 'POST', { version: 2, goals: [{ id: goal.id, text: goal.text, links: [{ kind: 'focus', focusId: focus.id, target: { ...target, version: 9 } }] }] });
  assert.equal(unknown.status, 409);
});

test('hidden focus targets reject new targeting but keep existing targeted links editable',async t=>{
 const config=resolveFeatureConfig({},'local'),states=new Map(config.states);
 const f=await coachingFixture(undefined,{...config,states});t.after(()=>f.close());
 const draft={title:'Locked targets',start:'2026-01-01',end:'2026-12-31',sections:[{kind:'normal',objective:'Test releases',goals:['Smoke apps']}]};
 const focus=await(await f.request('member','/api/focuses','POST',draft)).json();
 await f.request('member','/api/coach/focuses/'+focus.id+'/request','POST',{version:focus.version});const confirmed=await(await f.request('lead','/api/coach/focuses/'+focus.id+'/confirm','POST',{version:focus.version})).json();
 const link={kind:'focus',focusId:focus.id,target:{version:confirmed.focus.version,section:0,goal:0}},path='/api/weeks/2026-11-23';
 const first=await(await f.request('member',path+'/plans','POST',{version:0,goals:[{text:'Smoke',links:[link]}]})).json();
 states.set('weekly-focus-links','off');
 assert.equal((await f.request('member','/api/focuses/'+focus.id+'/weekly-work')).status,404);
 assert.equal((await f.request('member',path+'/plans','POST',{version:1,goals:[{id:first.plans[0].goals[0].id,text:'Smoke again',links:[link]}]})).status,201);
 assert.equal((await f.request('member','/api/weeks/2026-11-30/plans','POST',{version:0,goals:[{text:'New target',links:[link]}]})).status,404);
});
