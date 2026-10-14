import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createTicketBoardApp } from './app.js';
import { parseTicket, loadTickets } from './tickets.js';

async function withTracker(run: (repository: string, issues: string) => Promise<void>) {
  const repository = await mkdtemp(join(tmpdir(), 'career-lead-tickets-'));
  const issues = join(repository, '.scratch', 'catch-ups', 'issues');
  await mkdir(issues, { recursive: true });
  try { await run(repository, issues); }
  finally { await rm(repository, { recursive: true, force: true }); }
}

test('skills-format metadata is separate from rendered content and code', async () => {
  await withTracker(async (repository, issues) => {
    const path = join(issues, '01-shared-record.md');
    await writeFile(path, '# 01: Shared record\n\n**What to build:** Review a shared record.\n\n**Blocked by:** None (can start immediately).\n\n**Status:** ready-for-agent\n\n- [ ] Review the record together\n\n## Comments\n\nKeep this discussion.\n\n```\nStatus: literal code\n```');
    const ticket = await parseTicket(path, repository);
    assert.equal(ticket.title, '01: Shared record');
    assert.equal(ticket.id, 'catch-ups/01');
    assert.equal(ticket.metadata.Status, 'ready-for-agent');
    assert.equal(ticket.metadata['Blocked by'], 'None (can start immediately).');
    assert.doesNotMatch(ticket.bodyHtml, /ready-for-agent/);
    assert.match(ticket.bodyHtml, /<strong>What to build:<\/strong>/);
    assert.match(ticket.bodyHtml, /Keep this discussion\./);
    assert.match(ticket.bodyHtml, /<pre><code>Status: literal code<\/code><\/pre>/);
  });
});

test('metadata headers preserve additional fields while escaping HTML', async () => {
  await withTracker(async (repository, issues) => {
    const path = join(issues, '02-focus.md');
    await writeFile(path, '---\nTitle: Focus\nStatus: needs-info\nOwner: Reviewer\n---\n## Details\n\n**Useful** context. <script>bad</script>');
    const ticket = await parseTicket(path, repository);
    assert.equal(ticket.metadata.Owner, 'Reviewer');
    assert.match(ticket.bodyHtml, /<strong>Useful<\/strong>/);
    assert.doesNotMatch(ticket.bodyHtml, /<script>bad/);
    assert.match(ticket.bodyHtml, /&lt;script&gt;bad/);
  });
});

test('missing tracker is empty', async () => {
  const repository = await mkdtemp(join(tmpdir(), 'career-lead-empty-'));
  try { assert.deepEqual(await loadTickets(repository), { tickets: [] }); }
  finally { await rm(repository, { recursive: true, force: true }); }
});

