import { addDays, dayKey, parseDay } from '../../lib/dates.js';
import type { AgentUsage, DayUsage, UsageHistory } from '../usage.js';

const MODELS: [name: string, share: number][] = [
  ['Opus 5.5', 0.6],
  ['Sonnet 5.5', 0.28],
  ['Haiku 4.5', 0.12],
];

export function demoHistory(today = new Date()): UsageHistory {
  const last = dayKey(today);
  const days: DayUsage[] = [];
  const sessions: UsageHistory['sessions'] = [];

  for (let back = 150; back >= 0; back--) {
    const date = addDays(last, -back);
    const weekday = parseDay(date).getDay();
    const roll = hash(date);
    if ((weekday === 0 || weekday === 6) && roll < 0.7) continue;
    if (roll < 0.12) continue;

    const busy = 1 - back / 200;
    const messages = Math.round((40 + roll * 360) * busy);
    const tokens = messages * 180_000;

    days.push({
      date,
      messages,
      sessions: 1 + Math.floor(roll * 5),
      toolCalls: Math.round(messages * 0.8),
      models: Object.fromEntries(
        MODELS.map(([name, share]) => [
          name,
          { input: tokens * share * 0.01, output: tokens * share * 0.03, cacheRead: tokens * share * 0.9, cacheWrite: tokens * share * 0.06 },
        ]),
      ),
    });

    const start = parseDay(date).getTime() + 9 * 3_600_000;

    sessions.push({ id: `demo-${date}`, start, end: start + roll * 9 * 3_600_000 });
  }

  return { days, sessions };
}

/** The same number for the same text, so the demo's history looks the same every run. */
function hash(text: string) {
  let value = 2166136261;

  for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619);

  return (value >>> 0) / 4294967296;
}

export function demoUsage(drivers: boolean, now = Date.now()): AgentUsage {
  const hour = 3_600_000;

  return {
    session: {
      cost: 1.42,
      apiMs: 252_000,
      wallMs: 2_280_000,
      linesAdded: 1322,
      linesRemoved: 209,
      models: [
        { name: 'Opus 5.5', input: 12_200, output: 1_400_000, cacheRead: 470_300_000, cacheWrite: 4_900_000, cost: 1.38 },
        { name: 'Haiku 4.5', input: 182_700, output: 14_300, cacheRead: 731_200, cacheWrite: 76_400, cost: 0.04 },
      ],
    },
    limits: [
      { label: '5-hour window', used: 0.43, resetsAt: now + 2 * hour },
      { label: 'Week, all models', used: 0.36, resetsAt: now + 50 * hour },
      { label: 'Week, Fable', used: 0, resetsAt: now + 50 * hour },
    ],
    drivers: drivers
      ? {
          day: {
            requests: 913,
            sessions: 6,
            traits: [
              { trait: 'subagents', share: 0.98 },
              { trait: 'long-context', share: 0.92 },
              { trait: 'parallel', share: 0.25 },
            ],
            sources: [
              { kind: 'agent', name: 'Explore', share: 0.05 },
              { kind: 'skill', name: 'review', share: 0.01 },
            ],
          },
          week: {
            requests: 6_204,
            sessions: 41,
            traits: [
              { trait: 'long-context', share: 0.81 },
              { trait: 'subagents', share: 0.64 },
              { trait: 'cache-misses', share: 0.07 },
            ],
            sources: [{ kind: 'agent', name: 'Explore', share: 0.09 }],
          },
        }
      : undefined,
  };
}
