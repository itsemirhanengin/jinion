import { z } from 'zod';
import { AgentAccount } from '../agent/accounts.js';
import { AgentMode, FileChanges, PlanDecision, RewindScope } from '../agent/agent.js';
import { McpServerInfo } from '../agent/mcp.js';
import { ModelSelection } from '../agent/models.js';
import { PermissionDecision } from '../agent/permissions.js';
import { QuestionAnswer } from '../agent/questions.js';
import { AgentUsage, ContextUsage, UsageHistory, UsageProfile } from '../agent/usage.js';
import { PromptFill, RewindPoint, View } from '../controllers/context.js';
import { NoticeTone } from '../conversation/entries.js';
import { SentAction } from '../conversation/reducer.js';
import { GitStatus, RepoChanges } from '../git/types.js';
import { MemoryScope } from '../memory/types.js';
import { DevScript, DevServer } from '../preview/types.js';
import { Submission } from '../prompt/submission.js';
import { TerminalInfo, TerminalOutput } from '../terminals/types.js';
import {
  AppFieldChange,
  Initialized,
  MemoryNote,
  SavedSummary,
  SessionFieldChange,
  Sessions,
  SessionSnapshot,
} from './schemas.js';

/** The core's types that come over the API, so a client imports them from it rather than from where the core keeps them. */
export type { AgentInfo, SessionFeatures } from '../agent/agent.js';
export type { AppInfo, PromptFill, RewindPoint, View } from '../controllers/context.js';
export type { FileChange, GitStatus, RepoChanges } from '../git/types.js';
export type { DevScript, DevServer } from '../preview/types.js';
export type { TerminalInfo, TerminalOutput } from '../terminals/types.js';
export type * from './schemas.js';

/**
 * Raised only when a change would break a client written for the one before. Adding a method, a notification or an
 * optional field doesn't: a client ignores what it doesn't know. Removing or renaming any, or making a field required,
 * does.
 */
export const PROTOCOL_VERSION = 2;

/** The protocol's own error codes, in the range JSON-RPC leaves to it. */
export const ApiCode = {
  notInitialized: -32001,
  unsupportedVersion: -32002,
  unknownSession: -32003,
  dialogGone: -32004,
  unsupported: -32005,
  unknownFile: -32006,
  /** Another Jinion has the conversation open; `data.pid` is that process. */
  openElsewhere: -32007,
  unknownTerminal: -32008,
} as const;

const empty = z.object({});

const done = z.null();

const name = z.object({ name: z.string() });

/** An account by its name, of the backend the user looks at or of the one `agent` names. */
const account = name.extend({ agent: z.string().optional() });

const session = z.object({ session: z.string() });

const terminal = z.object({ terminal: z.string() });

/** Columns or rows of a terminal. */
const size = z.number().int().min(2).max(1000).optional();

