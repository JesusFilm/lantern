import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolve } from 'node:path';
import { startWorld, people } from './world.js';

test('manual fixtures explicitly exclude AI members independently of developer allowlist', async () => {
  const previous = process.env.AI_MEMBER_MANAGER_EMAILS;
  process.env.AI_MEMBER_MANAGER_EMAILS = Object.values(people).map(p => p.email).join(',');
  let world: Awaited<ReturnType<typeof startWorld>> | undefined;
  try {
    world = await startWorld(resolve('dist/client'));
    for (const persona of ['member', 'lead'] as const) {
      const response: Response = await fetch(world.origin + '/api/session', { headers: { Cookie: 'lantern-session=' + world.session(persona) } });
      assert.equal((await response.json() as { canManageAiMembers: boolean }).canManageAiMembers, false);
    }
  } finally {
    await world?.close();
    if (previous === undefined) delete process.env.AI_MEMBER_MANAGER_EMAILS;
    else process.env.AI_MEMBER_MANAGER_EMAILS = previous;
  }
});
