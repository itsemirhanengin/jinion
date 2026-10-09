import type { Elicitation, ElicitationAnswer } from './elicitation.js';

// The part of `codex app-server`'s protocol Jinion uses, written after what `codex app-server generate-ts --experimental`
// makes for the pinned version. Fields Jinion doesn't read are left out.

export type ReasoningEffort = string;

export type ApprovalsReviewer = 'user' | 'auto_review';

export type SandboxPolicy =
  | { type: 'readOnly'; networkAccess: boolean }
  | { type: 'workspaceWrite'; writableRoots: string[]; networkAccess: boolean; excludeTmpdirEnvVar: boolean; excludeSlashTmp: boolean }
  | { type: 'dangerFullAccess' }
  | { type: 'externalSandbox'; networkAccess: unknown };

export interface CollaborationMode {
  mode: 'plan' | 'default';
  settings: { model: string; reasoning_effort: ReasoningEffort | null; developer_instructions: string | null };
}

export type UserInput =
  | { type: 'text'; text: string; text_elements: [] }
  | { type: 'image'; url: string }
  | { type: 'skill'; name: string; path: string };

export interface Model {
  id: string;
  displayName: string;
  description: string;
  hidden: boolean;
  isDefault: boolean;
  supportedReasoningEfforts: { reasoningEffort: ReasoningEffort; description: string }[];
}

export interface Thread {
  id: string;
}

/** What `thread/start` and `thread/resume` answer with. */
export interface ThreadStarted {
  thread: Thread;
  /** The sandbox as Codex resolved it from what was asked and the user's config. */
  sandbox: SandboxPolicy;
}

export interface Turn {
  id: string;
  /** Empty unless asked for, as `thread/turns/list` with `itemsView: 'full'` does. */
  items: ThreadItem[];
  status: 'completed' | 'interrupted' | 'failed' | 'inProgress';
  error: { message: string; additionalDetails: string | null } | null;
}

export type CommandAction =
  | { type: 'read'; command: string; name: string; path: string }
  | { type: 'listFiles'; command: string; path: string | null }
  | { type: 'search'; command: string; query: string | null; path: string | null }
  | { type: 'unknown'; command: string };

export interface FileUpdateChange {
  path: string;
  kind: { type: 'add' } | { type: 'delete' } | { type: 'update'; move_path: string | null };
  /** The new file's content for `add`, the old one's for `delete`, hunks without a header for `update`. */
  diff: string;
}

export type CollabAgentTool = 'spawnAgent' | 'sendInput' | 'resumeAgent' | 'wait' | 'closeAgent' | 'sendMessage' | 'followupTask' | 'interruptAgent' | 'listAgents';

export type ThreadItem =
  | { type: 'userMessage'; id: string; content: UserInput[] }
  | { type: 'agentMessage'; id: string; text: string }
  | { type: 'plan'; id: string; text: string }
  | { type: 'reasoning'; id: string; summary: string[] }
  | {
      type: 'commandExecution';
      id: string;
      command: string;
      cwd: string;
      /** Its terminal, which keeps running in the background when the turn ends first. */
      processId: string | null;
      status: 'inProgress' | 'completed' | 'failed' | 'declined';
      commandActions: CommandAction[];
      aggregatedOutput: string | null;
      exitCode: number | null;
      durationMs: number | null;
    }
  | { type: 'fileChange'; id: string; changes: FileUpdateChange[]; status: 'inProgress' | 'completed' | 'failed' | 'declined' }
  | {
      type: 'mcpToolCall';
      id: string;
      server: string;
      tool: string;
      status: 'inProgress' | 'completed' | 'failed';
      arguments: unknown;
      result: { content: unknown[] } | null;
      error: { message: string } | null;
    }
  | {
      type: 'dynamicToolCall';
      id: string;
      tool: string;
      arguments: unknown;
      status: 'inProgress' | 'completed' | 'failed';
      success: boolean | null;
      contentItems: { type: string; text?: string }[] | null;
    }
  | {
      type: 'collabAgentToolCall';
      id: string;
      tool: CollabAgentTool;
      status: 'inProgress' | 'completed' | 'failed';
      receiverThreadIds: string[];
      prompt: string | null;
      /** Each subagent's state by its thread, with what it said once it is done. */
      agentsStates?: Record<string, { status: string; message: string | null } | undefined>;
    }
  | {
      type: 'webSearch';
      id: string;
      query: string;
      action: { type: 'search'; query: string | null } | { type: 'openPage'; url: string | null } | { type: string } | null;
      results: unknown[] | null;
    }
  | { type: 'contextCompaction'; id: string }
  | { type: 'imageView' | 'imageGeneration' | 'sleep' | 'enteredReviewMode' | 'exitedReviewMode' | 'hookPrompt' | 'subAgentActivity' | 'functionCallOutput'; id: string };

export interface TokenUsage {
  totalTokens: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
}

