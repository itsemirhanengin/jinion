import { NOW } from '@/lib/data';

const timeZone = 'Europe/Istanbul';
const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone });
const shortDateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone });
const timeFormat = new Intl.DateTimeFormat('en-GB', { timeStyle: 'short', timeZone });
const stampFormat = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone });
const countFormat = new Intl.NumberFormat('en-US');
const compactFormat = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const relativeFormat = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' });

/** "25 Oct 2026" */
export const formatDate = (iso: string) => dateFormat.format(new Date(iso));
/** "25 Oct" */
export const formatShortDate = (iso: string) => shortDateFormat.format(new Date(iso));
export const formatTime = (iso: string) => timeFormat.format(new Date(iso));
/** "25 Oct, 14:30" */
export const formatStamp = (iso: string) => stampFormat.format(new Date(iso));
export const formatCount = (n: number) => countFormat.format(n);
/** "1.2M" */
export const formatCompact = (n: number) => compactFormat.format(n);
export const formatPercent = (share: number) => `${(share * 100).toLocaleString('en-US', { maximumFractionDigits: 1 })}%`;

export function formatDuration(ms: number) {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);

  return seconds % 60 ? `${minutes}m ${seconds % 60}s` : `${minutes}m`;
}

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "3 hours ago", "yesterday", against the data's "now". */
export function formatAgo(iso: string) {
  const ago = Date.parse(NOW) - Date.parse(iso);
  if (ago < HOUR) return relativeFormat.format(-Math.max(1, Math.round(ago / MINUTE)), 'minute');
  if (ago < DAY) return relativeFormat.format(-Math.round(ago / HOUR), 'hour');

  return relativeFormat.format(-Math.round(ago / DAY), 'day');
}