/** Every method the server answers: what a client sends, checked where it comes in, and what it gets back. */
export const requests = {
  initialize: {
    params: z.object({
      protocolVersion: z.number().int(),
      client: z.object({ name: z.string(), version: z.string() }),
      /** How this client tells the user something while they look elsewhere. */
      notifications: z.enum(['desktop', 'bell']).optional(),
    }),
    result: Initialized,
  },
  'app/quit': { params: empty, result: done },

  /**
   * A new conversation, or the saved one `resume` names, beside those open; one already open comes back instead.
   * `activate` makes it the one the user looks at, as a new tab is.
   */
  'sessions/open': {
    params: z.object({ resume: z.string().optional(), worktree: z.boolean().optional(), activate: z.boolean().optional() }),
    result: z.object({ session: z.string() }),
  },
  /** A new conversation, or the saved one `resume` names, in place of `session`, as `/clear` and `/resume` do. */
  'sessions/replace': { params: session.extend({ resume: z.string().optional() }), result: done },
  'sessions/activate': { params: session, result: done },
  /** `closed` is `false` when the user chose to keep it open, e.g. over a worktree with work in it. */
  'sessions/close': { params: session, result: z.object({ closed: z.boolean() }) },
  'saved/list': { params: empty, result: z.array(SavedSummary) },

  /** Answered with the conversation as it is; every change after it comes as `session/action`. */
  'session/subscribe': { params: session, result: SessionSnapshot },
  'session/unsubscribe': { params: session, result: done },
  /** What the user sent: a prompt, a message for the running turn, or a slash command. */
  'session/submit': { params: session.extend(Submission.shape), result: done },
  /** Sent once the running turn ends, or at once when none runs. */
  'session/queue': { params: session.extend(Submission.shape), result: done },
  /**
   * Takes a queued message back as it was sent, the first with this text, so the queue moving on can't hand back
   * another; null when it was sent meanwhile.
   */
  'session/unqueue': { params: session.extend({ text: z.string() }), result: Submission.nullable() },
  'session/interrupt': { params: session, result: done },
  /** A line in the conversation from the client, e.g. that a paste couldn't be read. */
  'session/notice': { params: session.extend({ text: z.string(), tone: NoticeTone.optional() }), result: done },
  /** A model of another backend, named by `agent`, moves the conversation there. */
  'session/model': { params: session.extend({ selection: ModelSelection, agent: z.string().optional() }), result: done },
  'session/mode': { params: session.extend({ mode: AgentMode }), result: done },
  /** The default for new sessions, and this one's choice while it hasn't started. */
  'session/worktree': { params: session.extend({ on: z.boolean() }), result: done },
  'session/stop-task': { params: session.extend({ task: z.string() }), result: done },
  /** The end of what a task wrote, by the task's id, so a client never names a file. */
  'session/task-output': { params: session.extend({ task: z.string() }), result: z.array(z.string()).nullable() },
  /** Sends the command or subagent the turn waits for to the background. */
  'session/background': { params: session, result: done },
  'session/context': { params: session, result: ContextUsage },
  /** Shows the messages it can go back to, or says why it can't. */
  'session/open-rewind': { params: session, result: done },
  'session/rewind-preview': { params: session.extend({ prompt: z.string() }), result: FileChanges.nullable() },
  'session/rewind': { params: session.extend({ point: RewindPoint, scope: RewindScope }), result: done },

  /** Names the dialog it answers, so an answer meant for one that is gone answers nothing else. */
  'dialog/answer': {
    params: z.discriminatedUnion('dialog', [
      session.extend({ dialog: z.literal('ask'), answer: z.array(QuestionAnswer) }),
      session.extend({ dialog: z.literal('permission'), answer: PermissionDecision }),
      session.extend({ dialog: z.literal('plan'), answer: PlanDecision }),
    ]),
    result: done,
  },
  'dialog/cancel': { params: session, result: done },

  /** In the folder the session works in, its worktree or the project. */
  'git/status': { params: session, result: GitStatus.nullable() },
  /** `uncommitted` keeps to what isn't committed, with what is staged, rather than a clean branch's own commits. */
  'git/changes': { params: session.extend({ uncommitted: z.boolean().optional() }), result: z.array(RepoChanges) },
  /** Files from the session's last `git/changes`, by their absolute paths, into the index or out of it. */
  'git/stage': { params: session.extend({ files: z.array(z.string()) }), result: done },
  'git/unstage': { params: session.extend({ files: z.array(z.string()) }), result: done },
  /** What is staged in the repository whose root is `repo`; the new commit, short. */
  'git/commit': { params: session.extend({ repo: z.string(), message: z.string().min(1) }), result: z.object({ commit: z.string() }) },
  /** A file from the session's last `git/changes`, by its absolute path. */
  'git/diff': { params: session.extend({ file: z.string() }), result: z.string() },
  'files/list': { params: session, result: z.array(z.string()) },
  /** A file in the folder the session works in, by its path there, as `files/list` names it; any other is refused. */
  'files/read': { params: session.extend({ path: z.string() }), result: z.string() },

  // The project's terminals, which outlive sessions; their output comes as `terminals/output` to the clients attached.
  'terminals/list': { params: empty, result: z.array(TerminalInfo) },
  /** A shell in the folder `session` works in, its worktree or the project, or in the project without one. */
  'terminals/open': { params: z.object({ session: z.string().optional(), cols: size, rows: size }), result: TerminalInfo },
  /** The screen as escape codes that draw it, and the `seq` of the last output in it; what comes after is sent from now on. */
  'terminals/attach': { params: terminal, result: z.object({ screen: z.string(), seq: z.number() }) },
  'terminals/detach': { params: terminal, result: done },
  /** What the user types, as the terminal takes it. */
  'terminals/write': { params: terminal.extend({ data: z.string() }), result: done },
  'terminals/resize': { params: terminal.extend({ cols: size.unwrap(), rows: size.unwrap() }), result: done },
  /** Ends what runs in it, and takes it out of the list. */
  'terminals/close': { params: terminal, result: done },

  /** The local addresses the terminals printed whose server answers now, for a preview to open. */
  'preview/servers': { params: empty, result: z.array(DevServer) },
  /** The scripts that start a server in the folder `session` works in, or in the project without one. */
  'preview/scripts': { params: z.object({ session: z.string().optional() }), result: z.array(DevScript) },

  // Accounts, MCP servers and usage are those of the backend the session the user looks at runs on; an account call
  // with `agent` is about that backend instead.
  'accounts/list': { params: z.object({ agent: z.string().optional() }), result: z.array(AgentAccount) },
  'accounts/select': { params: account, result: done },
  'accounts/remove': { params: account, result: done },
  /** Answered once signing in ends; meanwhile the link and what to type come as notifications. */
  'accounts/sign-in': { params: account, result: z.object({ signedIn: z.boolean() }) },
  'accounts/sign-in-answer': { params: account.extend({ text: z.string() }), result: done },
  'accounts/sign-in-cancel': { params: account, result: done },

  'mcp/servers': { params: empty, result: z.array(McpServerInfo) },
  /** The servers to have on, by name; the others go off. */
  'mcp/save': { params: z.object({ enabled: z.array(z.string()) }), result: done },
  'memory/list': { params: empty, result: z.array(MemoryNote) },
  'memory/forget': { params: z.object({ scope: MemoryScope, id: z.string() }), result: done },
  'usage/limits': { params: z.object({ drivers: z.boolean().optional() }), result: AgentUsage },
  /** `usage/history-progress` tells how far it got. */
  'usage/history': { params: empty, result: UsageHistory },
  /** The user as a profile shows them: their name in git, and every backend's history together. */
  'profile/read': { params: empty, result: z.object({ name: z.string().optional(), usage: UsageProfile }) },
};

