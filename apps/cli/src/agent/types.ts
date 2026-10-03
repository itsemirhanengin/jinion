import type {
  ModelOption,
  ModelSelection,
  PermissionDecision,
  PermissionRequest,
  Question,
  QuestionAnswer,
  TodoGroup,
} from '@jinion/tui';

export interface FileRef {
  path: string;
  lines?: string;
}

export interface GrepMatch {
  file: string;
  line: number;
  text: string;
}

export interface Tools {
  read: { input: { files: FileRef[] }; result: Record<string, never> };
  /** `files` is set when only file names were searched for, without matching lines. */
  grep: { input: { pattern: string; path: string }; result: { matches: GrepMatch[]; files?: string[] } };
  glob: { input: { pattern: string }; result: { files: string[] } };
  /** `background` is the id of the background task the command went on as, instead of an exit code. */
  bash: { input: { command: string; timeoutMs: number }; result: { exitCode: number; wallMs: number; background?: string } };
  /** The input patch can be a preview; the result carries the applied one when it differs. */
  edit: { input: { path: string; patch: string; created?: boolean }; result: { patch?: string } };
  todo: { input: { groups: TodoGroup[] }; result: Record<string, never> };
  ask: { input: { questions: Question[] }; result: { answers: QuestionAnswer[] } };
  /** Jinion's own memory: `remember`, `recall` or `forget`, with what it is about. */
  memory: { input: { action: 'remember' | 'recall' | 'forget'; detail: string }; result: Record<string, never> };
  /** A plan the agent wants approved before it changes anything. */
  plan: { input: { plan: string }; result: Record<string, never> };
  /** Any tool without a dedicated view, such as MCP tools or subagents. */
  other: { input: { title: string; detail?: string }; result: Record<string, never> };
  /**
   * A subagent at work on part of the task. Its own tool calls come as events with this call's id as `parent`, also
   * after the call ended when it went on in the `background` task.
   */
  agent: { input: { description: string; kind?: string }; result: { background?: string } };
}

/** A command or subagent that runs on while the conversation goes on, e.g. a dev server. */
export interface BackgroundTask {
  id: string;
  kind: 'shell' | 'agent' | 'other';
  /** The command, or what the subagent does. */
  title: string;
  status: 'running' | 'completed' | 'failed' | 'stopped';
  startedAt: number;
  endedAt?: number;
  /** The file its output goes to as it runs. */
  output?: string;
  /** For a subagent: how many tool calls it made and the latest one. */
  calls?: number;
  lastCall?: string;
  /**
   * Still in the foreground: the turn waits for it, and `Agent.background` can send it to the background. The backend
   * lists a long command here after a few seconds.
   */
  foreground?: boolean;
}

/**
 * How freely the agent acts: `manual` asks before changes, `edits` changes project files without asking, `plan` only
 * reads until a plan is approved, and `auto` lets the backend's own safety review decide what needs asking.
 */
export type AgentMode = 'manual' | 'edits' | 'plan' | 'auto';

export type ToolName = keyof Tools;

export type ToolCall = { [N in ToolName]: { name: N; input: Tools[N]['input'] } }[ToolName];

export type ToolResult = Tools[ToolName]['result'];

/** A call together with its result once it has one, narrowed by `name`. */
export type ToolRun = { [N in ToolName]: { name: N; input: Tools[N]['input']; result?: Tools[N]['result'] } }[ToolName];

export interface Usage {
  contextTokens: number;
  contextWindow: number;
  cost: number;
  /** How full the context gets before the agent compacts it on its own, when it does. */
  compactAt?: number;
}

/** What fills the context window, by kind, for `/context`. */
export interface ContextUsage {
  used: number;
  /** The window measured against, which can be smaller than the model's, e.g. a compaction policy's. */
  window: number;
  /** Where the agent compacts on its own, when it does. */
  compactAt?: number;
  /**
   * In the agent's own order. `free` is room left, `buffer` what compaction keeps in reserve, and `deferred` what is
   * listed but only loads when used, e.g. MCP tools, which takes no room.
   */
  categories: { name: string; tokens: number; kind: 'used' | 'free' | 'buffer' | 'deferred' }[];
}

