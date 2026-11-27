import { Router, type Request } from 'express';
import type { Pool } from 'pg';
import { AccessError } from './membership.js';
import { teamWeeklyStore } from './team-weekly.js';

export function teamWeeklyRoutes(db: Pool, requireUser: (request: Request) => Promise<{id:string;email:string;departmentId?:string}>, path='/api/team-updates', latestUpdate=true) {
  const router=Router(), store=teamWeeklyStore(db);
  router.get(path,async (req,res) => {
    const user=await requireUser(req);
    const {date,week}=req.query;
    if(latestUpdate && week!==undefined){
      if(Object.keys(req.query).some(key=>key!=='week') || typeof week!=='string' || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(week)
        || !Number.isFinite(Date.parse(week)) || new Date(week).toISOString().slice(0,10)!==week || new Date(week).getUTCDay()!==1)
        throw new AccessError(400,'Choose a valid week starting on Monday.');
      res.json(await store.week(user.id,week,user.departmentId));return;
    }
    if (Object.keys(req.query).some(key=>key!=='date') || typeof date!=='string' || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(date)
      || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10)!==date)
      throw new AccessError(400,'Choose a valid calendar date.');
    res.json(await store.day(user.id,date,user.departmentId,latestUpdate));
  });
  return router;
}
