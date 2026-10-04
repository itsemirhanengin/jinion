import type { AgentEvent } from '../events.js';
import type { TodoStatus } from '../todos.js';
import type { ToolCall, ToolResult } from '../tools.js';
import { MEMORY_TOOLS } from './memory.js';
import { type Notification, type ThreadItem, threadOf } from './protocol.js';
import { commandCall, commandResult, contentText, editCall, outputLines, searchHits } from './tool-calls.js';
import { limitWindows } from './usage.js';

/** Until Codex reports the model's. */
export const DEFAULT_CONTEXT_WINDOW = 258_400;

const TODO_STATUS: Record<'pending' | 'inProgress' | 'completed', TodoStatus> = { pending: 'pending', inProgress: 'active', completed: 'done' };

/** Turns what Codex says about one conversation into Jinion's events, keeping what spans several notifications. */
export class CodexEvents {
  /** The plan Codex wrote in plan mode, for the user to approve once its turn ends. */
  plan?: string;
  /** Set while a compaction Jinion asked for runs, so it isn't taken for an automatic one. */
  compacting = false;
  /** How Jinion shows each call that hasn't ended, by Codex's item id. */
  private readonly calls = new Map<string, ToolCall>();
  /** What a command printed after its last newline, until the rest of the line comes. */
  private readonly partial = new Map<string, string>();
  /** The conversations of subagents, each with the call that started it. */
  private readonly children = new Map<string, string>();
  private readonly streamed = new Set<string>();
  /** The message or reasoning that streamed last, so the next one starts a paragraph of its own. */
  private last?: string;
  private todos = 0;
  private contextTokens = 0;
  /** How full the context was as the running compaction began. */
  private compactedFrom?: number;

  constructor(private readonly thread: () => string | undefined) {}

  /** Whether a notification about `threadId` is this conversation's, its own or one of its subagents'. */
  owns(threadId: string) {
    return threadId === this.thread() || this.children.has(threadId);
  }

  /** The edits of a patch Codex asks to apply, by its item id: one a file, each a call of its own. */
  edits(item: string) {
    return [...this.calls].flatMap(([id, call]) => (id.startsWith(`${item}#`) && call.name === 'edit' ? [{ id, path: call.input.path }] : []));
  }

  map(notification: Notification): AgentEvent[] {
    const { method, params } = notification;
    const thread = threadOf(notification);
    const parent = thread !== undefined && thread !== this.thread() ? this.children.get(thread) : undefined;
    // A subagent's own calls show under the call that started it; its messages and usage stay its own.
    if (parent !== undefined && method !== 'item/started' && method !== 'item/completed' && method !== 'item/commandExecution/outputDelta') return [];

    switch (method) {
      case 'item/started':
        return this.started(params.item, parent);

      case 'item/completed':
        return this.completed(params.item, parent);

      case 'item/agentMessage/delta':
        return this.stream('text', params.itemId, params.delta);

      case 'item/reasoning/summaryTextDelta':
        return this.stream('thinking', params.itemId, params.delta);

      case 'item/reasoning/summaryPartAdded':
        return params.summaryIndex > 0 ? this.stream('thinking', params.itemId, '\n\n') : [];

      case 'item/commandExecution/outputDelta':
        return this.output(params.itemId, params.delta);

      case 'turn/plan/updated': {
        const id = `todo-${params.turnId}-${++this.todos}`;
        const items = params.plan.map(({ step, status }) => ({ text: step, status: TODO_STATUS[status] }));
        const call: ToolCall = { name: 'todo', input: { groups: [{ title: params.explanation || 'Plan', items }] } };

        return this.after([
          { type: 'tool-start', id, call },
          { type: 'tool-end', id, ok: true },
        ]);
      }

      case 'thread/tokenUsage/updated': {
        const { last, modelContextWindow } = params.tokenUsage;

        this.contextTokens = last.totalTokens;

        return [{ type: 'usage', usage: { contextTokens: last.totalTokens, contextWindow: modelContextWindow ?? DEFAULT_CONTEXT_WINDOW, cost: 0 } }];
      }

      case 'account/rateLimits/updated':
        return [{ type: 'limits', windows: limitWindows(params.rateLimits, 'short') }];

      default:
        return [];
    }
  }

