import { z } from 'zod';
import { BackgroundTask } from '../agent/tasks.js';
import { ToolRun } from '../agent/tools.js';

export const Status = z.enum(['pending', 'running', 'done', 'error', 'cancelled']);

export type Status = z.infer<typeof Status>;

export const NoticeTone = z.enum(['muted', 'success', 'warning', 'error']);

export type NoticeTone = z.infer<typeof NoticeTone>;

export const ChangedFile = z.object({ path: z.string(), created: z.boolean(), added: z.number(), removed: z.number() });

export type ChangedFile = z.infer<typeof ChangedFile>;

export const ToolCallEntry = z.object({
  id: z.string(),
  run: ToolRun,
  status: Status,
  startedAt: z.number(),
  endedAt: z.number().optional(),
});

export type ToolCallEntry = z.infer<typeof ToolCallEntry>;

const id = z.string();

export const Entry = z.discriminatedUnion('kind', [
  z.object({ id, kind: z.literal('banner') }),
  /** `prompt` is what the agent got when pastes made it longer; `steered` messages joined a running turn. */
  z.object({
    id,
    kind: z.literal('user'),
    text: z.string(),
    prompt: z.string().optional(),
    steered: z.boolean().optional(),
    promptId: z.string().optional(),
  }),
  /** Older sessions have neither time. */
  z.object({ id, kind: z.literal('thinking'), text: z.string(), startedAt: z.number().optional(), endedAt: z.number().optional() }),
  z.object({ id, kind: z.literal('text'), text: z.string() }),
  z.object({ id, kind: z.literal('notice'), text: z.string(), tone: NoticeTone }),
  z.object({
    id,
    kind: z.literal('compaction'),
    trigger: z.enum(['manual', 'auto']),
    before: z.number(),
    after: z.number().optional(),
    summary: z.string().optional(),
  }),
  z.object({ id, kind: z.literal('task'), task: BackgroundTask, summary: z.string().optional() }),
  /** `turn` is the message whose turn view in `/diff` has them. */
  z.object({ id, kind: z.literal('changes'), turn: z.string(), files: z.array(ChangedFile) }),
  z.object({
    id,
    kind: z.literal('tool'),
    run: ToolRun,
    status: Status,
    output: z.array(z.string()),
    startedAt: z.number(),
    endedAt: z.number().optional(),
    children: z.array(ToolCallEntry).optional(),
    waiting: z.boolean().optional(),
    approvedAt: z.number().optional(),
  }),
]);

export type Entry = z.infer<typeof Entry>;

export type EntryOf<K extends Entry['kind']> = Extract<Entry, { kind: K }>;

export type ToolEntry = EntryOf<'tool'>;

/** An entry before the conversation gives it an id. */
export type NewEntry = DistributiveOmit<Entry, 'id'>;

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export const noticeEntry = (text: string, tone: NoticeTone): NewEntry => ({ kind: 'notice', text, tone });

export const isBackground = (entry: ToolEntry) =>
  (entry.run.name === 'bash' || entry.run.name === 'agent') && entry.run.result?.background !== undefined;

export const isPrompt = (entry: Entry): entry is EntryOf<'user'> => entry.kind === 'user' && !entry.steered;

export const promptCount = (entries: Entry[]) => entries.filter(isPrompt).length;

export function lastToolRun<N extends ToolRun['name']>(entries: Entry[], tool: N) {
  const entry = entries.findLast((candidate) => candidate.kind === 'tool' && candidate.run.name === tool);

  return entry?.kind === 'tool' ? (entry.run as Extract<ToolRun, { name: N }>) : undefined;
}
