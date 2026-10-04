export function compact(count: number) {
  if (count < 1000) return String(Math.round(count));

  const [divisor, unit] = count < 1e6 ? [1e3, 'k'] : count < 1e9 ? [1e6, 'M'] : [1e9, 'B'];

  return `${(count / divisor).toFixed(1)}${unit}`;
}

export const thousands = (count: number) => (count >= 1000 ? `${Math.round(count / 1000)}K` : String(count));

export const grouped = (count: number) => Math.round(count).toLocaleString('en-US');

export const plural = (count: number, singular: string, pluralForm = `${singular}s`) =>
  `${grouped(count)} ${count === 1 ? singular : pluralForm}`;

export function bytes(count: number) {
  if (count < 1024) return `${count} B`;

  const [divisor, unit] = count < 1024 ** 2 ? [1024, 'KB'] : count < 1024 ** 3 ? [1024 ** 2, 'MB'] : [1024 ** 3, 'GB'];

  return `${(count / divisor).toFixed(1)} ${unit}`;
}

export function percent(part: number, whole = 1) {
  const share = whole > 0 ? (part / whole) * 100 : 0;

  return share > 0 && share < 1 ? `${share.toFixed(1)}%` : `${Math.round(share)}%`;
}

export function money(amount: number, currency = 'USD') {
  try {
    return amount.toLocaleString('en-US', { style: 'currency', currency });
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function elapsed(ms: number) {
  const seconds = Math.max(0, Math.round(ms / SECOND));
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;

  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

/** As Claude Code shows a command's time. */
export function preciseSeconds(ms: number) {
  const seconds = ms / SECOND;

  return seconds >= 10 ? `${Math.round(seconds)}s` : `${seconds.toFixed(2)}s`;
}

export function span(ms: number) {
  const seconds = Math.max(0, Math.round(ms / SECOND));
  const [days, hours, minutes] = [Math.floor(seconds / 86_400), Math.floor(seconds / 3600) % 24, Math.floor(seconds / 60) % 60];
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;

  return `${seconds}s`;
}

export function minutes(ms: number) {
  const total = Math.max(0, Math.floor(ms / MINUTE));
  if (total < 60) return `${total}m`;

  const hours = Math.floor(total / 60);
  if (hours < 24) return `${hours}h ${total % 60}m`;

  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

export function ago(at: number, now = Date.now()) {
  const minutesAgo = Math.round((now - at) / MINUTE);
  if (minutesAgo < 1) return 'just now';
  if (minutesAgo < 60) return `${minutesAgo}m ago`;

  const hours = Math.round(minutesAgo / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;

  return `${Math.round(days / 7)}w ago`;
}

export const clockTime = (date: Date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export function resetTime(at: number, now = Date.now()) {
  const date = new Date(at);
  const time = clockTime(date);
  if (new Date(now).toDateString() === date.toDateString()) return time;
  if (at - now < 6 * DAY) return `${date.toLocaleDateString('en-US', { weekday: 'short' })} ${time}`;

  return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${time}`;
}

export const shortDate = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
