/** The top of an axis that holds `value`: the next round number above it (1, 2, 2.5 or 5 times a power of ten). */
export function niceMax(value: number, percent = false) {
  if (value <= 0) return 1;

  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((candidate) => candidate * magnitude >= value)! * magnitude;

  return percent ? Math.min(100, step) : step;
}