export type AgentEvent =
  | { type: 'thinking'; delta: string }
  | { type: 'text'; delta: string }
  /** `parent` is the `agent` call a subagent's own tool call belongs to. */
  | { type: 'tool-start'; id: string; call: ToolCall; parent?: string }
  | { type: 'tool-output'; id: string; lines: string[] }
  | { type: 'tool-end'; id: string; ok: boolean; result?: ToolResult; parent?: string }
  | { type: 'usage'; usage: Usage }
  /** The backend's own id for the conversation, which `Agent.reset` takes to continue it. */
  | { type: 'session'; id: string }
  /** How much of the user's plan is used up. Belongs to the account, not to the conversation. */
  | { type: 'limits'; windows: LimitWindow[] }
  /** The mode the agent is really in, e.g. after a plan was approved or when a mode isn't available. */
  | { type: 'mode'; mode: AgentMode }
  /** The skills and MCP prompts changed, e.g. as servers connect. */
  | { type: 'commands'; commands: AgentCommand[] }
  /** The backend's id for the prompt that started the turn, which `Agent.rewind` takes. */
  | { type: 'sent'; id: string }
  /** Every background task of the conversation, running or ended, whenever one starts, changes or ends. */
  | { type: 'tasks'; tasks: BackgroundTask[] }
  /** A background task ended; `summary` is the backend's own line about it. */
  | { type: 'task-end'; task: BackgroundTask; summary?: string }
  /**
   * Between turns: the agent started a turn of its own, e.g. to look at a background task that ended. `Agent.join`
   * follows it the way `run` follows a prompt.
   */
  | { type: 'turn-start'; reason?: string }
  /**
   * The conversation is being summarized to free context, asked for with `/compact` or on the agent's own as the
   * context fills; `before` and `after` are its tokens, `summary` what the agent carries on from.
   */
  | { type: 'compaction'; state: 'running' }
  | { type: 'compaction'; state: 'done'; trigger: 'manual' | 'auto'; before: number; after?: number; summary?: string }
  | { type: 'compaction'; state: 'failed'; error: string };

/** The tokens a model took in and gave back. */
export interface ModelTokens {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  /** Tokens known only as a total, e.g. from a summary of days whose records are gone. */
  summarized?: number;
}

/** What `/usage` shows of the present: the session so far, the plan's limits, and what adds to them. */
export interface AgentUsage {
  /** Since the agent started on this conversation. */
  session?: {
    cost: number;
    /** Time spent waiting for the model, and since the session began. */
    apiMs: number;
    wallMs: number;
    linesAdded: number;
    linesRemoved: number;
    models: (ModelTokens & { name: string; cost: number })[];
  };
  /** The plan's windows, e.g. the 5-hour one and the week; empty when the account has no plan limits. */
  limits: LimitWindow[];
  /** Extra usage the plan allows past its limits. */
  extra?: { used: number; limit?: number; currency?: string };
  /** What adds to the limits over the last day and week, from this machine's conversations. */
  drivers?: { day: UsageDrivers; week: UsageDrivers };
}

export interface UsageDrivers {
  requests: number;
  sessions: number;
  /** Traits of the usage, which overlap: each share is of the whole, so they don't add up to 100. */
  traits: { trait: 'cache-misses' | 'long-context' | 'subagents' | 'parallel' | 'scheduled'; share: number }[];
  /** The skills, subagents, plugins and MCP servers that used the most, as shares of the whole. */
  sources: { kind: 'skill' | 'agent' | 'plugin' | 'mcp'; name: string; share: number }[];
}

/** Every day the agent was used on this machine, for `/usage`'s stats. */
export interface UsageHistory {
  /** In date order. */
  days: DayUsage[];
  /** Each conversation's first and last activity, for the longest one. */
  sessions: { id: string; start: number; end: number }[];
}

export interface DayUsage {
  /** The local date, `2026-09-21`. */
  date: string;
  /** Model responses. */
  messages: number;
  /** Conversations active that day. */
  sessions: number;
  toolCalls: number;
  /** By model name, e.g. `Opus 5.5`. */
  models: Record<string, ModelTokens>;
}

/** One usage window of the user's plan, such as the 5-hour limit. */
export interface LimitWindow {
  /** Short, e.g. `5h` or `7d`. */
  label: string;
  /** From 0 to 1. */
  used: number;
  /** In milliseconds since the epoch. */
  resetsAt?: number;
}

