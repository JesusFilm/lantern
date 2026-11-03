import { chromium, webkit } from '@playwright/test';
import express from 'express';
import { resolve } from 'node:path';
import { coachingFixture } from './coach-test-support.js';

export async function aiBrowserFixture(coach?: Parameters<typeof coachingFixture>[0], eligible = true, engine: 'chromium' | 'webkit' = 'chromium') {
  const f = await coachingFixture(coach, { aiMemberManagerEmails: new Set(eligible ? ['member@example.test'] : []) });
  f.app.use(express.static(resolve('dist/client')));
  const browser = await (engine === 'webkit' ? webkit : chromium).launch();
  const context = await browser.newContext();
  await context.addCookies([{ name: 'lantern-session', value: 'member', url: f.origin }]);
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  return { ...f, page, context, async close() { await browser.close(); await f.close(); } };
}

