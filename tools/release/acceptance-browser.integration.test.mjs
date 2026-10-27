import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';
import express from 'express';
import { privilegeFixture } from '../../server/privilege-test-support.ts';
import { createApp } from '../../dist/server/app.js';
import { migrate } from '../../dist/server/schema.js';
import { runAcceptanceBrowser } from './acceptance-browser.mjs';
import { withAcceptanceFixture } from './acceptance-fixture.mjs';

async function fixture(work, { rejectFocusSave = false, rejectImageSave = false, directionDelay = 0 } = {}) {
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
    app.use(createApp(database.runtime, { origin }));
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
      'review-requests-and-notes', 'lead-confirmation-lock',
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
