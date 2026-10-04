import { z } from 'zod';
import { AgentAccount } from '../agent/accounts.js';
import { AgentCommand, AgentMode } from '../agent/agent.js';
import { ModelOption, ModelSelection } from '../agent/models.js';
import { BackgroundTask } from '../agent/tasks.js';
import { SeenLimits } from '../agent/usage.js';
import { CommandInfo } from '../commands/registry.js';
import { AppInfo } from '../controllers/context.js';
import { Dialog } from '../conversation/dialogs.js';
import { SessionState } from '../conversation/session.js';
import { Memory } from '../memory/types.js';
import { Submission } from '../prompt/submission.js';

/** What the backend can do; a client leaves out what it can't. */
export const AgentFeatures = z.object({
  accounts: z.boolean(),
  mcp: z.boolean(),
  usage: z.boolean(),
  history: z.boolean(),
  steer: z.boolean(),
  rewind: z.boolean(),
  context: z.boolean(),
  background: z.boolean(),
  compact: z.boolean(),
});

export type AgentFeatures = z.infer<typeof AgentFeatures>;

export const AgentInfo = z.object({ name: z.string(), modes: z.array(AgentMode), features: AgentFeatures });

export type AgentInfo = z.infer<typeof AgentInfo>;

export const SessionSummary = z.object({ id: z.string(), title: z.string().optional(), working: z.boolean() });

export type SessionSummary = z.infer<typeof SessionSummary>;

/** The open sessions, in the order they opened, and the one the user looks at. */
export const Sessions = z.object({ sessions: z.array(SessionSummary), active: z.string().optional() });

export type Sessions = z.infer<typeof Sessions>;

/** What every session shares that a client shows. `worktrees` is the default for new sessions. */
export const AppFields = z.object({
  models: z.array(ModelOption).optional(),
  account: z.string().optional(),
  identity: AgentAccount.optional(),
  skills: z.array(AgentCommand),
  seenLimits: SeenLimits,
  worktrees: z.boolean(),
});

export type AppFields = z.infer<typeof AppFields>;

/** What a client shows of a session besides its conversation, which it follows action by action instead. */
export const SessionFields = z.object({
  selection: ModelSelection,
  mode: AgentMode,
  tasks: z.array(BackgroundTask),
  dialog: Dialog.optional(),
  queue: z.array(Submission),
  wantsWorktree: z.boolean(),
  working: z.boolean(),
});

export type SessionFields = z.infer<typeof SessionFields>;

/** One field's new value, named, since a value gone to `undefined` would vanish from an object sent as JSON. */
export type FieldChange<V> = { [K in keyof V]-?: { name: K; value: V[K] } }[keyof V];

const changeOf = <V extends Record<string, unknown>>(fields: z.ZodObject, extra: z.ZodRawShape = {}) =>
  z.discriminatedUnion(
    'name',
    Object.entries(fields.shape).map(([name, value]) => z.object({ ...extra, name: z.literal(name), value })) as unknown as [
      z.ZodObject,
      ...z.ZodObject[],
    ],
  ) as unknown as z.ZodType<FieldChange<V>>;

export const AppFieldChange = changeOf<AppFields>(AppFields);

export const SessionFieldChange = changeOf<SessionFields>(SessionFields, { session: z.string() }) as unknown as z.ZodType<
  FieldChange<SessionFields> & { session: string }
>;

/** `seq` is the session's last action; each `session/action` after it carries the next number. */
export const SessionSnapshot = z.object({ state: SessionState, fields: SessionFields, seq: z.number().int() });

export type SessionSnapshot = z.infer<typeof SessionSnapshot>;

export const SavedSummary = z.object({
  id: z.string(),
  title: z.string(),
  updatedAt: z.number(),
  messages: z.number(),
  firstPrompt: z.string().optional(),
  worktree: z.string().optional(),
});

export type SavedSummary = z.infer<typeof SavedSummary>;

export const MemoryNote = Memory.extend({ path: z.string() });

export type MemoryNote = z.infer<typeof MemoryNote>;

export const Initialized = Sessions.extend({
  protocolVersion: z.number().int(),
  server: z.object({ name: z.string(), version: z.string() }),
  info: AppInfo,
  agent: AgentInfo,
  commands: z.array(CommandInfo),
  app: AppFields,
});

export type Initialized = z.infer<typeof Initialized>;