/** What a client tells the server, with no answer. */
export const notificationsToServer = {
  'client/focus': z.object({ focused: z.boolean() }),
};

/** What the server tells a client, with no answer. */
export const notificationsToClient = {
  'sessions/changed': Sessions,
  'session/action': SentAction.extend({ session: z.string() }),
  'session/field': SessionFieldChange,
  'app/field': AppFieldChange,
  /** A command asked to show something, such as a picker. */
  'screen/view': z.object({ view: View }),
  /** Text for the prompt of `session`, e.g. the message a rewind went back to. */
  'screen/fill-prompt': z.object({ session: z.string(), text: z.string(), fill: PromptFill }),
  'screen/notify': z.object({ title: z.string(), body: z.string() }),
  'screen/expand': empty,
  'screen/exit': empty,
  'accounts/sign-in-link': account.extend({ url: z.string() }),
  /** `problem` says why it asks again, e.g. a code that didn't work. */
  'accounts/sign-in-prompt': account.extend({ prompt: z.string(), problem: z.string().optional() }),
  'usage/history-progress': z.object({ done: z.number(), total: z.number() }),
  /** Every terminal, whenever one opens, ends or closes; one the agent started is new in it. */
  'terminals/changed': z.object({ terminals: z.array(TerminalInfo) }),
  'terminals/output': TerminalOutput,
};

/** The params of everything a client sends, as the server's peer checks them. */
export const clientSchemas: Record<string, z.ZodType> = {
  ...Object.fromEntries(Object.entries(requests).map(([method, { params }]) => [method, params])),
  ...notificationsToServer,
};

type Requests = typeof requests;

type Inferred<T extends Record<string, z.ZodType>> = { [K in keyof T]: z.infer<T[K]> };

/** What the server answers. */
export type ServerContract = {
  requests: { [M in keyof Requests]: { params: z.infer<Requests[M]['params']>; result: z.infer<Requests[M]['result']> } };
  notifications: Inferred<typeof notificationsToServer>;
};

/** What a client answers: for now only what the server tells it. */
export type ClientContract = {
  requests: Record<never, never>;
  notifications: Inferred<typeof notificationsToClient>;
};
