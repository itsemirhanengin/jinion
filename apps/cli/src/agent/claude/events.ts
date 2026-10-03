import { isAbsolute } from 'node:path';
import type {
  SDKAssistantMessage,
  SDKMessage,
  SDKPartialAssistantMessage,
  SDKResultMessage,
  SDKUserMessage,
} from '@anthropic-ai/claude-agent-sdk';
import type { AgentEvent } from '../events.js';
import type { Usage } from '../usage.js';
import { type Input, isObject, text } from './input.js';
import { within } from './paths.js';
import { PlanFile } from './plan.js';
import { modeOf } from './policy.js';
import { ClaudeTasks } from './tasks.js';
import { ClaudeTodos } from './todos.js';
import { type Call, type ToolContext, toCall, toolEnd } from './tool-calls.js';
import { limitWindows } from './usage.js';

/** How Claude Code opens the summary it carries on from after a compaction, and what it tells the model after it. */
const SUMMARY_PREAMBLE = /^This session is being continued from a previous conversation[^\n]*\n+(?:Summary:\n)?/;
const SUMMARY_INSTRUCTIONS = /\n+(?:If you need specific details from before compaction|Continue the conversation from where it left off)[\s\S]*$/;

/** Background task messages; Claude Code's task tools keep the todo list instead. */
const TASK_MESSAGES = new Set(['task_started', 'task_updated', 'task_progress', 'task_notification']);

/** Claude Code's result for a tool call that was rejected by stopping the turn. */
const INTERRUPTED = /^The user doesn't want to proceed with this tool use/;

export class ClaudeEvents {
  readonly tasks = new ClaudeTasks();
  private readonly streamed = new Set<string>();
  private readonly calls = new Map<string, Call>();
  private readonly tools: ToolContext;
  private readonly usage: Usage = { contextTokens: 0, contextWindow: 200_000, cost: 0 };
  private model?: string;
  private session?: string;
  private compacted?: Extract<AgentEvent, { type: 'compaction'; state: 'done' }>;
  private last?: AgentEvent['type'];

  constructor(
    private readonly cwd: string,
    /** Spent before this process took over the conversation, which Claude Code's cost doesn't include. */
    private readonly baseCost = 0,
  ) {
    this.tools = { path: (value) => this.path(value), plan: new PlanFile(), tasks: this.tasks, todos: new ClaudeTodos() };
  }

  get cost() {
    return this.usage.cost;
  }

  get sessionId() {
    return this.session;
  }

  compactAt(tokens: number | undefined): AgentEvent | undefined {
    if (this.usage.compactAt === tokens) return undefined;

    this.usage.compactAt = tokens;

    return { type: 'usage', usage: { ...this.usage } };
  }

  *map(message: SDKMessage): Generator<AgentEvent> {
    // A compaction ends with its summary, the first user message after its boundary; anything else said in the
    // conversation means there is none. Bookkeeping such as a command's lifecycle can come in between.
    const summary = message.type === 'user' && typeof message.message.content === 'string' && !isReplay(message);
    const said = message.type === 'assistant' || message.type === 'user' || message.type === 'result' || message.type === 'stream_event';

    if (this.compacted && said && !summary) yield* this.compactionDone();

    for (const event of this.events(message)) {
      this.last = event.type;
      yield event;
    }
  }

  private *events(message: SDKMessage): Generator<AgentEvent> {
    switch (message.type) {
      case 'system': {
        if (message.subtype === 'status' || message.subtype === 'compact_boundary') {
          yield* this.compaction(message);

          return;
        }

        if (TASK_MESSAGES.has(message.subtype)) {
          yield* this.tasks.map(message, (id) => {
            const call = this.calls.get(id);

            return call?.name === 'Bash' ? text(call.input.command) : undefined;
          });

          return;
        }

        // Claude Code reports the mode it really runs in, e.g. Manual when the model has no auto mode.
        const mode = 'permissionMode' in message ? modeOf(message.permissionMode as string) : undefined;

        if (mode) yield { type: 'mode', mode };
        if (message.subtype !== 'init') return;

        this.model = message.model;
        this.session = message.session_id;
        yield { type: 'session', id: message.session_id };

        return;
      }

      case 'stream_event':
        if (message.parent_tool_use_id === null) yield* this.stream(message.event);

        return;

      case 'assistant':
        if (message.parent_tool_use_id === null) yield* this.assistant(message.message);
        else yield* this.subagent(this.assistant(message.message, message.parent_tool_use_id), message.parent_tool_use_id);

        return;

      case 'user':
        if (message.parent_tool_use_id === null) yield* this.toolResults(message);
        else yield* this.subagent(this.toolResults(message), message.parent_tool_use_id);

        return;

      case 'result':
        yield* this.result(message);

        return;

      case 'rate_limit_event': {
        const windows = limitWindows(message.rate_limit_info);

        if (windows.length > 0) yield { type: 'limits', windows };

        return;
      }
    }
  }

