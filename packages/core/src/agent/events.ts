import type { AgentCommand, AgentMode } from './agent.js';
import type { BackgroundTask } from './tasks.js';
import type { ToolCall, ToolResult } from './tools.js';
import type { LimitWindow, Usage } from './usage.js';

export type AgentEvent =
  | { type: 'thinking'; delta: string }
  | { type: 'text'; delta: string }
  /** `parent` is the `agent` call a subagent's own tool call belongs to. */
  | { type: 'tool-start'; id: string; call: ToolCall; parent?: string }
  | { type: 'tool-output'; id: string; lines: string[] }
  | { type: 'tool-end'; id: string; ok: boolean; result?: ToolResult; parent?: string }
  | { type: 'usage'; usage: Usage }
  | { type: 'session'; id: string }
  /** Belongs to the account, not to the conversation. */
  | { type: 'limits'; windows: LimitWindow[] }
  /** The mode the agent is really in, e.g. after a plan was approved or when a mode isn't available. */
  | { type: 'mode'; mode: AgentMode }
  | { type: 'commands'; commands: AgentCommand[] }
  | { type: 'sent'; id: string }
  | { type: 'tasks'; tasks: BackgroundTask[] }
  | { type: 'task-end'; task: BackgroundTask; summary?: string }
  /** Between turns: a turn the agent started itself, e.g. for a task that ended; `Agent.join` follows it. */
  | { type: 'turn-start'; reason?: string }
  | { type: 'compaction'; state: 'running' }
  | { type: 'compaction'; state: 'done'; trigger: 'manual' | 'auto'; before: number; after?: number; summary?: string }
  | { type: 'compaction'; state: 'failed'; error: string };
