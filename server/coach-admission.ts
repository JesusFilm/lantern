import { AccessError } from './membership.js';

/** Shared by human and experimental coaching, scoped to this app instance. */
export function createCoachAdmission() {
  const active = new Set<string>(), usage = new Map<string, { at: number; count: number }>();
  return (actor: string) => {
    const now = Date.now();
    for (const [id, bucket] of usage) if (now - bucket.at >= 60000) usage.delete(id);
    const bucket = usage.get(actor) ?? { at: now, count: 0 };
    if (active.has(actor) || active.size >= 4 || bucket.count >= 20 || (!usage.has(actor) && usage.size >= 1000))
      throw new AccessError(429, 'The coach is busy. Try again shortly.');
    bucket.count++;
    usage.set(actor, bucket);
    active.add(actor);
    return () => { active.delete(actor); };
  };
}
export type CoachAdmission = ReturnType<typeof createCoachAdmission>;
