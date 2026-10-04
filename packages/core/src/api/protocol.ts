import { z } from 'zod';
import type { AgentMode, FileChanges, PlanDecision, RewindScope } from '../agent/agent.js';
import type { AgentAccount } from '../agent/accounts.js';
import type { McpServerInfo } from '../agent/mcp.js';
import type { ModelSelection } from '../agent/models.js';
import type { PermissionDecision } from '../agent/permissions.js';
import type { QuestionAnswer } from '../agent/questions.js';
import type { AgentUsage, ContextUsage, UsageHistory } from '../agent/usage.js';
import type { CommandInfo } from '../commands/registry.js';
import type { AppInfo, PromptFill, View } from '../controllers/context.js';
import type { RewindPoint } from '../controllers/conversation.js';
import type { SentAction } from '../controllers/session.js';
import type { NoticeTone } from '../conversation/entries.js';
import type { SessionState } from '../conversation/session.js';
import type { RepoChanges } from '../git/changes.js';
import type { GitStatus } from '../git/status.js';
import type { Memory } from '../memory/store.js';
import type { Submission } from '../prompt/submission.js';
import type { AppFields, FieldChange, SessionFields } from './fields.js';

/** The core's types that come over the API, so a client imports them from it rather than from where the core keeps them. */
export type { AppInfo, PromptFill, View } from '../controllers/context.js';
export type { RewindPoint } from '../controllers/conversation.js';
export type { RepoChanges } from '../git/changes.js';
export type { FileChange } from '../git/repos.js';
export type { GitStatus } from '../git/status.js';

/** Raised when a change would break a client written for the one before. */
export const PROTOCOL_VERSION = 1;

/** The protocol's own error codes, in the range JSON-RPC leaves to it. */
export const ApiCode = {
  notInitialized: -32001,
  unsupportedVersion: -32002,
  unknownSession: -32003,
  dialogGone: -32004,
  unsupported: -32005,
  unknownFile: -32006,
} as const;

const empty = z.object({});

const name = z.object({ name: z.string() });

const session = z.object({ session: z.string() });

const mode = z.enum(['manual', 'edits', 'plan', 'auto']) satisfies z.ZodType<AgentMode>;

const submission = z.object({
  text: z.string(),
  prompt: z
    .object({ text: z.string(), images: z.array(z.object({ mediaType: z.string(), data: z.string() })).optional() })
    .optional(),
}) satisfies z.ZodType<Submission>;

const questionAnswer = z.object({
  options: z.array(z.number().int().nonnegative()),
  text: z.string().optional(),
  note: z.string().optional(),
}) satisfies z.ZodType<QuestionAnswer>;

const permissionDecision = z.union([
  z.object({ allow: z.literal(true), always: z.boolean().optional() }),
  z.object({ allow: z.literal(false), note: z.string().optional() }),
]) satisfies z.ZodType<PermissionDecision>;

const planDecision = z.union([
  z.object({ approve: z.literal(true), mode }),
  z.object({ approve: z.literal(false), note: z.string().optional() }),
]) satisfies z.ZodType<PlanDecision>;

const selection = z.object({ model: z.string(), effort: z.string().optional() }) satisfies z.ZodType<ModelSelection>;

const rewindPoint = z.object({ entry: z.string(), promptId: z.string(), text: z.string() }) satisfies z.ZodType<RewindPoint>;

const rewindScope = z.object({ code: z.boolean(), conversation: z.boolean() }) satisfies z.ZodType<RewindScope>;

const tone = z.enum(['muted', 'success', 'warning', 'error']) satisfies z.ZodType<NoticeTone>;

/** The params of everything a client sends, checked where they come in, since a client may be any program. */
export const clientSchemas = {
  initialize: z.object({
    protocolVersion: z.number().int(),
    client: z.object({ name: z.string(), version: z.string() }),
    /** How this client tells the user something while they look elsewhere. */
    notifications: z.enum(['desktop', 'bell']).optional(),
  }),
  'app/quit': empty,

  /** A new conversation, or the saved one `resume` names, beside those open. */
  'sessions/open': z.object({ resume: z.string().optional(), worktree: z.boolean().optional() }),
  /** A new conversation, or the saved one `resume` names, in place of `session`, as `/clear` and `/resume` do. */
  'sessions/replace': session.extend({ resume: z.string().optional() }),
  'sessions/activate': session,
  'sessions/close': session,
  'saved/list': empty,

  /** Answered with the conversation as it is; every change after it comes as `session/action`. */
  'session/subscribe': session,
  'session/unsubscribe': session,
  /** What the user sent: a prompt, a message for the running turn, or a slash command. */
  'session/submit': session.extend(submission.shape),
  /** Sent once the running turn ends, or at once when none runs. */
  'session/queue': session.extend(submission.shape),
  'session/interrupt': session,
  /** A line in the conversation from the client, e.g. that a paste couldn't be read. */
  'session/notice': session.extend({ text: z.string(), tone: tone.optional() }),
  'session/model': session.extend({ selection }),
  'session/mode': session.extend({ mode }),
  /** The default for new sessions, and this one's choice while it hasn't started. */
  'session/worktree': session.extend({ on: z.boolean() }),
  'session/stop-task': session.extend({ task: z.string() }),
  /** The end of what a task wrote, by the task's id, so a client never names a file. */
  'session/task-output': session.extend({ task: z.string() }),
  /** Sends the command or subagent the turn waits for to the background. */
  'session/background': session,
  'session/context': session,
  /** Shows the messages it can go back to, or says why it can't. */
  'session/open-rewind': session,
  'session/rewind-preview': session.extend({ prompt: z.string() }),
  'session/rewind': session.extend({ point: rewindPoint, scope: rewindScope }),

  /** Names the dialog it answers, so an answer meant for one that is gone answers nothing else. */
  'dialog/answer': z.discriminatedUnion('dialog', [
    session.extend({ dialog: z.literal('ask'), answer: z.array(questionAnswer) }),
    session.extend({ dialog: z.literal('permission'), answer: permissionDecision }),
    session.extend({ dialog: z.literal('plan'), answer: planDecision }),
  ]),
  'dialog/cancel': session,

  /** In the folder the session works in, its worktree or the project. */
  'git/status': session,
  'git/changes': session,
  /** A file from the session's last `git/changes`, by its absolute path. */
  'git/diff': session.extend({ file: z.string() }),
  'files/list': session,

  'accounts/list': empty,
  'accounts/select': name,
  'accounts/remove': name,
  /** Answered once signing in ends; meanwhile the link and what to type come as notifications. */
  'accounts/sign-in': name,
  'accounts/sign-in-answer': name.extend({ text: z.string() }),
  'accounts/sign-in-cancel': name,

  'mcp/servers': empty,
  /** The servers to have on, by name; the others go off. */
  'mcp/save': z.object({ enabled: z.array(z.string()) }),
  'memory/list': empty,
  'memory/forget': z.object({ scope: z.enum(['user', 'project']), id: z.string() }),
  'usage/limits': z.object({ drivers: z.boolean().optional() }),
  /** `usage/history-progress` tells how far it got. */
  'usage/history': empty,

  'client/focus': z.object({ focused: z.boolean() }),
};

