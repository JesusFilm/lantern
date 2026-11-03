import { AccessError } from './membership.js';

export function bodyFields(value: unknown, keys: string[]): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !keys.includes(k)))
    throw new AccessError(400, 'Supply only the expected fields.');
}
export function boundedText(value: unknown, max: number, label: string, empty = false): string {
  if (typeof value !== 'string' || value.length > max || (!empty && !value.trim()))
    throw new AccessError(400, `${label} must contain ${empty ? '0' : '1'}–${max} characters.`);
  return value.trim();
}
export function revision(value: unknown, zero = false): number {
  if (!Number.isSafeInteger(value) || Number(value) < (zero ? 0 : 1)) throw new AccessError(400, 'Supply the current revision.');
  return Number(value);
}
export function focusContent(value: Record<string, unknown>, partial = false) {
  const objective = boundedText(value.objective, 10000, 'Objective', partial);
  if (!Array.isArray(value.goals) || value.goals.length < (partial ? 0 : 1) || value.goals.length > 100)
    throw new AccessError(400, 'Supply 1–100 ordered SMART goals.');
  return { objective, goals: value.goals.map(goal => boundedText(goal, 10000, 'SMART goal', partial)) };
}
