import { readFileSync } from 'node:fs';
import { isAbsolute, relative } from 'node:path';
import type {
  SDKAssistantMessage,
  SDKMessage,
  SDKPartialAssistantMessage,
  SDKResultMessage,
  SDKUserMessage,
} from '@anthropic-ai/claude-agent-sdk';
import type { Question, QuestionAnswer, TodoItem } from '@jinion/tui';
import type { AgentEvent, AgentMode, GrepMatch, LimitWindow, ToolCall, Usage } from '../types.js';
import { isPlanFile } from './guard.js';
import { MEMORY_SERVER } from './memory.js';
import { skillLabel } from './plugins.js';
import { ClaudeTasks } from './tasks.js';

type Input = Record<string, unknown>;

interface Call {
  name: string;
  input: Input;
  startedAt: number;
  /** The subagent call it was made in, if any. */
  parent?: string;
}

interface Outcome {
  text: string;
  error: boolean;
  /** Claude Code's structured result, when the message carries exactly one tool result. */
  data: Input | undefined;
}

export interface ClaudeQuestion {
  question: string;
  options: { label: string; description?: string }[];
  multiSelect?: boolean;
}

const TASK_TOOLS = new Set(['TaskCreate', 'TaskUpdate', 'TaskList', 'TaskGet']);

/** How Claude Code opens the summary it carries on from after a compaction, and what it tells the model after it. */
const SUMMARY_PREAMBLE = /^This session is being continued from a previous conversation[^\n]*\n+(?:Summary:\n)?/;
const SUMMARY_INSTRUCTIONS = /\n+(?:If you need specific details from before compaction|Continue the conversation from where it left off)[\s\S]*$/;

/** What Claude Code says about background tasks, unlike the task tools above, which keep the todo list. */
const TASK_MESSAGES = new Set(['task_started', 'task_updated', 'task_progress', 'task_notification']);

const MODES_BY_PERMISSION: Record<string, AgentMode> = {
  default: 'manual',
  acceptEdits: 'edits',
  plan: 'plan',
  auto: 'auto',
};

/** Claude Code's result for a tool call that was rejected by stopping the turn. */
const INTERRUPTED = /^The user doesn't want to proceed with this tool use/;

/** Turns Claude Code's SDK messages into Jinion agent events. */
export class ClaudeEvents {
  /** The conversation's background tasks. */
  readonly tasks = new ClaudeTasks();
  private readonly streamed = new Set<string>();
  private readonly calls = new Map<string, Call>();
  /** Claude Code's todo list, which it keeps with its task tools. */
  private readonly todoItems = new Map<string, TodoItem>();
  private readonly usage: Usage = { contextTokens: 0, contextWindow: 200_000, cost: 0 };
  private model?: string;
  private session?: string;
  /** A compaction whose summary may come in the next message. */
  private compacted?: Extract<AgentEvent, { type: 'compaction'; state: 'done' }>;
  /** The plan Claude Code wrote last in plan mode. */
  private planFile?: string;
  private planText?: string;
  private last?: AgentEvent['type'];

  constructor(
    private readonly cwd: string,
    /** Spent before this process took over the conversation, e.g. when it was resumed. */
    private readonly baseCost = 0,
  ) {}

  get cost() {
    return this.usage.cost;
  }

  /** Where Claude Code compacts on its own, as a usage event when that changed. */
  compactAt(tokens: number | undefined): AgentEvent | undefined {
    if (this.usage.compactAt === tokens) return undefined;
    this.usage.compactAt = tokens;
    return { type: 'usage', usage: { ...this.usage } };
  }