test('HTTP requests discover additions, edits and deletions without rebuilding HTML', async () => {
  await withTracker(async (repository, issues) => {
    const server = createServer(createTicketBoardApp(repository));
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const base = 'http://127.0.0.1:' + address.port;
    async function get() {
      const response = await fetch(base + '/api/tickets');
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal(response.headers.get('etag'), null);
      return response.json();
    }
    try {
      assert.deepEqual(await get(), { tickets: [] });
      const page = await fetch(base);
      assert.equal(page.status, 200);
      assert.match(await page.text(), /No milestones or tickets yet/);
      const path = join(issues, '01-new.md');
      await writeFile(path, '# New ticket\n\n**Status:** needs-info\n\nFirst description.');
      const first = await get();
      assert.ok(first && typeof first === 'object' && 'tickets' in first && Array.isArray(first.tickets));
      assert.equal(first.tickets.length, 1);
      assert.equal(first.tickets[0].status, 'needs-info');
      await writeFile(path, '# Updated title\n\n**Status:** ready-for-agent\n\nUpdated description.');
      const updated = await get();
      assert.ok(updated && typeof updated === 'object' && 'tickets' in updated && Array.isArray(updated.tickets));
      assert.equal(updated.tickets[0].title, 'Updated title');
      assert.equal(updated.tickets[0].status, 'ready-for-agent');
      assert.match(updated.tickets[0].bodyHtml, /Updated description/);
      await rm(path);
      assert.deepEqual(await get(), { tickets: [] });
      assert.equal((await fetch(base + '/.env')).status, 404);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});


test('milestone classification is explicit and maps/specs do not become duplicate cards', async () => {
  await withTracker(async (repository, issues) => {
    const feature = join(issues, '..');
    await writeFile(join(feature, 'milestone.md'), 'Kind: milestone\nID: M01\nTitle: Understand current work\nStatus: needs-info\nSequence: 1\nTarget: October 2026\nSummary: Prepare useful conversations.\n\n---\n## Outcome\n\nAn understood position focus.');
    await writeFile(join(feature, 'map.md'), '# Planning questions');
    await writeFile(join(feature, 'spec.md'), '# Specification');
    await writeFile(join(issues, '01-record.md'), '# Save a conversation\n\n**Status:** ready-for-agent\n\n**Milestone:** M01\n\n- [ ] Record the conversation');
    const { tickets } = await loadTickets(repository);
    assert.equal(tickets.length, 2);
    const milestone = tickets[0];
    const child = tickets[1];
    assert.ok(milestone && child);
    assert.equal(milestone.kind, 'milestone');
    assert.equal(milestone.status, 'needs-info');
    assert.equal(milestone.id, 'M01');
    assert.equal(milestone.slice, 'Catch ups');
    assert.equal(child.kind, 'ticket');
    assert.equal(child.metadata.Milestone, 'M01');
    assert.doesNotMatch(child.bodyHtml, /Milestone/);
  });
});

test('milestones require their declared kind and live outside the implementation queue', async () => {
  await withTracker(async (repository, issues) => {
    const path = join(issues, '..', 'milestone.md');
    await writeFile(path, '# Unclassified outcome');
    await assert.rejects(loadTickets(repository), /requires Kind: milestone/);
    await rm(path);
    await writeFile(join(issues, '01-outcome.md'), 'Kind: milestone\nTitle: Wrong location\n\n---\nAn outcome.');
    await assert.rejects(loadTickets(repository), /outside issues/);
  });
});

test('milestones sort by declared sequence independently of folder names', async () => {
  await withTracker(async (repository, issues) => {
    await writeFile(join(issues, '..', 'milestone.md'), 'Kind: milestone\nID: M02\nSequence: 2\n\n---\n# Second outcome');
    const other = join(repository, '.scratch', 'z-last-folder');
    await mkdir(other);
    await writeFile(join(other, 'milestone.md'), 'Kind: milestone\nID: M01\nSequence: 1\n\n---\n# First outcome');
    assert.deepEqual((await loadTickets(repository)).tickets.map(item => item.id), ['M01', 'M02']);
  });
});

test('milestone progress is independent of ticket readiness and permits skipped or revisited stages', async () => {
  await withTracker(async (repository, issues) => {
    const path = join(issues, '..', 'milestone.md');
    await writeFile(join(issues, '01-ready.md'), '# Implement\n\n**Status:** ready-for-agent');
    // Includes skipping Learn, reopening, and closure after failed verification/rollback.
    for (const stage of ['Planning', 'Specification', 'Delivery', 'Verify', 'Complete', 'Delivery', 'Verify', 'Learn', 'Complete']) {
      await writeFile(path, `Kind: milestone\nStatus: ${stage}\n\n---\n# Outcome\n\nVerification can fail; record rollback and lessons here.`);
      const { tickets } = await loadTickets(repository);
      assert.equal(tickets[0]?.status, stage);
      assert.equal(tickets[1]?.status, 'ready-for-agent');
    }
    await writeFile(path, 'Kind: milestone\n\n---\n# New outcome');
    assert.equal((await loadTickets(repository)).tickets[0]?.status, 'Planning');
  });
});
