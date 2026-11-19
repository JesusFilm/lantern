import assert from 'node:assert/strict';
import { test } from 'node:test';
import { coachingFixture } from './coach-test-support.js';

test('daily check-ins validate supplied statuses against current owned goals and show one saved entry per day', async () => {
  const f = await coachingFixture();
  try {
    const path = '/api/weeks/2026-11-16';
    const first = await (await f.request('member', path + '/plans', 'POST', { version: 0, goals: [{ text: 'First', links: [] }, { text: 'Second', links: [] }] })).json();
    const goals = first.plans[0].goals;
    const draft = { date: '2026-11-17', body: 'Daily progress', planVersion: 1, goalStatuses: [{ goalId: goals[0].id, status: 'on-track' }, { goalId: goals[1].id, status: 'blocked' }] };
    const response = await f.request('member', path + '/updates', 'POST', draft);
    assert.equal(response.status, 201);
    const saved = await response.json();
    assert.deepEqual(saved.updates[0].goalStatuses, draft.goalStatuses);
    assert.equal(saved.updates[0].planVersion, 1);
    for (const invalid of [
      { ...draft, goalStatuses: undefined },
      { ...draft, goalStatuses: [draft.goalStatuses[0], draft.goalStatuses[0]] },
      { ...draft, goalStatuses: [{ goalId: goals[0].id, status: 'unknown' }, draft.goalStatuses[1]] },
      { ...draft, goalStatuses: [{ goalId: 'someone-elses-goal', status: 'done' }, draft.goalStatuses[1]] },
      { ...draft, userId: f.ids.peer },
    ]) assert.equal((await f.request('member', path + '/updates', 'POST', invalid)).status, 400);
    assert.equal((await f.request('peer', path + '/updates', 'POST', draft)).status, 409);
    assert.deepEqual((await (await f.request('peer', path)).json()).updates, []);
    assert.deepEqual((await (await f.request('lead', path)).json()).updates, []);
    assert.equal((await f.request('member', path + '/plans', 'POST', { version: 1, goals: goals.map((goal: { id: string; text: string }) => ({ id: goal.id, text: goal.text + ' edited', links: [] })) })).status, 201);
    assert.equal((await f.request('member', path + '/updates', 'POST', draft)).status, 409);
    const next = { ...draft, planVersion: 2, goalStatuses: draft.goalStatuses.map(item => ({ ...item, status: 'done' })) };
    assert.equal((await f.request('member', path + '/updates', 'POST', next)).status, 201);
    const record = await (await f.request('member', path)).json();
    assert.equal(record.updates.length, 1);
    assert.deepEqual(record.updates[0].goalStatuses, next.goalStatuses);
    assert.equal(record.updates[0].planVersion, 2);
    const followingDay = await f.request('member', path + '/updates', 'POST', { ...next, date: '2026-11-18', body: 'Next day' });
    const days = (await followingDay.json()).updates;
    assert.equal(days.length, 2);
    assert.deepEqual(days[0], record.updates[0]);
    assert.equal(days[1].date, '2026-11-18');
  } finally { await f.close(); }
});

test('partial daily updates save text, individual statuses and cleared text independently', async () => {
  const f = await coachingFixture();
  try {
    const path = '/api/weeks/2026-11-16';
    const plan = await (await f.request('member', path + '/plans', 'POST', { version: 0, goals: [{ text: 'Ship it', links: [] }, { text: 'Follow up', links: [] }] })).json();
    const base = { date: '2026-11-17', planVersion: 1, body: '', goalStatuses: [] };
    const flags = [{ goalId: plan.plans[0].goals[0].id, status: 'at-risk' }];
    for (const draft of [{ ...base, body: 'Still writing' }, { ...base, goalStatuses: flags }, { ...base }]) {
      const response = await f.request('member', path + '/updates', 'POST', draft);
      assert.equal(response.status, 201);
      const entries = (await response.json()).updates;
      assert.equal(entries.length, 1);
      const saved = entries[0];
      assert.equal(saved.body, draft.body);
      assert.deepEqual(saved.goalStatuses, draft.goalStatuses);
    }
    assert.deepEqual((await (await f.request('peer', path)).json()).updates, []);
  } finally { await f.close(); }
});
