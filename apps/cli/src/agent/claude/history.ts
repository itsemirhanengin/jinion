import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type DayUsage, emptyTokens, type ModelTokens, type UsageHistory } from '../usage.js';
import { configDirs } from './accounts.js';
import { type FileRecord, readTranscripts, realPaths, type Tokens } from './transcripts.js';
import { modelName } from './usage.js';

/** Claude Code's own daily summary, which outlives the transcripts it deletes after a month. */
interface StatsCache {
  dailyActivity?: { date: string; messageCount?: number; sessionCount?: number; toolCallCount?: number }[];
  dailyModelTokens?: { date: string; tokensByModel?: Record<string, number> }[];
}

let reading: Promise<UsageHistory> | undefined;

export function readHistory(progress?: (done: number, total: number) => void, dirs = configDirs()): Promise<UsageHistory> {
  reading ??= readTranscripts(dirs, progress)
    .then((records) => toHistory(records, dirs))
    .finally(() => {
      reading = undefined;
    });
  return reading;
}

function toHistory(records: FileRecord[], dirs: string[]): UsageHistory {
  const days = new Map<string, DayUsage>();
  /** A conversation counts once per day, however many transcripts it has. */
  const ids = new Map<string, Set<string>>();
  const sessions = new Map<string, { id: string; start: number; end: number }>();
  for (const record of records) {
    for (const [date, counted] of Object.entries(record.days)) {
      const day = dayOf(days, date);
      day.messages += counted.messages;
      day.toolCalls += counted.toolCalls;
      if (record.session) ids.set(date, (ids.get(date) ?? new Set()).add(record.session));
      for (const [model, tokens] of Object.entries(counted.models)) add(day.models, modelName(model), tokens);
    }
    if (record.session && record.start !== undefined && record.end !== undefined) {
      const known = sessions.get(record.session);
      sessions.set(record.session, {
        id: record.session,
        start: Math.min(known?.start ?? record.start, record.start),
        end: Math.max(known?.end ?? record.end, record.end),
      });
    }
  }
  const summary = summaryDays(dirs);
  const scale = calibrate(days, summary);
  // Days whose transcripts are all gone, or were never read, e.g. from before Jinion.
  for (const imported of summary.filter((day) => !days.has(day.date))) {
    const day = dayOf(days, imported.date);
    day.messages += Math.round(imported.messages * scale.messages);
    day.sessions += imported.sessions;
    day.toolCalls += Math.round(imported.toolCalls * scale.toolCalls);
    for (const [model, tokens] of Object.entries(imported.models)) addSummarized(day.models, model, (tokens.summarized ?? 0) * scale.tokens);
  }
  return {
    days: [...days.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((day) => ({ ...day, sessions: day.sessions + (ids.get(day.date)?.size ?? 0) })),
    sessions: [...sessions.values()],
  };
}

function dayOf(days: Map<string, DayUsage>, date: string) {
  let day = days.get(date);
  if (!day) {
    day = { date, messages: 0, sessions: 0, toolCalls: 0, models: {} };
    days.set(date, day);
  }
  return day;
}

function add(models: Record<string, ModelTokens>, name: string, [input, output, cacheRead, cacheWrite]: Tokens) {
  models[name] ??= emptyTokens();
  const tokens = models[name];
  tokens.input += input;
  tokens.output += output;
  tokens.cacheRead += cacheRead;
  tokens.cacheWrite += cacheWrite;
}

function addSummarized(models: Record<string, ModelTokens>, name: string, total: number) {
  models[name] ??= emptyTokens();
  const tokens = models[name];
  tokens.summarized = (tokens.summarized ?? 0) + total;
}

/** Claude Code's summary counts several times what the transcripts add up to; its older days are scaled to match. */
function calibrate(days: Map<string, DayUsage>, summary: DayUsage[]) {
  const sums = { messages: [0, 0], toolCalls: [0, 0], tokens: [0, 0] };
  for (const theirs of summary) {
    const ours = days.get(theirs.date);
    if (!ours || ours.messages === 0 || theirs.messages === 0) continue;
    sums.messages[0]! += ours.messages;
    sums.messages[1]! += theirs.messages;
    sums.toolCalls[0]! += ours.toolCalls;
    sums.toolCalls[1]! += theirs.toolCalls;
    sums.tokens[0]! += tokensOf(ours);
    sums.tokens[1]! += tokensOf(theirs);
  }
  const ratio = ([ours, theirs]: number[]) => (ours! > 0 && theirs! > 0 ? ours! / theirs! : 1);
  return { messages: ratio(sums.messages), toolCalls: ratio(sums.toolCalls), tokens: ratio(sums.tokens) };
}

const tokensOf = (day: DayUsage) =>
  Object.values(day.models).reduce(
    (sum, tokens) => sum + tokens.input + tokens.output + tokens.cacheRead + tokens.cacheWrite + (tokens.summarized ?? 0),
    0,
  );

function summaryDays(dirs: string[]): DayUsage[] {
  const days = new Map<string, DayUsage>();
  for (const path of realPaths(dirs.map((dir) => join(dir, 'stats-cache.json')))) {
    if (!existsSync(path)) continue;
    let stats: StatsCache;
    try {
      stats = JSON.parse(readFileSync(path, 'utf8')) as StatsCache;
    } catch {
      continue;
    }
    for (const activity of Array.isArray(stats.dailyActivity) ? stats.dailyActivity : []) {
      if (typeof activity?.date !== 'string') continue;
      const day = dayOf(days, activity.date);
      day.messages += activity.messageCount ?? 0;
      day.sessions += activity.sessionCount ?? 0;
      day.toolCalls += activity.toolCallCount ?? 0;
    }
    for (const tokens of Array.isArray(stats.dailyModelTokens) ? stats.dailyModelTokens : []) {
      if (typeof tokens?.date !== 'string') continue;
      const day = dayOf(days, tokens.date);
      for (const [model, total] of Object.entries(tokens.tokensByModel ?? {})) {
        if (typeof total === 'number') addSummarized(day.models, modelName(model), total);
      }
    }
  }
  return [...days.values()];
}
