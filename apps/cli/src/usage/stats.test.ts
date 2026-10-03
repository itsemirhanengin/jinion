import { describe, expect, it } from 'vitest';
import type { DayUsage, UsageHistory } from '../agent/usage.js';
import { usageStats } from './stats.js';

const TODAY = new Date(2026, 9, 3, 12);
const hour = 3_600_000;

const day = (date: string, messages: number, models: Record<string, number> = { 'Opus 5.5': messages * 10 }): DayUsage => ({
  date,
  messages,
  sessions: 1,
  toolCalls: 0,
  models: Object.fromEntries(Object.entries(models).map(([name, input]) => [name, { input, output: 0, cacheRead: 0, cacheWrite: 0 }])),
});

const history: UsageHistory = {
  days: [
    day('2026-07-10', 5),
    day('2026-07-11', 7),
    day('2026-07-12', 3),
    day('2026-09-20', 40, { 'Opus 5.5': 300, 'Haiku 4.5': 100 }),
    day('2026-09-30', 2),
    day('2026-10-01', 9),
    day('2026-10-02', 4),
  ],
  sessions: [
    { id: 'long-ago', start: new Date(2026, 6, 10, 9).getTime(), end: new Date(2026, 6, 10, 9).getTime() + 30 * hour },
    { id: 'lately', start: new Date(2026, 9, 1, 9).getTime(), end: new Date(2026, 9, 1, 9).getTime() + 2 * hour },
  ],
};

describe('usageStats', () => {
  it('sums up all time: active days of the span, the busiest day, streaks and the longest session', () => {
    const stats = usageStats(history, 'all', TODAY);
    expect(stats).toMatchObject({ sessions: 7, messages: 70, activeDays: 7, spanDays: 86, mostActive: { date: '2026-09-20' } });
    // Today has nothing yet, so the streak still runs through yesterday.
    expect(stats).toMatchObject({ currentStreak: 3, longestStreak: 3, longestSession: { ms: 30 * hour, date: '2026-07-10' } });
  });

  it('keeps to the last 30 or 7 days', () => {
    expect(usageStats(history, 'month', TODAY)).toMatchObject({ activeDays: 4, spanDays: 14, longestSession: { ms: 2 * hour } });
    expect(usageStats(history, 'week', TODAY)).toMatchObject({ activeDays: 3, messages: 15 });
  });

  it('shares the tokens out by model, most first', () => {
    const { models, tokens } = usageStats(history, 'month', TODAY);
    expect(models.map((model) => [model.name, model.total, Math.round(model.share * 100)])).toEqual([
      ['Opus 5.5', 450, 82],
      ['Haiku 4.5', 100, 18],
    ]);
    expect(tokens.total).toBe(550);
  });
});
