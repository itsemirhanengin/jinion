import { z } from 'zod';
import { AgentCommand, AgentMode } from './agent.js';
import { BackgroundTask } from './tasks.js';
import { ToolCall, ToolResult } from './tools.js';
import { LimitWindow, Usage } from './usage.js';

const compaction = z.discriminatedUnion('state', [
  z.object({ type: z.literal('compaction'), state: z.literal('running') }),
  z.object({
    type: z.literal('compaction'),
    state: z.literal('done'),
    trigger: z.enum(['manual', 'auto']),
    before: z.number(),
    after: z.number().optional(),
    summary: z.string().optional(),
  }),
  z.object({ type: z.literal('compaction'), state: z.literal('failed'), error: z.string() }),
]);

export const AgentEvent = z.discriminatedUnion('type', [
  z.object({ type: z.literal('thinking'), delta: z.string() }),
  z.object({ type: z.literal('text'), delta: z.string() }),
  /** `parent` is the `agent` call a subagent's own tool call belongs to. */
  z.object({ type: z.literal('tool-start'), id: z.string(), call: ToolCall, parent: z.string().optional() }),
  z.object({ type: z.literal('tool-output'), id: z.string(), lines: z.array(z.string()) }),
  z.object({ type: z.literal('tool-end'), id: z.string(), ok: z.boolean(), result: ToolResult.optional(), parent: z.string().optional() }),
  z.object({ type: z.literal('usage'), usage: Usage }),
  z.object({ type: z.literal('session'), id: z.string() }),
  /** Belongs to the account, not to the conversation. */
  z.object({ type: z.literal('limits'), windows: z.array(LimitWindow) }),
  /** The mode the agent is really in, e.g. after a plan was approved or when a mode isn't available. */
  z.object({ type: z.literal('mode'), mode: AgentMode }),
  z.object({ type: z.literal('commands'), commands: z.array(AgentCommand) }),
  z.object({ type: z.literal('sent'), id: z.string() }),
  /** The agent began reading a prompt, by the id `steer` gave it; a steered one waits until then. */
  z.object({ type: z.literal('read'), id: z.string() }),
  z.object({ type: z.literal('tasks'), tasks: z.array(BackgroundTask) }),
  z.object({ type: z.literal('task-end'), task: BackgroundTask, summary: z.string().optional() }),
  /** Between turns: a turn the agent started itself, e.g. for a task that ended; `Agent.join` follows it. */
  z.object({ type: z.literal('turn-start'), reason: z.string().optional() }),
  compaction,
]);

export type AgentEvent = z.infer<typeof AgentEvent>;
