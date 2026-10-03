import type { Status } from '@jinion/tui';
import type { NoticeTone } from '@jinion/tui/chat';
import type { BackgroundTask } from '../agent/tasks.js';
import type { ToolRun } from '../agent/tools.js';

export type Entry =
  | { id: string; kind: 'banner' }
  /** `prompt` is what the agent got when pastes made it longer; `steered` messages joined a running turn. */
  | { id: string; kind: 'user'; text: string; prompt?: string; steered?: boolean; promptId?: string }
  /** Older sessions have neither time. */
  | { id: string; kind: 'thinking'; text: string; startedAt?: number; endedAt?: number }
  | { id: string; kind: 'text'; text: string }
  | { id: string; kind: 'notice'; text: string; tone: NoticeTone }
  | { id: string; kind: 'compaction'; trigger: 'manual' | 'auto'; before: number; after?: number; summary?: string }
  | { id: string; kind: 'task'; task: BackgroundTask; summary?: string }
  /** `turn` is the message whose turn view in `/diff` has them. */
  | { id: string; kind: 'changes'; turn: string; files: ChangedFile[] }
  | {
      id: string;
      kind: 'tool';
      run: ToolRun;
      status: Status;
      output: string[];
      startedAt: number;
      endedAt?: number;
      children?: ToolCallEntry[];
      waiting?: boolean;
      approvedAt?: number;
    };

export type EntryOf<K extends Entry['kind']> = Extract<Entry, { kind: K }>;

export type ToolEntry = EntryOf<'tool'>;

export interface ChangedFile {
  path: string;
  created: boolean;
  added: number;
  removed: number;
}

export interface ToolCallEntry {
  id: string;
  run: ToolRun;
  status: Status;
  startedAt: number;
  endedAt?: number;
}

let sequence = 0;
/** Saved sessions come back in later runs, so ids carry a per-run prefix to stay unique next to their entries. */
const run = Math.random().toString(36).slice(2, 8);
export const nextId = () => `${run}${++sequence}`;

export const noticeEntry = (text: string, tone: NoticeTone): Entry => ({ id: nextId(), kind: 'notice', text, tone });

export const isBackground = (entry: ToolEntry) =>
  (entry.run.name === 'bash' || entry.run.name === 'agent') && entry.run.result?.background !== undefined;

export const isPrompt = (entry: Entry): entry is EntryOf<'user'> => entry.kind === 'user' && !entry.steered;

export const promptCount = (entries: Entry[]) => entries.filter(isPrompt).length;

export function lastToolRun<N extends ToolRun['name']>(entries: Entry[], tool: N) {
  const entry = entries.findLast((candidate) => candidate.kind === 'tool' && candidate.run.name === tool);
  return entry?.kind === 'tool' ? (entry.run as Extract<ToolRun, { name: N }>) : undefined;
}
