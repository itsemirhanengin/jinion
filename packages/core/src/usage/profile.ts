import type { DayUsage, ModelTokens, UsageHistory, UsageProfile } from '../agent/usage.js';
import { totalOf, usageStats } from './stats.js';

/** Several backends' histories as one: the same day's counts and each model's tokens added together. */
export function mergeHistories(histories: UsageHistory[]): UsageHistory {
  const days = new Map<string, DayUsage>();

  for (const day of histories.flatMap((history) => history.days)) {
    const known = days.get(day.date);

    if (!known) {
      days.set(day.date, { ...day, models: { ...day.models } });
      continue;
    }

    known.messages += day.messages;
    known.sessions += day.sessions;
    known.toolCalls += day.toolCalls;
    for (const [name, tokens] of Object.entries(day.models)) known.models[name] = addTokens(known.models[name], tokens);
  }

  return {
    days: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)),
    sessions: histories.flatMap((history) => history.sessions),
  };
}

export function usageProfile(history: UsageHistory, today = new Date()): UsageProfile {
  const stats = usageStats(history, 'all', today);
  const days = history.days.map((day) => ({ date: day.date, tokens: Object.values(day.models).reduce((sum, tokens) => sum + totalOf(tokens), 0), messages: day.messages }));
  const peak = days.reduce<(typeof days)[number] | undefined>((best, day) => (!best || day.tokens > best.tokens ? day : best), undefined);

  return {
    days,
    tokens: stats.tokens.total,
    peak: peak && peak.tokens > 0 ? { date: peak.date, tokens: peak.tokens } : undefined,
    currentStreak: stats.currentStreak,
    longestStreak: stats.longestStreak,
    sessions: stats.sessions,
    messages: stats.messages,
    toolCalls: history.days.reduce((sum, day) => sum + day.toolCalls, 0),
    activeDays: stats.activeDays,
    mostActive: stats.mostActive && { date: stats.mostActive.date, messages: stats.mostActive.messages },
    models: stats.models.map((model) => ({ name: model.name, tokens: model.total, share: model.share })),
  };
}

function addTokens(a: ModelTokens | undefined, b: ModelTokens): ModelTokens {
  if (!a) return { ...b };

  return {
    input: a.input + b.input,
    output: a.output + b.output,
    cacheRead: a.cacheRead + b.cacheRead,
    cacheWrite: a.cacheWrite + b.cacheWrite,
    summarized: (a.summarized ?? 0) + (b.summarized ?? 0) || undefined,
  };
}
