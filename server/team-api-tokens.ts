import {createHash,randomBytes,randomUUID} from 'node:crypto';
import type {Pool,PoolClient} from 'pg';
import type {TeamAPIToken,CreatedTeamAPIToken} from '../shared/team-api.js';
import {AccessError,membership,membershipWrite} from './membership.js';

export interface TeamAPIActor {id:string;email:string;departmentId:string}
const digest=(token:string)=>createHash('sha256').update(token).digest('hex');
const columns='id,name,created_at AS "createdAt",expires_at AS "expiresAt"';
export function teamAPITokenStore(db:Pool,localUserId?:string) {
 async function department(client:PoolClient,userId:string){
  const value=await membership(client,userId);if(!value)throw new AccessError(403,'Active department membership is required.');return value.id;
 }
 return {
  list(userId:string){return membershipWrite(db,async client=>{
   const scope=await department(client,userId);
   return (await client.query<TeamAPIToken>(`SELECT ${columns} FROM team_api_tokens WHERE user_id=$1 AND department_id=$2 AND revoked_at IS NULL AND expires_at>now() ORDER BY created_at DESC,id`,[userId,scope])).rows;
  });},
  create(userId:string,name:string):Promise<CreatedTeamAPIToken>{
   if(!name.trim()||name.trim().length>80)throw new AccessError(400,'Name the token using 1–80 characters.');
   return membershipWrite(db,async client=>{
    const scope=await department(client,userId);
    const active=await client.query('SELECT 1 FROM team_api_tokens WHERE user_id=$1 AND revoked_at IS NULL AND expires_at>now()',[userId]);
    if((active.rowCount??0)>=10)throw new AccessError(409,'Revoke an existing token before creating another.');
    const token='lantern_tv_'+randomBytes(32).toString('base64url');
    const result=await client.query<TeamAPIToken>(`INSERT INTO team_api_tokens(id,user_id,department_id,name,token_hash,expires_at) VALUES($1,$2,$3,$4,$5,now()+interval '90 days') RETURNING ${columns}`,[randomUUID(),userId,scope,name.trim(),digest(token)]);
    return {...result.rows[0]!,token};
   });
  },
  revoke(userId:string,id:string){return membershipWrite(db,async client=>{
   const scope=await department(client,userId);
   const result=await client.query('UPDATE team_api_tokens SET revoked_at=coalesce(revoked_at,now()) WHERE id=$1 AND user_id=$2 AND department_id=$3',[id,userId,scope]);
   if(!result.rowCount)throw new AccessError(404,'Token not found.');
  });},
  async authenticate(token:string):Promise<TeamAPIActor>{
   if(!/^lantern_tv_[A-Za-z0-9_-]{43}$/.test(token))throw new AccessError(401,'A valid team API bearer token is required.');
   const result=await db.query<TeamAPIActor>(`SELECT u.id,u.email,t.department_id AS "departmentId" FROM team_api_tokens t
    JOIN users u ON u.id=t.user_id LEFT JOIN approved_emails a ON a.email=lower(btrim(u.email))
    JOIN memberships m ON m.user_id=t.user_id AND m.department_id=t.department_id AND m.deleted_at IS NULL
    JOIN departments d ON d.id=t.department_id AND d.deleted_at IS NULL
    WHERE t.token_hash=$1 AND t.revoked_at IS NULL AND t.expires_at>now()
    AND (a.email IS NOT NULL OR u.id=$2::uuid)`,[digest(token),localUserId??null]);
   if(!result.rows[0])throw new AccessError(401,'This team API token is invalid, expired or revoked.');
   return result.rows[0];
  },
 };
}
