import { describe, expect, it } from 'vitest';
import type { DayUsage } from '../../src/agent/usage.js';
import { mergeHistories, usageProfile } from '../../src/usage/profile.js';

const tokens = (input: number) => ({ input, output: 0, cacheRead: 0, cacheWrite: 0 });

const day = (date: string, messages: number, models: DayUsage['models']): DayUsage => ({ date, messages, sessions: 1, toolCalls: 2, models });

describe('the profile', () => {
  it('adds two backends’ days together, model by model', () => {
    const claude = { days: [day('2026-10-01', 3, { opus: tokens(100) }), day('2026-10-02', 1, { opus: tokens(50) })], sessions: [] };
    const codex = { days: [day('2026-10-02', 2, { gpt: tokens(30), opus: tokens(5) })], sessions: [{ id: 'a', start: 0, end: 60_000 }] };

    const merged = mergeHistories([claude, codex]);

    expect(merged.days.map((each) => each.date)).toEqual(['2026-10-01', '2026-10-02']);
    expect(merged.days[1]).toMatchObject({ messages: 3, sessions: 2, toolCalls: 4, models: { opus: tokens(55), gpt: tokens(30) } });
    expect(merged.sessions).toHaveLength(1);
  });

  it('counts the totals, the peak day, the streaks and each model’s share', () => {
    const history = {
      days: [day('2026-10-04', 2, { opus: tokens(300) }), day('2026-10-05', 5, { opus: tokens(100), gpt: tokens(100) }), day('2026-10-06', 1, { gpt: tokens(500) })],
      sessions: [],
    };

    const profile = usageProfile(history, new Date('2026-10-06T12:00:00'));

    expect(profile).toMatchObject({
      tokens: 1000,
      peak: { date: '2026-10-06', tokens: 500 },
      currentStreak: 3,
      longestStreak: 3,
      messages: 8,
      toolCalls: 6,
      activeDays: 3,
      mostActive: { date: '2026-10-05', messages: 5 },
    });

    expect(profile.models).toEqual([
      { name: 'gpt', tokens: 600, share: 0.6 },
      { name: 'opus', tokens: 400, share: 0.4 },
    ]);

    expect(profile.days.map((each) => each.tokens)).toEqual([300, 200, 500]);
  });
});
