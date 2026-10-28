import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';
import express from 'express';
import { privilegeFixture } from '../../server/privilege-test-support.ts';
import { createCoachProvider } from '../../dist/server/coach-provider.js';
import { createApp } from '../../dist/server/app.js';
import { migrate } from '../../dist/server/schema.js';
import { runAcceptanceBrowser } from './acceptance-browser.mjs';
import { withAcceptanceFixture } from './acceptance-fixture.mjs';

async function fixture(work, { rejectFocusSave = false, rejectImageSave = false, directionDelay = 0, coach } = {}) {
  const database = await privilegeFixture();
  const server = createServer();
  try {
    await migrate(database.migration, database.roles);
    let sessions;
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const app = express();
    if (directionDelay) app.get('/api/department/direction', async (_request, _response, next) => {
      await new Promise(resolve => setTimeout(resolve, directionDelay));
      next();
    });
    if (rejectFocusSave) {
      app.post('/api/focuses', (_request, response) => response.status(503).json({ error: `Private diagnostic ${sessions.member}` }));
    }
    if (rejectImageSave) {
      app.put('/api/department/direction', express.json(), (request, response, next) => {
        if (request.body.missionImage?.startsWith('data:')) response.status(503).json({ error: 'Synthetic image persistence failure' });
        else next();
      });
    }
    app.use(createApp(database.runtime, { origin, coach }));
    app.use(express.static('dist/client'));
    server.on('request', app);
    await withAcceptanceFixture(database.migration, async fixture => {
      sessions = fixture.sessions;
      await work({ origin, ...fixture });
    });
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await database.close();
  }
}

test('deployed acceptance exercises built browser assets, persisted workflows and authorization through real PostgreSQL', { timeout: 120000 }, async () => {
  await fixture(async input => {
    const checks = await runAcceptanceBrowser(input);
    assert.deepEqual(checks, [
      'authenticated-identities',
      'department-direction',
      'mission-image',
      'focus-authoring-persistence',
      'authorization-isolation',
      'stale-and-forged-writes',
      'review-requests-and-notes', 'lead-confirmation-lock', 'coaching-disabled-manual',
      'account-and-guide',
      'browser-errors',
      'session-revocation',
    ]);
    for (const token of Object.values(input.sessions)) {
      const response = await fetch(input.origin + '/api/focuses', { headers: { Cookie: `lantern-session=${token}` } });
      assert.equal(response.status, 401, 'Each supplied session must be revoked after acceptance.');
      assert.ok(!JSON.stringify(checks).includes(token));
    }
  });
});

test('a deployed mission image persistence failure blocks acceptance', { timeout: 60000 }, async () => {
  await fixture(async input => {
    await assert.rejects(runAcceptanceBrowser(input), { message: 'Staging acceptance failed [mission-image].' });
  }, { rejectImageSave: true });
});

test('a failed deployed focus save blocks acceptance, hides private diagnostics and revokes sessions', { timeout: 60000 }, async () => {
  await fixture(async input => {
    await assert.rejects(runAcceptanceBrowser(input), error => {
      assert.equal(error.message, 'Staging acceptance failed [focus-authoring-persistence].');
      assert.equal(error.cause, undefined);
      for (const token of Object.values(input.sessions)) assert.ok(!String(error.stack).includes(token));
      return true;
    });
    for (const token of Object.values(input.sessions)) {
      const response = await fetch(input.origin + '/api/focuses', { headers: { Cookie: `lantern-session=${token}` } });
      assert.equal(response.status, 401, 'A failed journey must revoke every supplied session.');
    }
  }, { rejectFocusSave: true });
});

// Hosted latency must not make the runner submit an objective before its
// initiative choices have loaded through the real application boundary.
test('deployed acceptance waits for delayed initiative choices before editing an objective', { timeout: 120000 }, async () => {
  await fixture(async input => {
    const checks = await runAcceptanceBrowser(input);
    assert.ok(checks.includes('focus-authoring-persistence'));
  }, { directionDelay: 750 });
});

async function withProvider(work, { primaryFails = false, bothFail = false } = {}) {
  const calls = [];
  const upstream = createServer(async (request, response) => {
    let raw = '';
    for await (const chunk of request) raw += chunk;
    const body = JSON.parse(raw);
    const { stage } = JSON.parse(body.messages.at(-1).content);
    calls.push({ path: request.url, stage });
    if (bothFail || (primaryFails && request.url === '/primary/v1/messages')) {
      response.writeHead(503).end('{}'); return;
    }
    const value = stage === 'clarify'
      ? { ready: false, question: 'Who benefits from this work?', options: ['Engineers'] }
      : stage === 'objective'
        ? { objective: 'Help engineers diagnose build failures', title: 'Synthetic diagnostics', initiativeIds: [] }
        : stage === 'actions'
          ? { actions: ['Review three failed builds', 'Try clearer diagnostic messages'], suggestedDate: '2026-11-30' }
          : { goal: 'Review three failed builds by the selected date and record diagnostic steps.' };
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(request.url.startsWith('/primary')
      ? { content: [{ type: 'text', text: JSON.stringify(value) }] }
      : { choices: [{ message: { content: JSON.stringify(value) }, finish_reason: 'stop' }] }));
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${upstream.address().port}`;
  try {
    await work(createCoachProvider({
      primary: { url: origin + '/primary', key: 'synthetic-primary', model: 'coding' },
      fallback: { url: origin + '/fallback', key: 'synthetic-fallback', model: 'gemini' },
      timeoutMs: 1000, cooldownMs: 60000,
    }, () => {}), calls);
  } finally {
    upstream.closeAllConnections();
    await new Promise(resolve => upstream.close(resolve));
  }
}

for (const primaryFails of [false, true]) {
  test(`deployed coaching journey saves and submits generated work (${primaryFails ? 'fallback' : 'primary'})`, { timeout: 120000 }, async () => {
    await withProvider(async (coach, calls) => {
      await fixture(async input => {
        const checks = await runAcceptanceBrowser(input);
        assert.ok(checks.includes('coaching-enabled-journey'));
        assert.ok(!checks.includes('coaching-disabled-manual'));
        assert.ok(calls.some(call => call.stage === 'goal'));
        assert.equal(calls.some(call => call.path.startsWith('/fallback')), primaryFails);
      }, { coach });
    }, { primaryFails });
  });
}

test('a provider outage blocks enabled coaching acceptance and revokes synthetic sessions', { timeout: 120000 }, async () => {
  await withProvider(async coach => {
    await fixture(async input => {
      await assert.rejects(runAcceptanceBrowser(input), { message: 'Staging acceptance failed [coaching-enabled-journey].' });
      for (const token of Object.values(input.sessions)) {
        const response = await fetch(input.origin + '/api/focuses', { headers: { Cookie: `lantern-session=${token}` } });
        assert.equal(response.status, 401);
      }
    }, { coach });
  }, { bothFail: true });
});
