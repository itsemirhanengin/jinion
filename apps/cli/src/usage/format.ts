/** `950`, `12.2k`, `1.4M`, `35.0B`. */
export function compact(count: number) {
  if (count < 1000) return String(Math.round(count));
  const [divisor, unit] = count < 1e6 ? [1e3, 'k'] : count < 1e9 ? [1e6, 'M'] : [1e9, 'B'];
  return `${(count / divisor).toFixed(1)}${unit}`;
}

/** `1,322`. */
export const grouped = (count: number) => Math.round(count).toLocaleString('en-US');

/** `42s`, `12m 5s`, `4h 2m`, `7d 2h 55m`. */
export function span(ms: number) {
  const seconds = Math.max(0, Math.round(ms / 1000));
  const [days, hours, minutes] = [Math.floor(seconds / 86_400), Math.floor(seconds / 3600) % 24, Math.floor(seconds / 60) % 60];
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

/** `$1.42`, or the amount with its currency's own sign. */
export function money(amount: number, currency = 'USD') {
  try {
    return amount.toLocaleString('en-US', { style: 'currency', currency });
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/** When a limit resets: `16:09` today, `Sun 12:59` within the week, `Oct 12, 12:59` after. */
export function resetTime(at: number, now = Date.now()) {
  const date = new Date(at);
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (new Date(now).toDateString() === date.toDateString()) return time;
  if (at - now < 6 * 86_400_000) return `${date.toLocaleDateString('en-US', { weekday: 'short' })} ${time}`;
  return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${time}`;
}

/** `Sep 21`. */
export const shortDate = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export const plural = (count: number, singular: string, pluralForm = `${singular}s`) =>
  `${grouped(count)} ${count === 1 ? singular : pluralForm}`;