  private started(item: ThreadItem, parent: string | undefined): AgentEvent[] {
    switch (item.type) {
      case 'commandExecution':
        return this.start(item.id, commandCall(item), parent);

      case 'fileChange':
        return item.changes.flatMap((change, index) => this.start(`${item.id}#${index}`, editCall(change), parent));

      case 'mcpToolCall':
        return this.start(item.id, { name: 'mcp', input: { server: item.server, tool: item.tool, arguments: json(item.arguments) } }, parent);

      case 'dynamicToolCall':
        return this.start(item.id, dynamicCall(item.tool, item.arguments), parent);

      case 'collabAgentToolCall':
        this.adopt(item);

        return this.start(item.id, collabCall(item), parent);

      case 'contextCompaction':
        if (parent !== undefined) return [];

        this.compactedFrom = this.contextTokens;

        return this.after([{ type: 'compaction', state: 'running' }]);

      default:
        return [];
    }
  }

  private completed(item: ThreadItem, parent: string | undefined): AgentEvent[] {
    switch (item.type) {
      case 'agentMessage':
        // A message Codex didn't stream comes whole.
        return parent === undefined && !this.streamed.has(item.id) && item.text ? this.stream('text', item.id, item.text) : [];

      case 'commandExecution': {
        const call = this.calls.get(item.id) ?? commandCall(item);
        const rest = this.partial.get(item.id);
        const output = outputLines(item.aggregatedOutput ?? '');
        const exitCode = item.exitCode ?? 0;
        // A search or listing that finds nothing exits with 1 and prints nothing.
        const found = exitCode === 1 && output.length === 0 && (call.name === 'grep' || call.name === 'glob');
        const ok = item.status === 'completed' && (exitCode === 0 || found);

        // A command shows its output as it comes, or all of it at the end when it was quick; a read or search only
        // when it failed, where its result would be.
        const streamed = rest !== undefined;
        const shown = call.name === 'bash' ? (streamed ? (rest ? [rest] : []) : output) : ok ? [] : output;

        this.partial.delete(item.id);

        return [...this.lines(item.id, shown), ...this.end(item.id, ok, ok || call.name === 'bash' ? commandResult(call, item) : undefined, parent)];
      }

      case 'fileChange':
        return item.changes.flatMap((_, index) => this.end(`${item.id}#${index}`, item.status === 'completed', undefined, parent));

      case 'mcpToolCall': {
        const lines = item.error ? [item.error.message] : contentText(item.result?.content).flatMap(outputLines);

        return [...this.lines(item.id, lines), ...this.end(item.id, item.status === 'completed', undefined, parent)];
      }

      case 'dynamicToolCall': {
        const lines = contentText(item.contentItems).flatMap(outputLines);

        return [...this.lines(item.id, lines), ...this.end(item.id, item.success === true, undefined, parent)];
      }

      case 'collabAgentToolCall': {
        this.adopt(item);

        // What the subagents said, where Codex waited for it; closing them reports it again.
        const said = item.tool === 'wait' ? Object.values(item.agentsStates ?? {}).flatMap((state) => (state?.message ? outputLines(state.message) : [])) : [];

        return [...this.lines(item.id, said), ...this.end(item.id, item.status === 'completed', item.tool === 'spawnAgent' ? {} : undefined, parent)];
      }

      case 'webSearch': {
        const call: ToolCall =
          item.action?.type === 'openPage' && 'url' in item.action && item.action.url
            ? { name: 'fetch', input: { url: item.action.url, prompt: '' } }
            : { name: 'search', input: { query: item.query } };

        return [
          ...this.start(item.id, call, parent),
          ...this.end(item.id, true, call.name === 'search' ? { hits: searchHits(item.results) } : {}, parent),
        ];
      }

      case 'plan': {
        if (parent !== undefined) return [];

        this.plan = item.text;

        return this.after([
          { type: 'tool-start', id: item.id, call: { name: 'plan', input: { plan: item.text } } },
          { type: 'tool-end', id: item.id, ok: true },
        ]);
      }

      case 'contextCompaction': {
        if (parent !== undefined) return [];

        const trigger = this.compacting ? 'manual' : 'auto';
        const before = this.compactedFrom ?? this.contextTokens;
        // Codex reports the smaller context before it says the compaction is done.
        const after = this.contextTokens < before ? this.contextTokens : undefined;

        this.compactedFrom = undefined;

        return this.after([{ type: 'compaction', state: 'done', trigger, before, after }]);
      }

      default:
        return [];
    }
  }

