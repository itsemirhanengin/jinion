import { closeSync, openSync, readdirSync, readSync, realpathSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { dayKey } from '@jinion/tui';
import { readJson, writeJson } from '../../lib/json-file.js';
import { jinionHome } from '../../lib/paths.js';

/** Input, output, cache read and cache write tokens. */
export type Tokens = [number, number, number, number];

interface FileDay {
  messages: number;
  toolCalls: number;
  models: Record<string, Tokens>;
}

export interface FileRecord {
  size: number;
  mtimeMs: number;
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

const RECENT = 64;
const cacheFile = () => join(jinionHome(), 'usage', 'claude.json');

/** Kept in `~/.jinion/usage/claude.json`, so later reads only go through what was added, and records outlive their transcripts. */
export async function readTranscripts(dirs: string[], progress?: (done: number, total: number) => void): Promise<FileRecord[]> {
  const cache = readJson<Cache>(cacheFile(), { version: 1, files: {} });

  if (cache.version !== 1) Object.assign(cache, { version: 1, files: {} });

  // Jinion's accounts link their `projects` to the same transcripts, which count once.
  const files = realPaths(dirs.flatMap((dir) => transcripts(join(dir, 'projects'))));

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

  return Object.values(cache.files);
}

export function realPaths(paths: string[]) {
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

function readTranscript(path: string, size: number, mtimeMs: number, known?: FileRecord): FileRecord {
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
  const date = dayKey(new Date(time));

  record.session ??= entry.sessionId;
  record.start = Math.min(record.start ?? time, time);
  record.end = Math.max(record.end ?? time, time);

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
