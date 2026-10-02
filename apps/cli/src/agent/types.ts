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
  /** Any tool without a dedicated view, such as MCP tools or subagents. */
  other: { input: { title: string; detail?: string }; result: Record<string, never> };
}

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
  | { type: 'limits'; windows: LimitWindow[] };

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
}

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
  readonly commands: AgentCommand[];
  /** Agent commands arrive as `/name args` prompts. */
  run(prompt: string, context: RunContext): AsyncIterable<AgentEvent>;
  /** Ends the conversation. The next prompt starts a new one, or continues `resume` when it is given. */
  reset?(resume?: AgentResume): void;
  close?(): void;
}

export interface AgentResume {
  /** From the conversation's `session` event. */
  sessionId: string;
  /** What the conversation has cost so far, so the total keeps adding up. */
  cost: number;
}
