import type { Question, QuestionAnswer, TodoGroup } from '@jinion/tui/chat';

export interface FileRef {
  path: string;
  lines?: string;
}

export interface GrepMatch {
  file: string;
  line: number;
  text: string;
}

export interface SearchHit {
  title: string;
  url: string;
}

export interface Tools {
  read: { input: { files: FileRef[] }; result: Record<string, never> };
  /** `files` is set when only file names were searched for, without matching lines. */
  grep: { input: { pattern: string; path: string }; result: { matches: GrepMatch[]; files?: string[] } };
  glob: { input: { pattern: string }; result: { files: string[] } };
  /** The background task the command went on as, instead of an exit code. */
  bash: { input: { command: string; timeoutMs: number }; result: { exitCode: number; wallMs: number; background?: string } };
  /** The input patch can be a preview; the result carries the applied one when it differs. */
  edit: { input: { path: string; patch: string; created?: boolean }; result: { patch?: string } };
  todo: { input: { groups: TodoGroup[] }; result: Record<string, never> };
  ask: { input: { questions: Question[] }; result: { answers: QuestionAnswer[] } };
  memory: { input: { action: 'remember' | 'recall' | 'forget'; detail: string }; result: Record<string, never> };
  plan: { input: { plan: string }; result: Record<string, never> };
  /** What the page said to the prompt comes as the call's output. */
  fetch: { input: { url: string; prompt: string }; result: { bytes?: number; code?: number; codeText?: string } };
  search: { input: { query: string }; result: { hits: SearchHit[]; searches?: number; durationMs?: number } };
  /** Its result comes as the call's output. */
  mcp: { input: { server: string; tool: string; arguments?: string }; result: Record<string, never> };
  other: { input: { title: string; detail?: string }; result: Record<string, never> };
  /** Its tool calls come with this call's id as `parent`, also after it went on as the `background` task. */
  agent: { input: { description: string; kind?: string }; result: { background?: string } };
}

export type ToolName = keyof Tools;

export type ToolCall = { [N in ToolName]: { name: N; input: Tools[N]['input'] } }[ToolName];

export type ToolResult = Tools[ToolName]['result'];

export type ToolRun = { [N in ToolName]: { name: N; input: Tools[N]['input']; result?: Tools[N]['result'] } }[ToolName];