  private *stream(event: SDKPartialAssistantMessage['event']): Generator<AgentEvent> {
    switch (event.type) {
      case 'message_start': {
        this.streamed.add(event.message.id);
        const { input_tokens, cache_creation_input_tokens, cache_read_input_tokens } = event.message.usage;

        this.usage.contextTokens = input_tokens + (cache_creation_input_tokens ?? 0) + (cache_read_input_tokens ?? 0);
        yield { type: 'usage', usage: { ...this.usage } };

        return;
      }

      case 'content_block_start':
        // Without a break, text from two blocks would run together in one entry.
        if (event.content_block.type === 'text' && this.last === 'text') yield { type: 'text', delta: '\n\n' };

        return;

      case 'content_block_delta':
        // Empty deltas would leave blank entries behind, e.g. when thinking text is omitted.
        if (event.delta.type === 'text_delta' && event.delta.text) yield { type: 'text', delta: event.delta.text };

        if (event.delta.type === 'thinking_delta' && event.delta.thinking) {
          yield { type: 'thinking', delta: event.delta.thinking };
        }

        return;
    }
  }

  private *assistant(message: SDKAssistantMessage['message'], parent?: string): Generator<AgentEvent> {
    // Streamed messages already sent their text and thinking as deltas.
    const streamed = this.streamed.has(message.id);

    for (const block of message.content) {
      if (block.type === 'text' && !streamed && block.text) yield { type: 'text', delta: block.text };
      if (block.type === 'thinking' && !streamed && block.thinking) yield { type: 'thinking', delta: block.thinking };

      if (block.type === 'tool_use') {
        const input = (block.input ?? {}) as Input;

        this.calls.set(block.id, { name: block.name, input, startedAt: Date.now(), parent });
        const call = toCall(block.name, input, this.tools);

        if (call) yield { type: 'tool-start', id: block.id, call };
      }
    }
  }

  /** A subagent's text and command output stay out, so the tree stays one line per call. */
  private *subagent(events: Generator<AgentEvent>, parent: string): Generator<AgentEvent> {
    for (const event of events) {
      if (event.type === 'tool-start' && event.call.name !== 'todo') yield { ...event, parent };
      if (event.type === 'tool-end') yield { ...event, parent };
    }
  }

  private *toolResults(message: SDKUserMessage): Generator<AgentEvent> {
    const { content } = message.message;

    if (typeof content === 'string') {
      if (this.compacted && !isReplay(message)) yield* this.compactionDone(content);

      return;
    }

    const results = content.filter((block) => block.type === 'tool_result');

    for (const block of results) {
      const call = this.calls.get(block.tool_use_id);
      if (!call) continue;

      this.calls.delete(block.tool_use_id);
      const output = resultText(block.content);
      // Interrupted calls end without a result, so they show as cancelled when the turn finishes.
      if (block.is_error && INTERRUPTED.test(output)) continue;

      const data = results.length === 1 && isObject(message.tool_use_result) ? message.tool_use_result : undefined;

      yield* toolEnd(block.tool_use_id, call, { text: output, error: block.is_error === true, data }, this.tools);
    }
  }

  private *compaction(message: Extract<SDKMessage, { type: 'system'; subtype: 'status' | 'compact_boundary' }>): Generator<AgentEvent> {
    if (message.subtype === 'compact_boundary') {
      const { trigger, pre_tokens: before, post_tokens: after } = message.compact_metadata;

      this.compacted = { type: 'compaction', state: 'done', trigger, before, after };

      return;
    }

    if (message.status === 'compacting') yield { type: 'compaction', state: 'running' };

    if (message.compact_result === 'failed') {
      yield { type: 'compaction', state: 'failed', error: message.compact_error || "The conversation couldn't be compacted." };
    }
  }

  private *compactionDone(summary?: string): Generator<AgentEvent> {
    const done = this.compacted!;

    this.compacted = undefined;
    yield { ...done, summary: summary?.replace(SUMMARY_PREAMBLE, '').replace(SUMMARY_INSTRUCTIONS, '').trim() || undefined };

    if (done.after !== undefined) {
      this.usage.contextTokens = done.after;
      yield { type: 'usage', usage: { ...this.usage } };
    }
  }

  private *result(message: SDKResultMessage): Generator<AgentEvent> {
    this.usage.cost = this.baseCost + message.total_cost_usd;
    const models = message.modelUsage;
    const window = (this.model && models[this.model]?.contextWindow) || Object.values(models)[0]?.contextWindow;

    if (window) this.usage.contextWindow = window;
    yield { type: 'usage', usage: { ...this.usage } };
  }

  private path(value: unknown) {
    const path = text(value);
    if (!path || !isAbsolute(path)) return path;

    return within(path, this.cwd) || path;
  }
}

function resultText(content: unknown) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';

  return content
    .filter((block) => isObject(block) && block.type === 'text')
    .map((block) => text((block as Input).text))
    .join('\n');
}

/** Claude Code echoes some messages back, e.g. a command's output, which nobody new said. */
const isReplay = (message: object) => 'isReplay' in message && message.isReplay === true;