  /** Claude Code's session id, once the process reported it. */
  get sessionId() {
    return this.session;
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
        const mode = 'permissionMode' in message ? MODES_BY_PERMISSION[message.permissionMode as string] : undefined;
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

  /** `parent` is the subagent call the message comes from, if it does. */
  private *assistant(message: SDKAssistantMessage['message'], parent?: string): Generator<AgentEvent> {
    // Streamed messages already sent their text and thinking as deltas.
    const streamed = this.streamed.has(message.id);
    for (const block of message.content) {
      if (block.type === 'text' && !streamed && block.text) yield { type: 'text', delta: block.text };
      if (block.type === 'thinking' && !streamed && block.thinking) yield { type: 'thinking', delta: block.thinking };
      if (block.type === 'tool_use') {
        const input = (block.input ?? {}) as Input;
        this.calls.set(block.id, { name: block.name, input, startedAt: Date.now(), parent });
        const call = this.toCall(block.name, input);
        if (call) yield { type: 'tool-start', id: block.id, call };
      }
    }
  }

  /**
   * A subagent's tool calls, under the `agent` call they belong to. What it writes and what its commands print stay
   * out, so the tree stays one line per call.
   */
  private *subagent(events: Generator<AgentEvent>, parent: string): Generator<AgentEvent> {
    for (const event of events) {
      if (event.type === 'tool-start' && event.call.name !== 'todo') yield { ...event, parent };
      if (event.type === 'tool-end') yield { ...event, parent };
    }
  }

  private toCall(name: string, input: Input): ToolCall | undefined {
    switch (name) {
      case 'Read':
        return { name: 'read', input: { files: [{ path: this.path(input.file_path), lines: lineRange(input) }] } };
      case 'Grep':
        return { name: 'grep', input: { pattern: text(input.pattern), path: this.path(input.path) || '.' } };
      case 'Glob':
        return { name: 'glob', input: { pattern: text(input.pattern) } };
      case 'Bash':
        return { name: 'bash', input: { command: text(input.command), timeoutMs: number(input.timeout) ?? 120_000 } };
      case 'Edit':
        // The plan shows when the agent asks to go ahead with it, not each time it is written.
        if (this.isPlan(input)) return undefined;
        return {
          name: 'edit',
          input: { path: this.path(input.file_path), patch: replacePatch(text(input.old_string), text(input.new_string)) },
        };
      case 'Write':
        if (this.isPlan(input)) return undefined;
        return { name: 'edit', input: { path: this.path(input.file_path), patch: addPatch(text(input.content)), created: true } };
      case 'AskUserQuestion':
        return { name: 'ask', input: { questions: toQuestions(input.questions as ClaudeQuestion[]) } };
      case 'Agent':
      case 'Task':
        return { name: 'agent', input: { description: text(input.description), kind: text(input.subagent_type) || undefined } };
      case 'ExitPlanMode':
        // Claude Code now passes the plan in its plan file rather than in the call.
        return { name: 'plan', input: { plan: text(input.plan) || this.readPlan() } };
      case 'Skill':
        return { name: 'other', input: { title: 'Skill', detail: skillLabel(text(input.skill)) } };
      case 'ToolSearch':
        return { name: 'other', input: { title: 'Load tools', detail: toolQuery(text(input.query)) } };
      case `mcp__${MEMORY_SERVER}__remember`:
        return { name: 'memory', input: { action: 'remember', detail: `${text(input.scope)} · ${text(input.title)}` } };
      case `mcp__${MEMORY_SERVER}__recall`: {
        const ids = Array.isArray(input.ids) ? (input.ids as unknown[]).map(text) : [];
        return { name: 'memory', input: { action: 'recall', detail: ids.length > 0 ? ids.join(', ') : 'every note' } };
      }
      case `mcp__${MEMORY_SERVER}__forget`:
        return { name: 'memory', input: { action: 'forget', detail: text(input.id) } };
      default:
        if (TASK_TOOLS.has(name)) return undefined;
        return { name: 'other', input: { title: toolTitle(name), detail: summary(input) } };
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
      yield* this.toolEnd(block.tool_use_id, call, { text: output, error: block.is_error === true, data });
    }
  }

  private *toolEnd(id: string, call: Call, { text: output, error, data }: Outcome): Generator<AgentEvent> {
    const ok = !error;
    // A subagent's own task list isn't the one the conversation shows.
    if (call.parent && TASK_TOOLS.has(call.name)) return;
    switch (call.name) {
      case 'Bash': {
        // Sent to the background, by the agent or with ctrl+b: it goes on as a task, which says how it ends.
        const background = typeof data?.backgroundTaskId === 'string' ? data.backgroundTaskId : undefined;
        if (background) {
          yield* this.tasks.output(background, output);
          yield { type: 'tool-end', id, ok, result: { exitCode: 0, wallMs: Date.now() - call.startedAt, background } };
          return;
        }
        const exitCode = error ? Number(/^(?:Error: )?Exit code (\d+)/.exec(output)?.[1] ?? 1) : 0;
        const printed = data ? [text(data.stdout), text(data.stderr)].filter(Boolean).join('\n') : stripExitCode(output);
        const lines = printed.replace(/\n+$/, '');
        if (lines) yield { type: 'tool-output', id, lines: lines.split('\n') };
        yield { type: 'tool-end', id, ok, result: { exitCode, wallMs: Date.now() - call.startedAt } };
        return;
      }
      case 'Grep': {
        const mode = data?.mode ?? 'files_with_matches';
        const files = (Array.isArray(data?.filenames) ? (data.filenames as string[]) : []).map((file) => this.path(file));
        const result =
          mode === 'content'
            ? { matches: parseMatches(text(data?.content), this.path(call.input.path)) }
            : { matches: [], files };
        yield { type: 'tool-end', id, ok, result };
        return;
      }
      case 'Glob': {
        const files = Array.isArray(data?.filenames) ? (data.filenames as string[]).map((file) => this.path(file)) : [];
        yield { type: 'tool-end', id, ok, result: { files } };
        return;
      }
      case 'Edit':
      case 'Write': {
        if (this.isPlan(call.input)) return;
        const hunks = Array.isArray(data?.structuredPatch) ? (data.structuredPatch as Hunk[]) : [];
        yield { type: 'tool-end', id, ok, result: hunks.length > 0 ? { patch: hunksToPatch(hunks) } : {} };
        return;
      }
      case 'Agent':
      case 'Task': {
        const background = data?.isAsync === true && typeof data.agentId === 'string' ? data.agentId : undefined;
        yield { type: 'tool-end', id, ok, result: background ? { background } : {} };
        return;
      }
      case 'AskUserQuestion': {
        const questions = (call.input.questions ?? []) as ClaudeQuestion[];
        const answers = ok && isObject(data?.answers) ? fromClaudeAnswers(questions, data) : [];
        yield { type: 'tool-end', id, ok, result: { answers } };
        return;
      }
      case 'TaskCreate': {
        const task = isObject(data?.task) ? data.task : undefined;
        if (!ok || !task) return;
        this.todoItems.set(text(task.id), { text: text(task.subject), status: 'pending' });
        yield* this.todos(id);
        return;
      }
      case 'TaskUpdate': {
        const task = this.todoItems.get(text(call.input.taskId));
        if (!ok || !task) return;
        const { status, subject } = call.input;
        if (status === 'deleted') this.todoItems.delete(text(call.input.taskId));
        else {
          if (typeof subject === 'string') task.text = subject;
          if (status === 'pending') task.status = 'pending';
          if (status === 'in_progress') task.status = 'active';
          if (status === 'completed') task.status = 'done';
        }
        yield* this.todos(id);
        return;
      }
      default:
        if (TASK_TOOLS.has(call.name)) return;
        yield { type: 'tool-end', id, ok, result: {} };
    }
  }

  /** Claude Code updates its task list one task at a time; Jinion shows the whole list. */
  private *todos(id: string): Generator<AgentEvent> {
    const items = [...this.todoItems.values()].map((item) => ({ ...item }));
    yield { type: 'tool-start', id, call: { name: 'todo', input: { groups: [{ title: 'Tasks', items }] } } };
    yield { type: 'tool-end', id, ok: true, result: {} };
  }

  private *compaction(message: Extract<SDKMessage, { type: 'system'; subtype: 'status' | 'compact_boundary' }>): Generator<AgentEvent> {
    if (message.subtype === 'compact_boundary') {
      const { trigger, pre_tokens: before, post_tokens: after } = message.compact_metadata;
      this.compacted = { type: 'compaction', state: 'done', trigger, before, after };
      return;
    }
    if (message.status === 'compacting') yield { type: 'compaction', state: 'running' };
    if (message.compact_result === 'failed') {
      yield { type: 'compaction', state: 'failed', error: message.compact_error || 'Claude Code could not compact the conversation.' };
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

  /** Whether a file tool works on Claude Code's plan file, which is remembered for `ExitPlanMode`. */
  private isPlan(input: Input) {
    const path = text(input.file_path);
    if (!path || !isPlanFile(path)) return false;
    this.planFile = path;
    if (typeof input.content === 'string') this.planText = input.content;
    else if (this.planText !== undefined) this.planText = this.planText.replace(text(input.old_string), text(input.new_string));
    return true;
  }

  /** The plan file as it is now, or as the calls wrote it when it can't be read, e.g. in a replayed conversation. */
  private readPlan() {
    try {
      return this.planFile ? readFileSync(this.planFile, 'utf8') : '';
    } catch {
      return this.planText ?? '';
    }
  }

  /** Paths inside the project are shown relative to it. */
  private path(value: unknown) {
    const path = text(value);
    if (!path || !isAbsolute(path)) return path;
    const inside = relative(this.cwd, path);
    return inside && !inside.startsWith('..') && !isAbsolute(inside) ? inside : path;
  }
}

const WINDOW_LABELS: Record<string, string> = {
  five_hour: '5h',
  seven_day: '7d',
  seven_day_opus: '7d opus',
  seven_day_sonnet: '7d sonnet',
};

type RateLimitInfo = Extract<SDKMessage, { type: 'rate_limit_event' }>['rate_limit_info'];

/**
 * Claude Code reports every window of the plan in `unifiedWindows`, which its types don't declare yet, and the one
 * that applies to the request in `rateLimitType`.
 */
function limitWindows(info: RateLimitInfo): LimitWindow[] {
  const unified = (info as { unifiedWindows?: Record<string, { utilization?: number; resetsAt?: number }> })
    .unifiedWindows;
  const entries = unified
    ? Object.entries(unified)
    : info.rateLimitType
      ? [[info.rateLimitType, { utilization: info.utilization, resetsAt: info.resetsAt }] as const]
      : [];
  return entries.flatMap(([id, window]) =>
    typeof window.utilization === 'number'
      ? [
          {
            label: WINDOW_LABELS[id] ?? id,
            used: window.utilization > 1 ? window.utilization / 100 : window.utilization,
            resetsAt: window.resetsAt === undefined ? undefined : window.resetsAt * 1000,
          },
        ]
      : [],
  );
}

export function toQuestions(questions: ClaudeQuestion[]): Question[] {
  return questions.map((question) => ({
    id: question.question,
    prompt: question.question,
    options: question.options.map(({ label, description }) => ({ label, description })),
    multiple: question.multiSelect === true,
  }));
}

/** The answer fields Claude Code's AskUserQuestion tool reads from its input. */
export function toClaudeAnswers(questions: ClaudeQuestion[], answers: QuestionAnswer[]) {
  const byQuestion: Record<string, string> = {};
  const annotations: Record<string, { notes: string }> = {};
  questions.forEach((question, index) => {
    const answer = answers[index];
    if (!answer) return;
    // Several picks go back as one comma-separated answer, the way AskUserQuestion takes them.
    const labels = answer.options.map((option) => question.options[option]?.label ?? '');
    byQuestion[question.question] = [...labels, ...(answer.text ? [answer.text] : [])].join(', ');
    if (answer.note) annotations[question.question] = { notes: answer.note };
  });
  return { answers: byQuestion, annotations };
}

function fromClaudeAnswers(questions: ClaudeQuestion[], data: Input): QuestionAnswer[] {
  const answers = data.answers as Record<string, string>;
  const annotations = (isObject(data.annotations) ? data.annotations : {}) as Record<string, { notes?: string }>;
  return questions.map((question) => {
    const answer = answers[question.question] ?? '';
    const parts = question.multiSelect ? answer.split(', ') : [answer];
    const options = parts.flatMap((part) => {
      const option = question.options.findIndex((candidate) => candidate.label === part);
      return option >= 0 ? [option] : [];
    });
    const text = parts.filter((part) => part && !question.options.some((candidate) => candidate.label === part)).join(', ');
    const note = annotations[question.question]?.notes;
    return { options, ...(text ? { text } : {}), ...(note ? { note } : {}) };
  });
}

interface Hunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
}

function hunksToPatch(hunks: Hunk[]) {
  return hunks
    .flatMap((hunk) => [`@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`, ...hunk.lines])
    .join('\n');
}

/** A preview until Claude Code reports the applied patch with real line numbers. */
function replacePatch(before: string, after: string) {
  const removed = splitLines(before);
  const added = splitLines(after);
  return [
    `@@ -1,${removed.length} +1,${added.length} @@`,
    ...removed.map((line) => `-${line}`),
    ...added.map((line) => `+${line}`),
  ].join('\n');
}

function addPatch(content: string) {
  const lines = splitLines(content);
  return [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join('\n');
}

const splitLines = (value: string) => (value ? value.replace(/\n$/, '').split('\n') : []);

/** Matches look like `file:line:text`, or `line:text` when a single file was searched. */
function parseMatches(content: string, searched: string): GrepMatch[] {
  const matches: GrepMatch[] = [];
  for (const line of splitLines(content)) {
    const match = /^(.+?):(\d+):(.*)$/.exec(line) ?? /^()(\d+):(.*)$/.exec(line);
    if (match) matches.push({ file: match[1] || searched, line: Number(match[2]), text: match[3]! });
  }
  return matches;
}

function lineRange(input: Input) {
  const offset = number(input.offset);
  const limit = number(input.limit);
  if (offset === undefined) return limit === undefined ? undefined : `1-${limit}`;
  return limit === undefined ? `${offset}-` : `${offset}-${offset + limit - 1}`;
}

function stripExitCode(output: string) {
  return output.replace(/^(?:Error: )?Exit code \d+\n?/, '');
}

function resultText(content: unknown) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((block) => isObject(block) && block.type === 'text')
    .map((block) => text((block as Input).text))
    .join('\n');
}

/**
 * `mcp__github__create_issue` reads as `github:create_issue`, without the prefix of a claude.ai connector
 * (`claude_ai_Linear`) or a plugin's server (`plugin_vercel_vercel`).
 */
export function toolTitle(name: string) {
  const mcp = /^mcp__(.+?)__(.+)$/.exec(name);
  if (!mcp) return name;
  const server = mcp[1]!.replace(/^claude_ai_/, '').replace(/^plugin_[^_]+_/, '');
  return `${server}:${mcp[2]}`;
}

/** `select:mcp__context7__query-docs,mcp__context7__resolve-library-id` reads as the tools' titles. */
function toolQuery(query: string) {
  if (!query.startsWith('select:')) return query;
  return query.slice('select:'.length).split(',').map((name) => toolTitle(name.trim())).join(', ');
}

const SUMMARY_KEYS = ['url', 'query', 'file_path', 'path', 'command', 'description', 'prompt'];

function summary(input: Input) {
  const key = SUMMARY_KEYS.find((candidate) => typeof input[candidate] === 'string');
  const value = key ? text(input[key]) : '';
  const line = value.split('\n')[0] ?? '';
  return line.length > 80 ? `${line.slice(0, 79)}…` : line || undefined;
}

/** Claude Code echoes some messages back, e.g. a command's output, which nobody new said. */
const isReplay = (message: object) => 'isReplay' in message && message.isReplay === true;

const isObject = (value: unknown): value is Input => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown) => (typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value));
const number = (value: unknown) => (typeof value === 'number' ? value : undefined);
