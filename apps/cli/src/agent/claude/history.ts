import { closeSync, existsSync, openSync, readdirSync, readFileSync, readSync, realpathSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { dayKey } from '@jinion/tui';
import { readJson, writeJson } from '../../json-file.js';
import { jinionHome } from '../../paths.js';
import type { DayUsage, ModelTokens, UsageHistory } from '../types.js';
import { accountNames, configDirOf } from './accounts.js';
import { modelName } from './usage.js';

/** Input, output, cache read and cache write tokens. */
type Tokens = [number, number, number, number];

interface FileDay {
  messages: number;
  toolCalls: number;
  /** By model id. */
  models: Record<string, Tokens>;
}

/** What one transcript added up to, and how far it was read. */
interface FileRecord {
  size: number;
  mtimeMs: number;
  /** Bytes read, up to the end of the last whole line. */
  offset: number;
  session?: string;
  start?: number;
  end?: number;
  /** The latest response ids: a response is written a line per block, and a read can end between them. */
  recent: string[];
  days: Record<string, FileDay>;
}

interface Cache {
  version: 1;
  files: Record<string, FileRecord>;
}

/** Claude Code's own daily summary, which outlives the transcripts it deletes after a month. */
interface StatsCache {
  dailyActivity?: { date: string; messageCount?: number; sessionCount?: number; toolCallCount?: number }[];
  dailyModelTokens?: { date: string; tokensByModel?: Record<string, number> }[];
}

const RECENT = 64;
const cacheFile = () => join(jinionHome(), 'usage', 'claude.json');

/** Claude Code's config folders: its own login's and each of Jinion's accounts'. */
export function configDirs() {
  const own = process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude');
  const accounts = accountNames().flatMap((name) => configDirOf(name) ?? []);
  return [...new Set([own, ...accounts])];
}

let reading: Promise<UsageHistory> | undefined;

/**
 * Every day Claude Code was used on this machine, read from its transcripts. What was read is kept in
 * `~/.jinion/usage/claude.json`, so later reads only go through what was added since, and days stay after Claude Code
 * deletes their transcripts. Days no transcript read has come from Claude Code's own summary.
 */
export function readHistory(progress?: (done: number, total: number) => void, dirs = configDirs()): Promise<UsageHistory> {
  reading ??= scan(dirs, progress).finally(() => {
    reading = undefined;
  });
  return reading;
}

async function scan(dirs: string[], progress?: (done: number, total: number) => void): Promise<UsageHistory> {
  const cache = readJson<Cache>(cacheFile(), { version: 1, files: {} });
  if (cache.version !== 1) Object.assign(cache, { version: 1, files: {} });
  // Jinion's accounts link their `projects` to the same transcripts, which count once.
  const files = unique(dirs.flatMap((dir) => transcripts(join(dir, 'projects'))));
  const stale = files.flatMap((path) => {
    try {
      const { size, mtimeMs } = statSync(path);
      const known = cache.files[path];
      return known && known.size === size && known.mtimeMs === mtimeMs ? [] : [{ path, size, mtimeMs }];
    } catch {
      return [];
    }
  });
  for (const [index, file] of stale.entries()) {
    progress?.(index, stale.length);
    cache.files[file.path] = readTranscript(file.path, file.size, file.mtimeMs, cache.files[file.path]);
    // A first read goes through hundreds of megabytes; the screen keeps drawing in between.
    await new Promise((resolve) => setImmediate(resolve));
  }
  progress?.(stale.length, stale.length);
  if (stale.length > 0) writeJson(cacheFile(), cache);
  return toHistory(Object.values(cache.files), dirs);
}

/** Paths by where they really lead, each once. */
function unique(paths: string[]) {
  return [
    ...new Set(
      paths.flatMap((path) => {
        try {
          return [realpathSync(path)];
        } catch {
          return [];
        }
      }),
    ),
  ];
}

function transcripts(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return transcripts(path);
      return entry.name.endsWith('.jsonl') ? [path] : [];
    });
  } catch {
    return [];
  }
}

/** Reads what was added to a transcript since `known`, or all of it when it was rewritten. */
export function readTranscript(path: string, size: number, mtimeMs: number, known?: FileRecord): FileRecord {
  const record: FileRecord =
    known && size >= known.offset ? { ...known, size, mtimeMs } : { size, mtimeMs, offset: 0, recent: [], days: {} };
  const fd = openSync(path, 'r');
  try {
    const buffer = Buffer.alloc(size - record.offset);
    readSync(fd, buffer, 0, buffer.length, record.offset);
    const end = buffer.lastIndexOf(0x0a) + 1;
    for (const line of buffer.subarray(0, end).toString('utf8').split('\n')) addLine(record, line);
    record.offset += end;
  } finally {
    closeSync(fd);
  }
  return record;
}

