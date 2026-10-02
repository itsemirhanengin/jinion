import type { PermissionDecision, PermissionRequest, Question, QuestionAnswer, TodoGroup } from '@jinion/tui';

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
  | { type: 'title'; title: string };

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
  readonly model: string;
  readonly commands: AgentCommand[];
  /** Agent commands arrive as `/name args` prompts. */
  run(prompt: string, context: RunContext): AsyncIterable<AgentEvent>;
  /** Forgets the conversation so the next prompt starts a new one. */
  reset?(): void;
  close?(): void;
}
