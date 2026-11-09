import {randomUUID} from 'node:crypto';
import type {Pool,PoolClient} from 'pg';
import {AccessError,membershipWrite} from './membership.js';
import type {FocusSection} from '../shared/focus.js';

async function ownedFocus(db:Pool|PoolClient,actor:string,id:string,owner?:string) {
  const result=await db.query(`SELECT f.sections,f.status FROM position_focuses f
    JOIN memberships m ON m.user_id=f.user_id AND m.department_id=f.department_id AND m.deleted_at IS NULL
    JOIN departments d ON d.id=m.department_id AND d.deleted_at IS NULL
    JOIN memberships actor ON actor.user_id=$2 AND actor.department_id=f.department_id AND actor.deleted_at IS NULL
    WHERE f.id::text=$1 AND (f.user_id=$2 AND $3::text IS NULL OR actor.role='career-lead' AND f.user_id::text=$3)`,[id,actor,owner??null]);
  if(!result.rowCount) throw new AccessError(404,'Position focus not found.');
  if(result.rows[0].status!=='confirmed') throw new AccessError(409,'Progress is available after the focus is confirmed.');
  return result.rows[0].sections as FocusSection[];
}
export function progressStore(db:Pool) {
  return {
    async read(actor:string,id:string,owner?:string) {
      return membershipWrite(db,async client=>{
        await ownedFocus(client,actor,id,owner);
        const notes=await client.query(`SELECT section,goal,body,"createdAt",revision FROM (
          SELECT DISTINCT ON (section_index, COALESCE(goal_index,-1)) section_index AS section,goal_index AS goal,body,created_at AS "createdAt",id AS revision
          FROM focus_progress_notes WHERE focus_id::text=$1 ORDER BY section_index,COALESCE(goal_index,-1),ordinal DESC
        ) latest ORDER BY section,goal NULLS FIRST`,[id]);
        const statuses=await client.query(`SELECT section_index AS section,NULLIF(goal_index,-1) AS goal,status,revision FROM focus_progress_statuses WHERE focus_id::text=$1 ORDER BY section_index,goal_index`,[id]);
        return {notes:notes.rows,statuses:statuses.rows};
      });
    },
    async setStatus(actor:string,id:string,section:number,goal:number|null,status:string|null,revision:string|null) {
      return membershipWrite(db,async client=>{
        const sections=await ownedFocus(client,actor,id);
        if(!sections[section] || (goal!==null && !sections[section].goals[goal])) throw new AccessError(400,'Objective or goal not found.');
        const existing=await client.query('SELECT revision FROM focus_progress_statuses WHERE focus_id::text=$1 AND section_index=$2 AND goal_index=$3',[id,section,goal??-1]);
        if((existing.rows[0]?.revision??null)!==revision) throw new AccessError(409,'This status changed in another window. Reload the focus before trying again.');
        const next=randomUUID();
        await client.query(`INSERT INTO focus_progress_statuses(focus_id,section_index,goal_index,status,revision) VALUES($1,$2,$3,$4,$5)
          ON CONFLICT (focus_id,section_index,goal_index) DO UPDATE SET status=excluded.status,revision=excluded.revision,updated_at=now()`,[id,section,goal??-1,status,next]);
        return {section,goal,status,revision:next};
      });
    },
    async saveEntry(actor:string,id:string,section:number,goal:number|null,status:string|null,body:string,revision:string|null,noteRevision:string|null) {
      return membershipWrite(db,async client=>{
        const sections=await ownedFocus(client,actor,id);
        if(!sections[section] || (goal!==null && !sections[section].goals[goal])) throw new AccessError(400,'Objective or goal not found.');
        const current=await client.query('SELECT revision FROM focus_progress_statuses WHERE focus_id::text=$1 AND section_index=$2 AND goal_index=$3',[id,section,goal??-1]);
        const currentNote=await client.query(`SELECT id,section_index AS section,goal_index AS goal,body,created_at AS "createdAt",id AS revision FROM focus_progress_notes WHERE focus_id::text=$1 AND section_index=$2 AND goal_index IS NOT DISTINCT FROM $3 ORDER BY ordinal DESC LIMIT 1`,[id,section,goal]);
        if((current.rows[0]?.revision??null)!==revision || (currentNote.rows[0]?.id??null)!==noteRevision) throw new AccessError(409,'Progress changed in another window. Reload the focus before trying again.');
        const next=randomUUID();
        await client.query(`INSERT INTO focus_progress_statuses(focus_id,section_index,goal_index,status,revision) VALUES($1,$2,$3,$4,$5)
          ON CONFLICT (focus_id,section_index,goal_index) DO UPDATE SET status=excluded.status,revision=excluded.revision,updated_at=now()`,[id,section,goal??-1,status,next]);
        const oldNote=currentNote.rows[0];
        if ((oldNote?.body??'')===body) return {status:{section,goal,status,revision:next},note:oldNote??null};
        const note=await client.query(`INSERT INTO focus_progress_notes(id,focus_id,section_index,goal_index,author_id,body) VALUES($1,$2,$3,$4,$5,$6) RETURNING section_index AS section,goal_index AS goal,body,created_at AS "createdAt",id AS revision`,[randomUUID(),id,section,goal,actor,body]);
        return {status:{section,goal,status,revision:next},note:note.rows[0]};
      });
    },
    async add(actor:string,id:string,section:number,goal:number|null,body:string) {
      return membershipWrite(db,async client=>{
        const sections=await ownedFocus(client,actor,id);
        if(!sections[section] || (goal!==null && !sections[section].goals[goal])) throw new AccessError(400,'Objective or goal not found.');
        return (await client.query(`INSERT INTO focus_progress_notes(id,focus_id,section_index,goal_index,author_id,body) VALUES($1,$2,$3,$4,$5,$6) RETURNING section_index AS section,goal_index AS goal,body,created_at AS "createdAt",id AS revision`,[randomUUID(),id,section,goal,actor,body])).rows[0];
      });
    },
  };
}
