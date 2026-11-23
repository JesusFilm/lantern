import { Router, type Request } from 'express';
import type { Pool } from 'pg';
import { featureEnabled, requireFeature, type FeatureConfig } from './features.js';
import { AccessError } from './membership.js';
import type { DailyGoalStatus, WeeklyGoalDraft, WeeklyGoalLinkDraft } from '../shared/weekly.js';
import { dailyGoalStatuses, maxWeeklyGoalDescriptionLength } from '../shared/weekly.js';
import { weeklyStore } from './weekly.js';

function date(value: unknown): value is string {
  return typeof value === 'string' && /^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
function object(value: unknown, keys: string[]): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key)))
    throw new AccessError(400, 'Supply only the weekly plan or update fields.');
}
function goalLink(value: unknown): WeeklyGoalLinkDraft {
  object(value, ['kind', 'focusId', 'label', 'url', 'target']);
  if (value.kind === 'focus') {
    object(value, ['kind', 'focusId', 'target']);
    if (typeof value.focusId !== 'string' || !value.focusId || value.focusId.length > 100)
      throw new AccessError(400, 'Choose a position focus.');
    let target: import('../shared/weekly.js').FocusWorkTarget | undefined;
    if (value.target !== undefined) {
      object(value.target,['version','section','goal']);
      const t=value.target;
      if(!Number.isSafeInteger(t.version)||Number(t.version)<1||!Number.isSafeInteger(t.section)||Number(t.section)<0||t.goal!==null&&(!Number.isSafeInteger(t.goal)||Number(t.goal)<0))throw new AccessError(400,'Choose an objective or SMART goal.');
      target={version:Number(t.version),section:Number(t.section),goal:t.goal===null?null:Number(t.goal)};
    }
    return { kind: 'focus', focusId: value.focusId, ...(target?{target}:{}) };
  }
  object(value, ['kind', 'label', 'url']);
  if (value.kind !== 'project' && value.kind !== 'repository' && value.kind !== 'issue' && value.kind !== 'other')
    throw new AccessError(400, 'Choose a supported work link type.');
  if (typeof value.label !== 'string' || !value.label.trim() || value.label.trim().length > 200)
    throw new AccessError(400, 'Name each work link using 1–200 characters.');
  if (typeof value.url !== 'string' || value.url.length > 2048)
    throw new AccessError(400, 'Enter an HTTP or HTTPS work link.');
  let url: URL;
  try { url = new URL(value.url); } catch { throw new AccessError(400, 'Enter an HTTP or HTTPS work link.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
    throw new AccessError(400, 'Enter an HTTP or HTTPS work link without credentials.');
  return { kind: value.kind, label: value.label.trim(), url: url.href };
}
function goalDraft(value: unknown): WeeklyGoalDraft {
  object(value, ['id', 'text', 'description', 'links', 'completed', 'visibility']);
  if (value.visibility !== undefined && (typeof value.visibility !== 'string' || !['team','lead','private'].includes(value.visibility))) throw new AccessError(400, 'Choose who can see this goal.');
  if (value.description !== undefined && (typeof value.description !== 'string' || value.description.length > maxWeeklyGoalDescriptionLength))
    throw new AccessError(400, 'Goal descriptions must be Markdown text of up to 20,000 characters.');
  if (value.completed !== undefined && typeof value.completed !== 'boolean')
    throw new AccessError(400, 'Goal completion must be true or false.');
  if (typeof value.text !== 'string' || !value.text.trim() || value.text.trim().length > 1000)
    throw new AccessError(400, 'Enter 1–10 weekly goals, each between 1 and 1,000 characters.');
  if (value.id !== undefined && (typeof value.id !== 'string' || !value.id || value.id.length > 100))
    throw new AccessError(400, 'Supply a valid weekly goal.');
  if (!Array.isArray(value.links) || value.links.length > 5)
    throw new AccessError(400, 'Add up to five work links per weekly goal.');
  return { ...(typeof value.id === 'string' ? { id: value.id } : {}), text: value.text.trim(), ...(value.visibility !== undefined ? {visibility: value.visibility as import('../shared/weekly.js').GoalVisibility} : {}),
    ...(typeof value.description === 'string' ? { description: value.description } : {}),
    ...(typeof value.completed === 'boolean' ? { completed: value.completed } : {}), links: value.links.map(goalLink) };
}
export function weeklyRoutes(db: Pool, requireUser: (request: Request) => Promise<{ id: string; email: string }>, features: FeatureConfig) {
  const router = Router(), store = weeklyStore(db);
  async function owner(req: Request) {
    const user = await requireUser(req);
    const week = String(req.params.week);
    if (!date(week) || new Date(week).getUTCDay() !== 1) throw new AccessError(400, 'Choose a week starting on Monday.');
    return { id: user.id, week };
  }
  router.get('/api/focuses/:id/weekly-work',async(req,res)=>{
    const user=await requireUser(req);requireFeature(features,'weekly-focus-links',user.email);
    res.json(await store.linkedWork(user.id,String(req.params.id)));
  });
  router.get('/api/weeks', async (req, res) => {
    const user = await requireUser(req);
    res.json(await store.range(user.id));
  });
  router.get('/api/weeks/:week', async (req, res) => {
    const { id, week } = await owner(req);
    res.json(await store.get(id, week));
  });
  router.post('/api/weeks/:week/plans', async (req, res) => {
    const { id, week } = await owner(req), body: unknown = req.body;
    object(body, ['version', 'goals']);
    if (!Number.isSafeInteger(body.version) || Number(body.version) < 0)
      throw new AccessError(400, 'Supply the current weekly plan version.');
    if (!Array.isArray(body.goals) || body.goals.length < 1 || body.goals.length > 10)
      throw new AccessError(400, 'Enter 1–10 weekly goals, each between 1 and 1,000 characters.');
    const goals = body.goals.map(goalDraft);
    const user = await requireUser(req);
    if (!featureEnabled(features, 'weekly-focus-links', user.email) && goals.some(goal => goal.links.some(link => link.kind === 'focus' && link.target))) {
      const saved = (await store.get(id, week)).plans.at(-1);
      for (const goal of goals) for (const link of goal.links) {
        if (link.kind !== 'focus' || !link.target) continue;
        const existing = saved?.goals.find(item => item.id === goal.id)?.links.some(item => item.kind === 'focus' && item.focusId === link.focusId && item.target?.version === link.target!.version && item.target?.section === link.target!.section && item.target?.goal === link.target!.goal);
        if (!existing) requireFeature(features, 'weekly-focus-links', user.email);
      }
    }
    if (body.goals.some(value => value && typeof value === 'object' && 'visibility' in value)) requireFeature(features,'weekly-goal-privacy',(await requireUser(req)).email);
    res.status(201).json(await store.savePlan(id, week, { version: Number(body.version), goals }));
  });
  router.post('/api/weeks/:week/updates', async (req, res) => {
    const { id, week } = await owner(req), body: unknown = req.body;
    object(body, ['date', 'body', 'planVersion', 'goalStatuses']);
    if (!date(body.date) || body.date < week || Date.parse(body.date) - Date.parse(week) >= 7 * 86400000)
      throw new AccessError(400, 'Choose an update date within this week.');
    if (typeof body.body !== 'string' || body.body.length > 4000)
      throw new AccessError(400, 'Enter an update of up to 4,000 characters.');
    if (!Number.isSafeInteger(body.planVersion) || Number(body.planVersion) < 0)
      throw new AccessError(400, 'Supply the weekly plan for this check-in.');
    if (!Array.isArray(body.goalStatuses) || body.goalStatuses.length > 10)
      throw new AccessError(400, 'Choose a status for every goal.');
    const goalStatuses: DailyGoalStatus[] = body.goalStatuses.map(value => {
      object(value, ['goalId', 'status']);
      if (typeof value.goalId !== 'string' || !value.goalId || value.goalId.length > 100 || !dailyGoalStatuses.some(status => status === value.status))
        throw new AccessError(400, 'Choose a valid goal and status.');
      return { goalId: value.goalId, status: value.status as DailyGoalStatus['status'] };
    });
    res.status(201).json(await store.addUpdate(id, week, { date: body.date, body: body.body, planVersion: Number(body.planVersion), goalStatuses }));
  });
  return router;
}