export interface RunContext {
  signal: AbortSignal;
  /** Shows the questions to the user and resolves with one answer per question. */
  ask(questions: Question[]): Promise<QuestionAnswer[]>;
  /**
   * Asks the user whether the agent may go ahead. Rejects when the turn is interrupted instead. `call` is the tool call
   * it is for, which waits meanwhile.
   */
  approve(request: PermissionRequest, call?: string): Promise<PermissionDecision>;
  /** Asks the user to approve the plan shown in the conversation, offering these modes to carry on in. */
  approvePlan(modes: AgentMode[]): Promise<PlanDecision>;
}

export type PlanDecision = { approve: true; mode: AgentMode } | { approve: false; note?: string };

/** What the user sends: text, which refers to its images as `[Image #1]`, and the images in that order. */
export interface AgentPrompt {
  text: string;
  images?: AgentImage[];
}

export interface AgentImage {
  /** e.g. `image/png`. */
  mediaType: string;
  /** Base64. */
  data: string;
}

/** A skill or an MCP server's prompt, which the user mentions as `$name` anywhere in a prompt. */
export interface AgentCommand {
  /** Unique, e.g. `design`, or `vercel:nextjs` when another skill already has the short name. */
  name: string;
  description: string;
  source: 'skill' | 'mcp';
  /** Where it comes from, which pickers group by: `project`, `user`, a plugin such as `vercel` or an MCP server. */
  group: string;
  argumentHint?: string;
}

export interface Agent {
  /** The backend, e.g. `Claude`. Model choices are kept per backend. */
  readonly name: string;
  /** The model and effort in use. */
  readonly selection: ModelSelection;
  /** What the user can switch to. */
  models(): Promise<ModelOption[]>;
  /** Takes effect from the next request, also in a conversation that is already running. */
  select(selection: ModelSelection): Promise<void>;
  readonly mode: AgentMode;
  /** The modes it offers, in the order shift+tab goes through them. */
  readonly modes: AgentMode[];
  /** Takes effect right away, also in a running turn. */
  setMode(mode: AgentMode): Promise<void>;
  /** The logins the user keeps for this backend. Backends with a single login leave it out. */
  readonly accounts?: AgentAccounts;
  /** The MCP servers the agent connects to. Backends without MCP leave it out. */
  readonly mcp?: AgentMcp;
  /** Skills and MCP prompts. Later changes come as `commands` events. */
  commands(): Promise<AgentCommand[]>;
  /** Skills and MCP prompts arrive as `$name` mentions, anywhere in the prompt and several at once. */
  run(prompt: AgentPrompt, context: RunContext): AsyncIterable<AgentEvent>;
  /**
   * Adds a message to the turn in progress, which the agent reads at its next step; its events come through that
   * turn's `run`. Returns the message's id, or `undefined` when no turn runs to take it. Backends that can't leave it
   * out, and messages wait instead.
   */
  steer?(prompt: AgentPrompt): string | undefined;
  /** What going back to before the prompt `id` would change in files; `undefined` when there is nothing to restore. */
  rewindPreview?(id: string): Promise<FileChanges | undefined>;
  /**
   * Takes the files, the conversation or both back to how they were before the prompt `id` was sent, between turns.
   * The prompt and everything after it leave the conversation.
   */
  rewind?(id: string, scope: RewindScope): Promise<void>;
  /**
   * Events that come while no turn runs: the commands or plan limits changing, or a turn the backend starts itself.
   * Returns a function that stops listening. Backends that only speak when spoken to leave it out.
   */
  subscribe?(listener: (event: AgentEvent) => void): () => void;
  /** Follows the turn a `turn-start` event announced, with the same context as `run`; empty when there is none. */
  join?(context: RunContext): AsyncIterable<AgentEvent>;
  /** Stops a background task; it ends as `stopped`. */
  stopTask?(id: string): Promise<void>;
  /**
   * Sends the commands and subagents the running turn waits for to the background, where they go on as tasks; the
   * turn goes on without them. Resolves `false` when there was nothing to send.
   */
  background?(): Promise<boolean>;
  /**
   * A short title for the conversation `digest` describes, from a small, fast model, for finding it again in `/resume`.
   * `current` stays when it still fits, so a title only changes when the conversation moved on.
   */
  titleFor?(digest: string, current?: string): Promise<string | undefined>;
  /** Summarizes the conversation so far to free context, keeping what `focus` says above all; its events follow. */
  compact?(focus: string | undefined, context: RunContext): AsyncIterable<AgentEvent>;
  /** What fills the context window, by kind. */
  context?(): Promise<ContextUsage>;
  /** The session's cost, the plan's limits and, with `drivers`, what adds to them, which takes longer to find. */
  usage?(options?: { drivers?: boolean }): Promise<AgentUsage>;
  /** Every day of use on this machine, from the backend's own records; `progress` hears how far reading them got. */
  history?(progress?: (done: number, total: number) => void): Promise<UsageHistory>;
  /** Ends the conversation. The next prompt starts a new one, or continues `resume` when it is given. */
  reset?(resume?: AgentResume): void;
  close?(): void;
}

