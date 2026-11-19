import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { DailyUpdate, DailyUpdateDraft, WeekRecord, WeeklyPlan, WeeklyPlanDraft, WeeklyGoal, WeeklyRange } from '../shared/weekly.js';
import { readOwnedFocus } from './focus.js';
import { AccessError, membership, membershipWrite } from './membership.js';

/** Each operation rechecks active membership under the same lock as membership changes. */
export function weeklyStore(db: Pool) {
  async function owned<T>(userId: string, work: (client: PoolClient, departmentId: string) => Promise<T>) {
    return membershipWrite(db, async client => {
      const department = await membership(client, userId);
      if (!department) throw new AccessError(403, 'Active department membership is required.');
      return work(client, department.id);
    });
  }
  async function read(client: PoolClient, userId: string, departmentId: string, week: string): Promise<WeekRecord> {
    const keys = [userId, departmentId, week];
    const plans = await client.query<WeeklyPlan>(`SELECT version, goals, created_at AS "createdAt" FROM weekly_plans
      WHERE user_id=$1 AND department_id=$2 AND week_start=$3 ORDER BY version`, keys);
    // Rows retain immutable revisions; the week exposes one current entry per day.
    const updates = await client.query<DailyUpdate>(`SELECT DISTINCT ON (update_date) id, to_char(update_date,'YYYY-MM-DD') AS date, body,
      plan_version AS "planVersion", goal_statuses AS "goalStatuses", created_at AS "createdAt" FROM daily_updates
      WHERE user_id=$1 AND department_id=$2 AND week_start=$3 ORDER BY update_date,created_at DESC,id DESC`, keys);
    return { week, plans: plans.rows, updates: updates.rows };
  }
  return {
    range: (userId: string) => owned(userId, async (client, department) => {
      const result = await client.query<WeeklyRange>(`SELECT to_char(min(week_start),'YYYY-MM-DD') AS "firstWeek"
        FROM weekly_plans WHERE user_id=$1 AND department_id=$2`, [userId, department]);
      return result.rows[0]!;
    }),
    get: (userId: string, week: string) => owned(userId, (client, department) => read(client, userId, department, week)),
    savePlan: (userId: string, week: string, draft: WeeklyPlanDraft) => owned(userId, async (client, department) => {
      const previous = await read(client, userId, department, week);
      const current = previous.plans.at(-1)?.version ?? 0;
      if (draft.version !== current) throw new AccessError(409, 'Your weekly plan changed in another window. Your edits are still here; reload the saved week before trying again.');
      const existing = new Set(previous.plans.at(-1)?.goals.map(goal => goal.id));
      const used = new Set<string>();
      const goals: WeeklyGoal[] = [];
      for (const goal of draft.goals) {
        if (goal.id && (!existing.has(goal.id) || used.has(goal.id)))
          throw new AccessError(400, 'Choose each existing weekly goal only once.');
        const id = goal.id ?? randomUUID(); used.add(id);
        const links: WeeklyGoal['links'] = [];
        for (const link of goal.links) {
          if (link.kind === 'focus') {
            const focus = await readOwnedFocus(client, userId, department, link.focusId);
            links.push({ kind: 'focus', focusId: focus.id, title: focus.title });
          } else links.push(link);
        }
        goals.push({ id, text: goal.text, ...(goal.description !== undefined ? { description: goal.description } : {}),
          ...(goal.completed !== undefined ? { completed: goal.completed } : {}), links });
      }
      await client.query(`INSERT INTO weekly_plans(user_id,department_id,week_start,version,goals) VALUES($1,$2,$3,$4,$5)`,
        [userId, department, week, current + 1, JSON.stringify(goals)]);
      return read(client, userId, department, week);
    }),
    addUpdate: (userId: string, week: string, draft: DailyUpdateDraft) => owned(userId, async (client, department) => {
      const current = (await read(client, userId, department, week)).plans.at(-1);
      if (!current) throw new AccessError(409, 'Save your weekly goals before adding an update.');
      if (draft.planVersion !== current.version) throw new AccessError(409, 'Your weekly goals changed. Reload the saved week and check their statuses before posting.');
      const supplied = new Map(draft.goalStatuses.map(item => [item.goalId, item.status]));
      if (supplied.size !== draft.goalStatuses.length || draft.goalStatuses.some(item => !current.goals.some(goal => goal.id === item.goalId)))
        throw new AccessError(400, 'Choose each current weekly goal only once.');
      const goalStatuses = current.goals.filter(goal => supplied.has(goal.id)).map(goal => ({ goalId: goal.id, status: supplied.get(goal.id)! }));
      await client.query(`INSERT INTO daily_updates(id,user_id,department_id,week_start,plan_version,update_date,body,goal_statuses,created_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,clock_timestamp())`, [randomUUID(), userId, department, week, current.version, draft.date, draft.body, JSON.stringify(goalStatuses)]);
      return read(client, userId, department, week);
    }),
  };
}
