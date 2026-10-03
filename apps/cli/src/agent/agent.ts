import type { ModelOption, ModelSelection, PermissionDecision, PermissionRequest, Question, QuestionAnswer } from '@jinion/tui/chat';
import type { AgentAccounts } from './accounts.js';
import type { AgentEvent } from './events.js';
import type { AgentMcp } from './mcp.js';
import type { AgentUsage, ContextUsage, UsageHistory } from './usage.js';

/** Optional members are features a backend may not have; the app feature-detects them. */
export interface Agent {
  readonly name: string;
  readonly selection: ModelSelection;
  models(): Promise<ModelOption[]>;
  /** Takes effect from the next request, also in a conversation that is already running. */
  select(selection: ModelSelection): Promise<void>;
  readonly mode: AgentMode;
  readonly modes: AgentMode[];
  /** Takes effect right away, also in a running turn. */
  setMode(mode: AgentMode): Promise<void>;
  readonly accounts?: AgentAccounts;
  readonly mcp?: AgentMcp;
  /** Later changes come as `commands` events. */
  commands(): Promise<AgentCommand[]>;
  /** Skills and MCP prompts arrive as `$name` mentions, anywhere in the prompt and several at once. */
  run(prompt: AgentPrompt, context: RunContext): AsyncIterable<AgentEvent>;
  /** Adds a message to the running turn; `undefined` when no turn runs to take it. */
  steer?(prompt: AgentPrompt): string | undefined;
  /** `undefined` when there is nothing to restore. */
  rewindPreview?(id: string): Promise<FileChanges | undefined>;
  /** Only between turns; the prompt and everything after it leave the conversation. */
  rewind?(id: string, scope: RewindScope): Promise<void>;
  /** Events between turns: commands or plan limits changing, or a turn the backend starts itself. */
  subscribe?(listener: (event: AgentEvent) => void): () => void;
  /** Follows the turn a `turn-start` event announced; empty when there is none. */
  join?(context: RunContext): AsyncIterable<AgentEvent>;
  stopTask?(id: string): Promise<void>;
  /** Resolves `false` when nothing was waiting to go to the background. */
  background?(): Promise<boolean>;
  /** `current` stays when it still fits, so a title only changes when the conversation moved on. */
  titleFor?(digest: string, current?: string): Promise<string | undefined>;
  compact?(focus: string | undefined, context: RunContext): AsyncIterable<AgentEvent>;
  context?(): Promise<ContextUsage>;
  usage?(options?: { drivers?: boolean }): Promise<AgentUsage>;
  history?(progress?: (done: number, total: number) => void): Promise<UsageHistory>;
  /** The next prompt starts a new conversation, or continues `resume`; in `cwd`, such as a worktree, instead of the project. */
  reset?(resume?: AgentResume, cwd?: string): void;
  close?(): void;
}

/** `edits` changes project files without asking; `auto` lets the backend's own safety review decide what to ask. */
export type AgentMode = 'manual' | 'edits' | 'plan' | 'auto';

export interface RunContext {
  signal: AbortSignal;
  ask(questions: Question[]): Promise<QuestionAnswer[]>;
  /** Rejects when the turn is interrupted. `call` is the tool call it is for, which waits meanwhile. */
  approve(request: PermissionRequest, call?: string): Promise<PermissionDecision>;
  approvePlan(modes: AgentMode[]): Promise<PlanDecision>;
}

export type PlanDecision = { approve: true; mode: AgentMode } | { approve: false; note?: string };

/** The text refers to its images as `[Image #1]`, in the order of `images`. */
export interface AgentPrompt {
  text: string;
  images?: AgentImage[];
}

export interface AgentImage {
  mediaType: string;
  /** Base64. */
  data: string;
}

export interface AgentCommand {
  /** Unique; `vercel:nextjs` when another skill already has the short name. */
  name: string;
  description: string;
  source: 'skill' | 'mcp';
  group: string;
  argumentHint?: string;
}

export interface AgentResume {
  sessionId: string;
  cost: number;
}

export interface RewindScope {
  code: boolean;
  conversation: boolean;
}

export interface FileChanges {
  files: string[];
  insertions: number;
  deletions: number;
}
