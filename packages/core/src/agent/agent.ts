import { z } from 'zod';
import type { ModelOption, ModelSelection } from './models.js';
import type { PermissionDecision, PermissionRequest } from './permissions.js';
import type { Question, QuestionAnswer } from './questions.js';
import type { AgentAccounts } from './accounts.js';
import type { AgentEvent } from './events.js';
import type { AgentMcp } from './mcp.js';
import type { AgentUsage, ContextUsage, UsageHistory } from './usage.js';

/**
 * A backend such as Claude: what all its conversations share. Optional members are features a backend may not have;
 * the app feature-detects them.
 */
export interface AgentBackend {
  readonly name: string;
  /** What a session uses when nothing picked a model. */
  readonly defaultModel: string;
  readonly modes: AgentMode[];
  models(): Promise<ModelOption[]>;
  readonly accounts?: AgentAccounts;
  readonly mcp?: AgentMcp;
  /** Skills and MCP prompts; later changes come as `commands` events from a session. */
  commands(): Promise<AgentCommand[]>;
  /** `current` stays when it still fits, so a title only changes when the conversation moved on. */
  titleFor?(digest: string, current?: string): Promise<string | undefined>;
  usage?(options?: { drivers?: boolean }): Promise<AgentUsage>;
  history?(progress?: (done: number, total: number) => void): Promise<UsageHistory>;
  /** A conversation of its own, with its own process; it starts when first used. */
  session(options?: SessionOptions): AgentSession;
  /** Ends every session. */
  close?(): void;
}

export interface SessionOptions {
  /** The project, or a worktree of it; the project by default. */
  cwd?: string;
  /** `defaultModel` when left out. */
  selection?: ModelSelection;
  mode?: AgentMode;
  /** Continues an earlier conversation. */
  resume?: AgentResume;
}

/** One conversation with the backend. */
export interface AgentSession {
  readonly selection: ModelSelection;
  /** Takes effect from the next request, also in a conversation that is already running. */
  select(selection: ModelSelection): Promise<void>;
  /** The model changes only between turns, so one picked during a turn applies from the next. */
  readonly modelPerTurn?: boolean;
  readonly mode: AgentMode;
  /** Takes effect right away, also in a running turn. */
  setMode(mode: AgentMode): Promise<void>;
  /** Skills and MCP prompts arrive as `$name` mentions, anywhere in the prompt and several at once. */
  run(prompt: AgentPrompt, context: RunContext): AsyncIterable<AgentEvent>;
  /** Adds a message to the running turn, with an id a `read` event names; `undefined` when no turn runs to take it. */
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
  compact?(focus: string | undefined, context: RunContext): AsyncIterable<AgentEvent>;
  context?(): Promise<ContextUsage>;
  /** Carries on the conversation in `cwd`, such as a worktree made for it, instead of where it started. */
  moveTo?(cwd: string): void;
  /** Ends its process; background tasks stop with it. */
  close(): void;
}

/** `edits` changes project files without asking; `auto` lets the backend's own safety review decide what to ask. */
export const AgentMode = z.enum(['manual', 'edits', 'plan', 'auto']);

export type AgentMode = z.infer<typeof AgentMode>;

export interface RunContext {
  signal: AbortSignal;
  ask(questions: Question[]): Promise<QuestionAnswer[]>;
  /** Rejects when the turn is interrupted. `call` is the tool call it is for, which waits meanwhile. */
  approve(request: PermissionRequest, call?: string): Promise<PermissionDecision>;
  approvePlan(modes: AgentMode[]): Promise<PlanDecision>;
  /** Read at each commit, so changing the setting counts in a turn that already runs. */
  asksBeforeCommits(): boolean;
}

/** What a client knows of a backend; it leaves out what the backend can't do. */
export const AgentInfo = z.object({
  name: z.string(),
  modes: z.array(AgentMode),
  features: z.object({ accounts: z.boolean(), mcp: z.boolean(), usage: z.boolean(), history: z.boolean() }),
});

export type AgentInfo = z.infer<typeof AgentInfo>;

export const agentInfo = (backend: AgentBackend): AgentInfo => ({
  name: backend.name,
  modes: backend.modes,
  features: {
    accounts: backend.accounts !== undefined,
    mcp: backend.mcp !== undefined,
    usage: backend.usage !== undefined,
    history: backend.history !== undefined,
  },
});

/** What one conversation's agent can do. */
export const SessionFeatures = z.object({
  steer: z.boolean(),
  rewind: z.boolean(),
  context: z.boolean(),
  background: z.boolean(),
  compact: z.boolean(),
});

export type SessionFeatures = z.infer<typeof SessionFeatures>;

export const sessionFeatures = (session: AgentSession): SessionFeatures => ({
  steer: session.steer !== undefined,
  rewind: session.rewind !== undefined,
  context: session.context !== undefined,
  background: session.background !== undefined,
  compact: session.compact !== undefined,
});

export const PlanDecision = z.union([
  z.object({
    approve: z.literal(true),
    mode: AgentMode,
    /** The plan as the user changed it before approving it; the agent is told it changed. */
    plan: z.string().optional(),
  }),
  z.object({ approve: z.literal(false), note: z.string().optional() }),
]);

export type PlanDecision = z.infer<typeof PlanDecision>;

export const AgentImage = z.object({
  mediaType: z.string(),
  /** Base64. */
  data: z.string(),
});

export type AgentImage = z.infer<typeof AgentImage>;

/** The text refers to its images as `[Image #1]`, in the order of `images`. */
export const AgentPrompt = z.object({ text: z.string(), images: z.array(AgentImage).optional() });

export type AgentPrompt = z.infer<typeof AgentPrompt>;

export const AgentCommand = z.object({
  /** Unique; `vercel:nextjs` when another skill already has the short name. */
  name: z.string(),
  description: z.string(),
  source: z.enum(['skill', 'mcp']),
  group: z.string(),
  argumentHint: z.string().optional(),
});

export type AgentCommand = z.infer<typeof AgentCommand>;

export interface AgentResume {
  sessionId: string;
  cost: number;
}

export const RewindScope = z.object({ code: z.boolean(), conversation: z.boolean() });

export type RewindScope = z.infer<typeof RewindScope>;

export const FileChanges = z.object({ files: z.array(z.string()), insertions: z.number(), deletions: z.number() });

export type FileChanges = z.infer<typeof FileChanges>;
