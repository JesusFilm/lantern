import { AccessError } from './membership.js';

export function date(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[1-9]\d{3}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export function weekOf(value: unknown) {
  if (!date(value) || new Date(value).getUTCDay() !== 1)
    throw new AccessError(400, 'Choose a week starting on Monday.');
  return value;
}