export interface AgentAccount {
  /** What the user calls it, e.g. `work`. */
  name: string;
  signedIn: boolean;
  email?: string;
  /** e.g. `Max`, `Pro` or `Team`. */
  plan?: string;
  organization?: string;
  /** The backend's own login, which it also uses outside Jinion: it can sign in again, but isn't removed. */
  own?: boolean;
}

/** `BUGECE · Team` for a plan that belongs to an organization, `me@example.com · Max` for a personal one. */
export function accountLabel(account: AgentAccount) {
  const shared = account.plan === 'Team' || account.plan === 'Enterprise';
  const who = shared ? (account.organization ?? account.email) : (account.email ?? account.organization);
  return [who, account.plan].filter(Boolean).join(' · ');
}

export interface AgentAccounts {
  /** The account the agent runs with. */
  readonly current: string;
  /** Who the agent runs as right now, as the backend reports it. */
  active(): Promise<AgentAccount>;
  list(): Promise<AgentAccount[]>;
  /**
   * The next request goes out with this account's login as it is now, also the one in use after it signed in again; a
   * conversation in progress carries on there.
   */
  use(name: string): Promise<void>;
  /**
   * Signs in to `name` through the backend's own login, e.g. in the browser, adding the account when it is new and
   * replacing its login when it isn't.
   */
  signIn(name: string, options: SignInOptions): Promise<AgentAccount>;
  /** Signs `name` out and forgets it. Not the one in use, nor the backend's own login. */
  remove(name: string): Promise<void>;
}

export interface SignInOptions {
  signal: AbortSignal;
  /** The page to sign in at, for when the browser didn't open on its own. */
  onLink(url: string): void;
  /**
   * The login wants something typed, such as a code the browser showed; `answer` sends it. `problem` says why it
   * asks again, e.g. a code that didn't work.
   */
  onPrompt(prompt: string, answer: (text: string) => void, problem?: string): void;
}

export interface AgentMcp {
  /** Every server the agent knows of, with how it is doing. */
  servers(): Promise<McpServerInfo[]>;
  /** Turns servers on or off, by `McpServerInfo.name`, from the next turn on; the conversation carries on. */
  setEnabled(changes: Record<string, boolean>): Promise<void>;
}

export interface McpServerInfo {
  /** What the backend calls it, e.g. `claude.ai Linear`. */
  name: string;
  /** What the user reads, e.g. `Linear`. */
  label: string;
  /** Where it comes from, e.g. `claude.ai`, `project` or `plugin vercel`. */
  source: string;
  enabled: boolean;
  /** `off` while disabled; `needs-auth` until the user signs in to the service. */
  status: 'connected' | 'pending' | 'needs-auth' | 'failed' | 'off';
  /** The command it runs or the URL it talks to. */
  target?: string;
  error?: string;
  tools: string[];
}

export interface AgentResume {
  /** From the conversation's `session` event. */
  sessionId: string;
  /** What the conversation has cost so far, so the total keeps adding up. */
  cost: number;
}

/** What `Agent.rewind` takes back. */
export interface RewindScope {
  code: boolean;
  conversation: boolean;
}

export interface FileChanges {
  /** Paths, absolute. */
  files: string[];
  insertions: number;
  deletions: number;
}