function addLine(record: FileRecord, line: string) {
  // Most lines are tool results and file snapshots; only responses count.
  if (!line.includes('"assistant"')) return;
  let entry: { type?: string; sessionId?: string; timestamp?: string; message?: Record<string, unknown> };
  try {
    entry = JSON.parse(line);
  } catch {
    return;
  }
  const message = entry.message;
  // Claude Code stands in `<synthetic>` responses for failed requests, which nobody worked on.
  if (entry.type !== 'assistant' || !message || !entry.timestamp || message.model === '<synthetic>') return;
  const time = Date.parse(entry.timestamp);
  record.session ??= entry.sessionId;
  record.start = Math.min(record.start ?? time, time);
  record.end = Math.max(record.end ?? time, time);
  const date = dayKey(new Date(time));
  record.days[date] ??= { messages: 0, toolCalls: 0, models: {} };
  const day = record.days[date];
  const content = Array.isArray(message.content) ? (message.content as { type?: string }[]) : [];
  day.toolCalls += content.filter((block) => block.type === 'tool_use').length;

  const id = typeof message.id === 'string' ? message.id : undefined;
  const model = typeof message.model === 'string' ? message.model : '';
  const usage = message.usage as Record<string, number> | undefined;
  if (!id || !usage || record.recent.includes(id)) return;
  record.recent = [...record.recent.slice(1 - RECENT), id];
  day.messages += 1;
  day.models[model] ??= [0, 0, 0, 0];
  const tokens = day.models[model];
  tokens[0] += usage.input_tokens ?? 0;
  tokens[1] += usage.output_tokens ?? 0;
  tokens[2] += usage.cache_read_input_tokens ?? 0;
  tokens[3] += usage.cache_creation_input_tokens ?? 0;
}

/** The days of every transcript ever read, and the days none of them has from Claude Code's own summary. */
export function toHistory(records: FileRecord[], dirs: string[]): UsageHistory {
  const days = new Map<string, DayUsage & { ids: Set<string> }>();
  const dayOf = (date: string) => {
    let day = days.get(date);
    if (!day) {
      day = { date, messages: 0, sessions: 0, toolCalls: 0, models: {}, ids: new Set() };
      days.set(date, day);
    }
    return day;
  };
  const sessions = new Map<string, { id: string; start: number; end: number }>();
  for (const record of records) {
    for (const [date, counted] of Object.entries(record.days)) {
      const day = dayOf(date);
      day.messages += counted.messages;
      day.toolCalls += counted.toolCalls;
      if (record.session) day.ids.add(record.session);
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
    const day = dayOf(imported.date);
    day.messages += Math.round(imported.messages * scale.messages);
    day.sessions += imported.sessions;
    day.toolCalls += Math.round(imported.toolCalls * scale.toolCalls);
    for (const [model, tokens] of Object.entries(imported.models)) {
      day.models[model] ??= { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
      const known = day.models[model];
      known.summarized = (known.summarized ?? 0) + (tokens.summarized ?? 0) * scale.tokens;
    }
  }
  return {
    days: [...days.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(({ ids, ...day }) => ({ ...day, sessions: day.sessions + ids.size })),
    sessions: [...sessions.values()],
  };
}

function add(models: Record<string, ModelTokens>, name: string, [input, output, cacheRead, cacheWrite]: Tokens) {
  models[name] ??= { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  const tokens = models[name];
  tokens.input += input;
  tokens.output += output;
  tokens.cacheRead += cacheRead;
  tokens.cacheWrite += cacheWrite;
}

/**
 * How Claude Code's summary compares with the transcripts on the days both have: it counts messages and tokens its own
 * way, several times what the responses in the transcripts add up to. Its days from before the transcripts are scaled
 * by it, so the calendar reads the same before and after.
 */
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

/** Claude Code's `stats-cache.json` of each folder, added up; its shape is Claude Code's own, so anything off is skipped. */
function summaryDays(dirs: string[]): DayUsage[] {
  const days = new Map<string, DayUsage>();
  for (const path of unique(dirs.map((dir) => join(dir, 'stats-cache.json')))) {
    if (!existsSync(path)) continue;
    let stats: StatsCache;
    try {
      stats = JSON.parse(readFileSync(path, 'utf8')) as StatsCache;
    } catch {
      continue;
    }
    const dayOf = (date: string) => {
      let day = days.get(date);
      if (!day) {
        day = { date, messages: 0, sessions: 0, toolCalls: 0, models: {} };
        days.set(date, day);
      }
      return day;
    };
    for (const activity of Array.isArray(stats.dailyActivity) ? stats.dailyActivity : []) {
      if (typeof activity?.date !== 'string') continue;
      const day = dayOf(activity.date);
      day.messages += activity.messageCount ?? 0;
      day.sessions += activity.sessionCount ?? 0;
      day.toolCalls += activity.toolCallCount ?? 0;
    }
    for (const tokens of Array.isArray(stats.dailyModelTokens) ? stats.dailyModelTokens : []) {
      if (typeof tokens?.date !== 'string') continue;
      const day = dayOf(tokens.date);
      for (const [model, total] of Object.entries(tokens.tokensByModel ?? {})) {
        if (typeof total !== 'number') continue;
        const name = modelName(model);
        day.models[name] ??= { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
        const known = day.models[name];
        known.summarized = (known.summarized ?? 0) + total;
      }
    }
  }
  return [...days.values()];
}
