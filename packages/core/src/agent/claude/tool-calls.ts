import type { AgentEvent } from '../events.js';
import type { GrepMatch, SearchHit, ToolCall } from '../tools.js';
import { type Input, isObject, number, text } from './input.js';
import { MEMORY_SERVER } from './memory.js';
import { addPatch, type Hunk, hunksToPatch, replacePatch, splitLines } from './patches.js';
import type { PlanFile } from './plan.js';
import { skillLabel } from './plugins.js';
import { type ClaudeQuestion, fromClaudeAnswers, toQuestions } from './questions.js';
import type { ClaudeTasks } from './tasks.js';
import { type ClaudeTodos, isTodoTool } from './todos.js';
import { inputSummary, mcpTool, toolArguments, toolQuery, toolTitle } from './tool-names.js';

export interface Call {
  name: string;
  input: Input;
  startedAt: number;
  parent?: string;
}

export interface Outcome {
  text: string;
  error: boolean;
  /** Claude Code's structured result, when the message carries exactly one tool result. */
  data: Input | undefined;
}

export interface ToolContext {
  path(value: unknown): string;
  plan: PlanFile;
  tasks: ClaudeTasks;
  todos: ClaudeTodos;
}

export function toCall(name: string, input: Input, { path, plan }: ToolContext): ToolCall | undefined {
  switch (name) {
    case 'Read':
      return { name: 'read', input: { files: [{ path: path(input.file_path), lines: lineRange(input) }] } };

    case 'Grep':
      return { name: 'grep', input: { pattern: text(input.pattern), path: path(input.path) || '.' } };

    case 'Glob':
      return { name: 'glob', input: { pattern: text(input.pattern) } };

    case 'Bash':
      return { name: 'bash', input: { command: text(input.command), timeoutMs: number(input.timeout) ?? 120_000 } };

    case 'Edit':
      // The plan shows when the agent asks to go ahead with it, not each time it is written.
      if (plan.writes(input)) return undefined;

      return {
        name: 'edit',
        input: { path: path(input.file_path), patch: replacePatch(text(input.old_string), text(input.new_string)) },
      };

    case 'Write':
      if (plan.writes(input)) return undefined;

      return { name: 'edit', input: { path: path(input.file_path), patch: addPatch(text(input.content)), created: true } };

    case 'AskUserQuestion':
      return { name: 'ask', input: { questions: toQuestions(input.questions as ClaudeQuestion[]) } };

    case 'Agent':
    case 'Task':
      return { name: 'agent', input: { description: text(input.description), kind: text(input.subagent_type) || undefined } };

    case 'ExitPlanMode':
      // Claude Code now passes the plan in its plan file rather than in the call.
      return { name: 'plan', input: { plan: text(input.plan) || plan.read() } };

    case 'Skill':
      return { name: 'other', input: { title: 'Skill', detail: skillLabel(text(input.skill)) } };

    case 'ToolSearch':
      return { name: 'other', input: { title: 'Load tools', detail: toolQuery(text(input.query)) } };

    case 'WebFetch':
      return { name: 'fetch', input: { url: text(input.url), prompt: text(input.prompt) } };

    case 'WebSearch':
      return { name: 'search', input: { query: text(input.query) } };

    case `mcp__${MEMORY_SERVER}__remember`:
      return { name: 'memory', input: { action: 'remember', detail: `${text(input.scope)} · ${text(input.title)}` } };

    case `mcp__${MEMORY_SERVER}__recall`: {
      const ids = Array.isArray(input.ids) ? (input.ids as unknown[]).map(text) : [];

      return { name: 'memory', input: { action: 'recall', detail: ids.length > 0 ? ids.join(', ') : 'every note' } };
    }

    case `mcp__${MEMORY_SERVER}__forget`:
      return { name: 'memory', input: { action: 'forget', detail: text(input.id) } };

    default: {
      if (isTodoTool(name)) return undefined;

      const mcp = mcpTool(name);
      if (mcp) return { name: 'mcp', input: { ...mcp, arguments: toolArguments(input) } };

      return { name: 'other', input: { title: toolTitle(name), detail: inputSummary(input) } };
    }
  }
}