  /**
   * A subagent's calls show under the call that started it. Codex names its thread once that call completes, and again
   * in each call that waits for it or messages it, which mustn't take it over.
   */
  private adopt(item: Extract<ThreadItem, { type: 'collabAgentToolCall' }>) {
    if (item.tool !== 'spawnAgent') return;

    for (const child of item.receiverThreadIds) this.children.set(child, item.id);
  }

  private start(id: string, call: ToolCall, parent: string | undefined): AgentEvent[] {
    this.calls.set(id, call);

    return this.after([{ type: 'tool-start', id, call, parent }]);
  }

  private end(id: string, ok: boolean, result: ToolResult | undefined, parent: string | undefined): AgentEvent[] {
    if (!this.calls.has(id)) return [];

    this.calls.delete(id);

    return this.after([{ type: 'tool-end', id, ok, result, parent }]);
  }

  /** What a command prints shows as it comes, a whole line at a time; reads and searches show their result instead. */
  private output(id: string, delta: string): AgentEvent[] {
    if (this.calls.get(id)?.name !== 'bash') return [];

    const text = (this.partial.get(id) ?? '') + delta;
    const cut = text.lastIndexOf('\n');

    this.partial.set(id, text.slice(cut + 1));

    return cut === -1 ? [] : this.lines(id, text.slice(0, cut).split('\n'));
  }

  private lines(id: string, lines: string[]): AgentEvent[] {
    return lines.length > 0 ? [{ type: 'tool-output', id, lines }] : [];
  }

  private stream(type: 'text' | 'thinking', item: string, delta: string): AgentEvent[] {
    const key = `${type}:${item}`;
    const separate = this.last !== undefined && this.last !== key && this.last.startsWith(`${type}:`);

    this.last = key;
    this.streamed.add(item);

    return separate ? [{ type, delta: `\n\n${delta}` }] : [{ type, delta }];
  }

  /** Anything between two messages makes the second one start an entry of its own. */
  private after(events: AgentEvent[]) {
    this.last = undefined;

    return events;
  }
}

function dynamicCall(tool: string, input: unknown): ToolCall {
  const action = MEMORY_TOOLS[tool];
  if (!action) return { name: 'other', input: { title: tool, detail: json(input) } };

  // Worded as Claude's calls of the same tools are.
  const { scope, title, ids, id } = (input ?? {}) as { scope?: unknown; title?: unknown; ids?: unknown; id?: unknown };

  const detail =
    action === 'remember'
      ? `${String(scope ?? '')} · ${String(title ?? '')}`
      : action === 'recall'
        ? Array.isArray(ids) && ids.length > 0 ? ids.map(String).join(', ') : 'every note'
        : String(id ?? '');

  return { name: 'memory', input: { action, detail } };
}

function collabCall(item: Extract<ThreadItem, { type: 'collabAgentToolCall' }>): ToolCall {
  if (item.tool === 'spawnAgent') return { name: 'agent', input: { description: item.prompt ?? 'A subagent' } };

  return { name: 'other', input: { title: COLLAB_TITLES[item.tool], detail: item.prompt ?? undefined } };
}

const COLLAB_TITLES: Record<Exclude<Extract<ThreadItem, { type: 'collabAgentToolCall' }>['tool'], 'spawnAgent'>, string> = {
  sendInput: 'Message a subagent',
  sendMessage: 'Message a subagent',
  followupTask: 'Give a subagent more to do',
  resumeAgent: 'Resume a subagent',
  wait: 'Wait for subagents',
  closeAgent: 'Close a subagent',
  interruptAgent: 'Interrupt a subagent',
  listAgents: 'List subagents',
};

const json = (value: unknown) => (value === undefined || value === null ? undefined : JSON.stringify(value));
