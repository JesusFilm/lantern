export function day(value = new Date()) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}
export function shift(value: string, days: number) {
  const date = new Date(value + 'T12:00:00');
  date.setDate(date.getDate() + days);
  return day(date);
}
export function monday(value: string) {
  const date = new Date(value + 'T12:00:00');
  return shift(value, -((date.getDay() + 6) % 7));
}