export function* toolEnd(id: string, call: Call, { text: output, error, data }: Outcome, context: ToolContext): Generator<AgentEvent> {
  // A subagent's own task list isn't the one the conversation shows.
  if (call.parent && isTodoTool(call.name)) return;

  const ok = !error;

  switch (call.name) {
    case 'Bash': {
      // Sent to the background, by the agent or with ctrl+b: it goes on as a task, which says how it ends.
      const background = typeof data?.backgroundTaskId === 'string' ? data.backgroundTaskId : undefined;

      if (background) {
        yield* context.tasks.output(background, output);
        yield { type: 'tool-end', id, ok, result: { exitCode: 0, wallMs: Date.now() - call.startedAt, background } };

        return;
      }

      const exitCode = error ? Number(/^(?:Error: )?Exit code (\d+)/.exec(output)?.[1] ?? 1) : 0;
      const printed = data ? [text(data.stdout), text(data.stderr)].filter(Boolean).join('\n') : stripExitCode(output);

      yield* outputLines(id, printed);
      yield { type: 'tool-end', id, ok, result: { exitCode, wallMs: Date.now() - call.startedAt } };

      return;
    }

    case 'Grep': {
      const mode = data?.mode ?? 'files_with_matches';
      const files = (Array.isArray(data?.filenames) ? (data.filenames as string[]) : []).map((file) => context.path(file));

      const result =
        mode === 'content'
          ? { matches: parseMatches(text(data?.content), context.path(call.input.path)) }
          : { matches: [], files };

      yield { type: 'tool-end', id, ok, result };

      return;
    }

    case 'Glob': {
      const files = Array.isArray(data?.filenames) ? (data.filenames as string[]).map((file) => context.path(file)) : [];

      yield { type: 'tool-end', id, ok, result: { files } };

      return;
    }

    case 'Edit':
    case 'Write': {
      if (context.plan.writes(call.input)) return;

      const hunks = Array.isArray(data?.structuredPatch) ? (data.structuredPatch as Hunk[]) : [];

      yield { type: 'tool-end', id, ok, result: hunks.length > 0 ? { patch: hunksToPatch(hunks) } : {} };

      return;
    }

    case 'WebFetch':
      yield* outputLines(id, data && ok ? text(data.result) : output);
      yield { type: 'tool-end', id, ok, result: { bytes: number(data?.bytes), code: number(data?.code), codeText: text(data?.codeText) || undefined } };

      return;

    case 'WebSearch': {
      const seconds = number(data?.durationSeconds);

      yield {
        type: 'tool-end',
        id,
        ok,
        result: { hits: searchHits(data?.results), searches: number(data?.searchCount), durationMs: seconds === undefined ? undefined : seconds * 1000 },
      };

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

      context.todos.create(task);
      yield* context.todos.events(id);

      return;
    }

    case 'TaskUpdate':
      if (!ok || !context.todos.update(call.input)) return;

      yield* context.todos.events(id);

      return;

    default:
      if (isTodoTool(call.name)) return;

      if (mcpTool(call.name)) yield* outputLines(id, output);

      yield { type: 'tool-end', id, ok, result: {} };
  }
}

function lineRange(input: Input) {
  const offset = number(input.offset);
  const limit = number(input.limit);
  if (offset === undefined) return limit === undefined ? undefined : `1-${limit}`;

  return limit === undefined ? `${offset}-` : `${offset}-${offset + limit - 1}`;
}

function* outputLines(id: string, printed: string): Generator<AgentEvent> {
  const lines = printed.replace(/\n+$/, '');

  if (lines) yield { type: 'tool-output', id, lines: lines.split('\n') };
}

/** Claude Code's results mix lists of hits, one per search, with the model's remarks between them. */
function searchHits(results: unknown): SearchHit[] {
  if (!Array.isArray(results)) return [];

  return results
    .flatMap((result) => (isObject(result) && Array.isArray(result.content) ? (result.content as unknown[]) : []))
    .filter(isObject)
    .map((hit) => ({ title: text(hit.title), url: text(hit.url) }))
    .filter((hit) => hit.url);
}

function stripExitCode(output: string) {
  return output.replace(/^(?:Error: )?Exit code \d+\n?/, '');
}

/** Matches look like `file:line:text`, or `line:text` when a single file was searched. */
function parseMatches(content: string, searched: string): GrepMatch[] {
  const matches: GrepMatch[] = [];

  for (const line of splitLines(content)) {
    const match = /^(.+?):(\d+):(.*)$/.exec(line) ?? /^()(\d+):(.*)$/.exec(line);

    if (match) matches.push({ file: match[1] || searched, line: Number(match[2]), text: match[3]! });
  }

  return matches;
}
