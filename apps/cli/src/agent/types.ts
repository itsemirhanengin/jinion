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
  bash: { input: { command: string; timeoutMs: number }; result: { exitCode: number; wallMs: number } };
  /** The input patch can be a preview; the result carries the applied one when it differs. */
  edit: { input: { path: string; patch: string; created?: boolean }; result: { patch?: string } };
  todo: { input: { groups: TodoGroup[] }; result: Record<string, never> };
  ask: { input: { questions: Question[] }; result: { answers: QuestionAnswer[] } };
  /** A plan the agent wants approved before it changes anything. */
  plan: { input: { plan: string }; result: Record<string, never> };
  /** Any tool without a dedicated view, such as MCP tools or subagents. */
  other: { input: { title: string; detail?: string }; result: Record<string, never> };
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
}

export type AgentEvent =
  | { type: 'thinking'; delta: string }
  | { type: 'text'; delta: string }
  | { type: 'tool-start'; id: string; call: ToolCall }
  | { type: 'tool-output'; id: string; lines: string[] }
  | { type: 'tool-end'; id: string; ok: boolean; result?: ToolResult }
  | { type: 'usage'; usage: Usage }
  | { type: 'title'; title: string }
  /** The backend's own id for the conversation, which `Agent.reset` takes to continue it. */
  | { type: 'session'; id: string }
  /** How much of the user's plan is used up. Belongs to the account, not to the conversation. */
  | { type: 'limits'; windows: LimitWindow[] }
  /** The mode the agent is really in, e.g. after a plan was approved or when a mode isn't available. */
  | { type: 'mode'; mode: AgentMode };

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
  /** Asks the user whether the agent may go ahead. Rejects when the turn is interrupted instead. */
  approve(request: PermissionRequest): Promise<PermissionDecision>;
  /** Asks the user to approve the plan shown in the conversation, offering these modes to carry on in. */
  approvePlan(modes: AgentMode[]): Promise<PlanDecision>;
}

export type PlanDecision = { approve: true; mode: AgentMode } | { approve: false; note?: string };

/** A slash command the agent handles itself, such as a skill or an MCP server prompt. */
export interface AgentCommand {
  name: string;
  description: string;
  source: 'skill' | 'mcp';
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
  readonly commands: AgentCommand[];
  /** Agent commands arrive as `/name args` prompts. */
  run(prompt: string, context: RunContext): AsyncIterable<AgentEvent>;
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
  /** The next request goes out with this account; a conversation in progress carries on there. */
  use(name: string): Promise<void>;
  /** Signs in to `name` through the backend's own login, e.g. in the browser, adding the account when it is new. */
  signIn(name: string, options: SignInOptions): Promise<AgentAccount>;
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

export interface AgentResume {
  /** From the conversation's `session` event. */
  sessionId: string;
  /** What the conversation has cost so far, so the total keeps adding up. */
  cost: number;
}