type ClientParams = { [M in keyof typeof clientSchemas]: z.infer<(typeof clientSchemas)[M]> };

/** What the backend can do; a client leaves out what it can't. */
export interface AgentFeatures {
  accounts: boolean;
  mcp: boolean;
  usage: boolean;
  history: boolean;
  steer: boolean;
  rewind: boolean;
  context: boolean;
  background: boolean;
  compact: boolean;
}

export interface AgentInfo {
  name: string;
  modes: AgentMode[];
  features: AgentFeatures;
}

export interface SessionSummary {
  id: string;
  title?: string;
  working: boolean;
}

/** The open sessions, in the order they opened, and the one the user looks at. */
export interface Sessions {
  sessions: SessionSummary[];
  active?: string;
}

/** `seq` is the session's last action; each `session/action` after it carries the next number. */
export interface SessionSnapshot {
  state: SessionState;
  fields: SessionFields;
  seq: number;
}

export interface SavedSummary {
  id: string;
  title: string;
  updatedAt: number;
  messages: number;
  firstPrompt?: string;
  worktree?: string;
}

export interface MemoryNote extends Memory {
  path: string;
}

export interface Initialized extends Sessions {
  protocolVersion: number;
  server: { name: string; version: string };
  info: AppInfo;
  agent: AgentInfo;
  commands: CommandInfo[];
  app: AppFields;
}

interface ServerResults {
  initialize: Initialized;
  'app/quit': null;
  'sessions/open': { session: string };
  'sessions/replace': null;
  'sessions/activate': null;
  /** `false` when the user chose to keep it open, e.g. over a worktree with work in it. */
  'sessions/close': { closed: boolean };
  'saved/list': SavedSummary[];
  'session/subscribe': SessionSnapshot;
  'session/unsubscribe': null;
  'session/submit': null;
  'session/queue': null;
  'session/interrupt': null;
  'session/notice': null;
  'session/model': null;
  'session/mode': null;
  'session/worktree': null;
  'session/stop-task': null;
  'session/task-output': string[] | null;
  'session/background': null;
  'session/context': ContextUsage;
  'session/open-rewind': null;
  'session/rewind-preview': FileChanges | null;
  'session/rewind': null;
  'dialog/answer': null;
  'dialog/cancel': null;
  'git/status': GitStatus | null;
  'git/changes': RepoChanges[];
  'git/diff': string;
  'files/list': string[];
  'accounts/list': AgentAccount[];
  'accounts/select': null;
  'accounts/remove': null;
  'accounts/sign-in': { signedIn: boolean };
  'accounts/sign-in-answer': null;
  'accounts/sign-in-cancel': null;
  'mcp/servers': McpServerInfo[];
  'mcp/save': null;
  'memory/list': MemoryNote[];
  'memory/forget': null;
  'usage/limits': AgentUsage;
  'usage/history': UsageHistory;
}

/** What the server answers. */
export type ServerContract = {
  requests: { [M in keyof ServerResults]: { params: ClientParams[M]; result: ServerResults[M] } };
  notifications: { 'client/focus': ClientParams['client/focus'] };
};

/** What a client answers: for now only what the server tells it. */
export type ClientContract = {
  requests: Record<never, never>;
  notifications: {
    'sessions/changed': Sessions;
    'session/action': SentAction & { session: string };
    'session/field': FieldChange<SessionFields> & { session: string };
    'app/field': FieldChange<AppFields>;
    /** A command asked to show something, such as a picker. */
    'screen/view': { view: View };
    /** Text for the prompt of `session`, e.g. the message a rewind went back to. */
    'screen/fill-prompt': { session: string; text: string; fill: PromptFill };
    'screen/notify': { title: string; body: string };
    'screen/expand': Record<never, never>;
    'screen/exit': Record<never, never>;
    'accounts/sign-in-link': { name: string; url: string };
    /** `problem` says why it asks again, e.g. a code that didn't work. */
    'accounts/sign-in-prompt': { name: string; prompt: string; problem?: string };
    'usage/history-progress': { done: number; total: number };
  };
};
