/** By local date, not UTC: a day ends at midnight where the user is. */
export function dayKey(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseDay(day: string) {
  const [year, month, date] = day.split('-').map(Number);

  return new Date(year!, month! - 1, date!);
}

export function addDays(day: string, count: number) {
  const date = parseDay(day);

  date.setDate(date.getDate() + count);

  return dayKey(date);
}
