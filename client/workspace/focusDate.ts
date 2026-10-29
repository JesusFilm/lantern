export function formatFocusDate(value: string) {
  return new Date(value + "T12:00:00").toLocaleDateString("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
