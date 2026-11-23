import type { Pool } from 'pg';
import type { ReviewActivity } from '../shared/review-activity.js';
import { AccessError, membership, membershipWrite } from './membership.js';
import { coachStore } from './coach-store.js';

export function reviewActivityStore(db: Pool) {
 const reviews=coachStore(db);
 return {
  read: (actor:string):Promise<ReviewActivity> => membershipWrite(db,async client=>{
   const department=await membership(client,actor);
   if(department?.role!=='career-lead')throw new AccessError(403,'Only the career lead can read review activity.');
   const rows=await client.query(`SELECT f.id AS "focusId",r.id AS "requestId",
      (f.user_id<>$2 AND NOT EXISTS(SELECT 1 FROM focus_request_reads x WHERE x.request_id=r.id AND x.user_id=$2)) AS "unreadRequest",
      (SELECT count(*)::int FROM focus_review_notes n WHERE n.request_id IN(SELECT id FROM focus_review_requests WHERE focus_id=f.id)
        AND n.author_id<>$2 AND n.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM focus_note_reads x WHERE x.note_id=n.id AND x.user_id=$2)) AS "unreadNotes"
     FROM position_focuses f JOIN memberships m ON m.user_id=f.user_id AND m.department_id=f.department_id AND m.deleted_at IS NULL
     JOIN LATERAL(SELECT id FROM focus_review_requests WHERE focus_id=f.id ORDER BY version DESC LIMIT 1) r ON true
     WHERE f.department_id=$1`,[department.id,actor]);
   return {items:rows.rows.filter(row=>row.unreadRequest||row.unreadNotes>0)};
  }),
  acknowledge: (actor:string,focusId:string,requestId:string) => membershipWrite(db,async client=>{
   const access=await reviews.access(client,actor,focusId);
   if(access.dept.role!=='career-lead')throw new AccessError(403,'Only the career lead can acknowledge review requests.');
   const request=await client.query('SELECT id FROM focus_review_requests WHERE id::text=$1 AND focus_id::text=$2',[requestId,focusId]);
   if(!request.rowCount)throw new AccessError(400,'Choose the displayed review request.');
   await client.query('INSERT INTO focus_request_reads(request_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[requestId,actor]);
  }),
 };
}
