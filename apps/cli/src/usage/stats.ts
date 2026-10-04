import { addDays, dayKey, parseDay } from '../lib/dates.js';
import type { DayUsage, ModelTokens, UsageHistory } from '../agent/usage.js';

export type StatsRange = 'all' | 'month' | 'week';

export const RANGES: { range: StatsRange; label: string; days?: number }[] = [
  { range: 'all', label: 'All time' },
  { range: 'month', label: 'Last 30 days', days: 30 },
  { range: 'week', label: 'Last 7 days', days: 7 },
];

export interface ModelShare {
  name: string;
  tokens: ModelTokens;
  total: number;
  share: number;
}

export interface UsageStats {
  sessions: number;
  messages: number;
  activeDays: number;
  spanDays: number;
  mostActive?: DayUsage;
  longestSession?: { ms: number; date: string };
  currentStreak: number;
  longestStreak: number;
  tokens: ModelTokens & { total: number };
  models: ModelShare[];
}

export function usageStats(history: UsageHistory, range: StatsRange, today = new Date()): UsageStats {
  const last = dayKey(today);
  const days = RANGES.find((candidate) => candidate.range === range)?.days;
  const from = days ? addDays(last, 1 - days) : undefined;
  const shown = history.days.filter((day) => (!from || day.date >= from) && day.date <= last);
  const active = shown.filter((day) => day.messages > 0);

  const tokens = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, summarized: 0 };
  const byModel = new Map<string, Required<ModelTokens>>();

  for (const day of shown) {
    for (const [name, used] of Object.entries(day.models)) {
      const model = byModel.get(name) ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, summarized: 0 };

      for (const key of ['input', 'output', 'cacheRead', 'cacheWrite', 'summarized'] as const) {
        model[key] += used[key] ?? 0;
        tokens[key] += used[key] ?? 0;
      }

      byModel.set(name, model);
    }
  }

  const total = totalOf(tokens);

  const models = [...byModel]
    .map(([name, used]) => ({ name, tokens: used, total: totalOf(used), share: total > 0 ? totalOf(used) / total : 0 }))
    .filter((model) => model.total > 0)
    .sort((a, b) => b.total - a.total);

  const longest = history.sessions
    .filter((session) => !from || dayKey(new Date(session.end)) >= from)
    .reduce<{ ms: number; date: string } | undefined>((best, session) => {
      const ms = session.end - session.start;

      return !best || ms > best.ms ? { ms, date: dayKey(new Date(session.start)) } : best;
    }, undefined);

  const first = active[0]?.date;

  return {
    sessions: shown.reduce((sum, day) => sum + day.sessions, 0),
    messages: shown.reduce((sum, day) => sum + day.messages, 0),
    activeDays: active.length,
    spanDays: first ? daysBetween(first, last) + 1 : 0,
    mostActive: active.reduce<DayUsage | undefined>((best, day) => (!best || day.messages > best.messages ? day : best), undefined),
    longestSession: longest && longest.ms > 0 ? longest : undefined,
    ...streaks(new Set(active.map((day) => day.date)), last),
    tokens: { ...tokens, total },
    models,
  };
}

export const totalOf = (tokens: ModelTokens) =>
  tokens.input + tokens.output + tokens.cacheRead + tokens.cacheWrite + (tokens.summarized ?? 0);

/** The current streak runs up to yesterday while today has no activity yet. */
function streaks(active: Set<string>, today: string) {
  let longestStreak = 0;

  for (const day of active) {
    if (active.has(addDays(day, -1))) continue;

    let length = 1;

    while (active.has(addDays(day, length))) length++;
    longestStreak = Math.max(longestStreak, length);
  }

  let day = active.has(today) ? today : addDays(today, -1);
  let currentStreak = 0;

  while (active.has(day)) {
    currentStreak++;
    day = addDays(day, -1);
  }

  return { currentStreak, longestStreak };
}

const daysBetween = (from: string, to: string) => Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / 86_400_000);
