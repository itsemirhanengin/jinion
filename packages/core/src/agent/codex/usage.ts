import type { AgentUsage, LimitWindow } from '../usage.js';
import type { RateLimitSnapshot, RateLimitWindow } from './protocol.js';

const FIVE_HOURS = 300;
const WEEK = 10_080;

/** Named as Claude's are, `5h` and `7d` in the status line, so the two read alike. */
export function limitWindows({ primary, secondary }: RateLimitSnapshot, length: 'short' | 'long'): LimitWindow[] {
  return [primary, secondary].flatMap((window) => (window ? [toWindow(window, length)] : []));
}

export function toUsage(snapshot: RateLimitSnapshot): AgentUsage {
  return { limits: limitWindows(snapshot, 'long') };
}

function toWindow({ usedPercent, windowDurationMins: minutes, resetsAt }: RateLimitWindow, length: 'short' | 'long'): LimitWindow {
  return { label: label(minutes, length), used: usedPercent / 100, resetsAt: resetsAt === null ? undefined : resetsAt * 1000 };
}

function label(minutes: number | null, length: 'short' | 'long') {
  if (minutes === FIVE_HOURS) return length === 'short' ? '5h' : '5-hour window';
  if (minutes === WEEK) return length === 'short' ? '7d' : 'Week';
  if (minutes === null) return 'Limit';

  const hours = Math.round(minutes / 60);

  return length === 'short' ? `${hours}h` : `${hours}-hour window`;
}
