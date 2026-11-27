import type { Pool } from 'pg';
import type { TeamDay, TeamDayMember, TeamWeek, WeeklyGoal } from '../shared/weekly.js';
import { AccessError, membership, membershipWrite } from './membership.js';

export function teamWeeklyStore(db: Pool) {
  const store = {
    day(userId: string, date: string, expectedDepartmentId?:string, latestUpdate = false, weekStart?: string): Promise<TeamDay> {
      return membershipWrite(db, async client => {
        const department = await membership(client, userId);
        if (!department || (expectedDepartmentId && department.id!==expectedDepartmentId)) throw new AccessError(403, 'Active department membership is required.');
        const first = await client.query<{ firstDate: string | null }>(`SELECT to_char(min(u.day),'YYYY-MM-DD') AS "firstDate"
          FROM (SELECT user_id,department_id,update_date AS day FROM daily_updates
            UNION ALL SELECT user_id,department_id,week_start FROM weekly_plans WHERE $2::date IS NOT NULL) u JOIN memberships m ON m.user_id=u.user_id AND m.department_id=u.department_id
          WHERE u.department_id=$1 AND m.deleted_at IS NULL`, [department.id,weekStart ?? null]);
        const members = await client.query<TeamDayMember & {privacyHistory: WeeklyGoal[][]}>(`SELECT person.id,person.name,person.github_username AS "githubUsername",
          coalesce(plan.goals,'[]'::jsonb) AS goals,
          (SELECT coalesce(jsonb_agg(h.goals ORDER BY h.version DESC),'[]'::jsonb) FROM weekly_plans h WHERE h.user_id=person.id AND h.department_id=$1 AND h.week_start=date_trunc('week',coalesce(entry.update_date,$2::date))::date) AS "privacyHistory",
          CASE WHEN entry.id IS NULL THEN NULL ELSE jsonb_build_object('id',entry.id,'date',to_char(entry.update_date,'YYYY-MM-DD'),
            'body',entry.body,'planVersion',entry.plan_version,'goalStatuses',entry.goal_statuses,'createdAt',entry.created_at) END AS update
          FROM memberships m JOIN users person ON person.id=m.user_id
          LEFT JOIN LATERAL (SELECT * FROM daily_updates u WHERE u.user_id=person.id AND u.department_id=$1 AND u.update_date <= $2::date AND ($3 OR u.update_date=$2::date) AND ($4::date IS NULL OR u.update_date >= $4::date)
            ORDER BY CASE WHEN $4::date IS NULL THEN u.update_date END DESC,u.created_at DESC,u.id DESC LIMIT 1) entry ON true
          LEFT JOIN LATERAL (SELECT p.goals FROM weekly_plans p WHERE p.user_id=person.id AND p.department_id=$1
            AND p.week_start=date_trunc('week',coalesce(entry.update_date,$2::date))::date AND (entry.id IS NULL OR p.version=entry.plan_version)
            ORDER BY p.version DESC LIMIT 1) plan ON true
          WHERE m.department_id=$1 AND m.deleted_at IS NULL ORDER BY CASE WHEN $3 THEN entry.created_at END DESC NULLS LAST,lower(person.name),person.id`, [department.id,date,latestUpdate,weekStart ?? null]);
        const visible = members.rows.map(({privacyHistory, ...person}) => {
          const latest = new Map<string,WeeklyGoal>();
          for(const plan of privacyHistory)for(const goal of plan)if(!latest.has(goal.id))latest.set(goal.id,goal);
          const allowed = (goal:WeeklyGoal) => !expectedDepartmentId && person.id===userId ||
            !goal.visibility || goal.visibility==='team' || !expectedDepartmentId && department.role==='career-lead' && goal.visibility==='lead';
          const goals=person.goals.filter(goal=>allowed(goal)&&allowed(latest.get(goal.id)??goal));
          const ids=new Set(goals.map(goal=>goal.id));
          return {...person,goals,update:person.update?{...person.update,goalStatuses:person.update.goalStatuses.filter(status=>ids.has(status.goalId))}:null};
        });
        return { date, firstDate: first.rows[0]!.firstDate, members: visible };
      });
    },
    async week(userId: string, week: string, expectedDepartmentId?: string): Promise<TeamWeek> {
      const end=new Date(week+'T12:00:00Z');end.setUTCDate(end.getUTCDate()+6);
      const view=await store.day(userId,end.toISOString().slice(0,10),expectedDepartmentId,true,week);
      let firstWeek: string | null=null;
      if(view.firstDate){
        const first=new Date(view.firstDate+'T12:00:00Z');first.setUTCDate(first.getUTCDate()-(first.getUTCDay()+6)%7);firstWeek=first.toISOString().slice(0,10);
      }
      return {week,firstWeek,members:view.members};
    },
  };
  return store;
}