export interface RateLimitWindow {
  usedPercent: number;
  windowDurationMins: number | null;
  /** Seconds since the epoch. */
  resetsAt: number | null;
}

export interface RateLimitSnapshot {
  primary: RateLimitWindow | null;
  secondary: RateLimitWindow | null;
  credits: { hasCredits: boolean; unlimited: boolean; balance: string | null } | null;
  planType: string | null;
}

export type Account = { type: 'apiKey' } | { type: 'chatgpt'; email: string | null; planType: string } | { type: 'amazonBedrock' };

export interface SkillMetadata {
  name: string;
  description: string;
  shortDescription?: string;
  path: string;
  scope: string;
  enabled: boolean;
  pluginId: string | null;
}

export interface McpServerStatus {
  name: string;
  /** The plugin that brings it, e.g. `code-review@openai-bundled`. */
  pluginId: string | null;
  runtimeStatus: 'notStarted' | 'starting' | 'connected' | 'authenticationRequired' | 'failed' | 'cancelled' | 'disabled' | null;
  tools: Record<string, unknown>;
}

/** Each notification Jinion follows, by method; the rest are ignored. */
export interface Notifications {
  'turn/started': { threadId: string; turn: Turn };
  'turn/completed': { threadId: string; turn: Turn };
  'turn/plan/updated': { threadId: string; turnId: string; explanation: string | null; plan: { step: string; status: 'pending' | 'inProgress' | 'completed' }[] };
  'item/started': { threadId: string; turnId: string; item: ThreadItem };
  'item/completed': { threadId: string; turnId: string; item: ThreadItem };
  'item/agentMessage/delta': { threadId: string; turnId: string; itemId: string; delta: string };
  'item/reasoning/summaryTextDelta': { threadId: string; turnId: string; itemId: string; delta: string; summaryIndex: number };
  'item/reasoning/summaryPartAdded': { threadId: string; turnId: string; itemId: string; summaryIndex: number };
  'item/commandExecution/outputDelta': { threadId: string; turnId: string; itemId: string; delta: string };
  'thread/tokenUsage/updated': { threadId: string; turnId: string; tokenUsage: { last: TokenUsage; modelContextWindow: number | null } };
  'account/rateLimits/updated': { rateLimits: RateLimitSnapshot };
  error: { threadId: string; turnId: string; willRetry: boolean; error: { message: string } };
  'skills/changed': Record<string, never>;
  'account/login/completed': { loginId: string | null; success: boolean; error: string | null };
  'account/updated': Record<string, unknown>;
}

export type Notification = { [M in keyof Notifications]: { method: M; params: Notifications[M] } }[keyof Notifications];

/** The thread a notification is about; none for what is about the account or every thread. */
export const threadOf = ({ params }: Notification) => ('threadId' in params && typeof params.threadId === 'string' ? params.threadId : undefined);

export interface CommandApproval {
  threadId: string;
  turnId: string;
  itemId: string;
  reason?: string | null;
  command?: string | null;
  cwd?: string | null;
  commandActions?: CommandAction[] | null;
  availableDecisions?: unknown[] | null;
}

export interface FileChangeApproval {
  threadId: string;
  turnId: string;
  itemId: string;
  reason?: string | null;
  grantRoot?: string | null;
}

export interface UserInputRequest {
  threadId: string;
  turnId: string;
  itemId: string;
  questions: { id: string; header: string; question: string; isOther: boolean; isSecret: boolean; options: { label: string; description: string }[] | null }[];
}

export interface PermissionsRequest {
  threadId: string;
  turnId: string;
  itemId: string;
  reason: string | null;
  permissions: { network: unknown; fileSystem: unknown };
}

export interface DynamicToolCall {
  threadId: string;
  turnId: string;
  callId: string;
  tool: string;
  arguments: unknown;
}

/** What the server asks the client, by method, with the answer it takes. */
export interface ServerRequests {
  'item/commandExecution/requestApproval': { params: CommandApproval; result: { decision: 'accept' | 'acceptForSession' | 'decline' | 'cancel' } };
  'item/fileChange/requestApproval': { params: FileChangeApproval; result: { decision: 'accept' | 'acceptForSession' | 'decline' | 'cancel' } };
  'item/tool/requestUserInput': { params: UserInputRequest; result: { answers: Record<string, { answers: string[] }> } };
  'item/permissions/requestApproval': { params: PermissionsRequest; result: { permissions: unknown; scope: 'turn' | 'session' } };
  'item/tool/call': { params: DynamicToolCall; result: { contentItems: { type: 'inputText'; text: string }[]; success: boolean } };
  'mcpServer/elicitation/request': { params: { threadId: string; turnId: string | null } & Elicitation; result: ElicitationAnswer };
}

export type ServerRequest = { [M in keyof ServerRequests]: { method: M; params: ServerRequests[M]['params'] } }[keyof ServerRequests];
