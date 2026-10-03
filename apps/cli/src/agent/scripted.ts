import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ModelOption, ModelSelection, Question, QuestionAnswer } from '@jinion/tui';
import type {
  Agent,
  AgentCommand,
  AgentEvent,
  AgentMode,
  AgentPrompt,
  BackgroundTask,
  RunContext,
  ToolCall,
  ToolName,
  ToolResult,
  Tools,
  Usage,
} from './types.js';
import { demoHistory, demoUsage } from './demo-usage.js';

/** What the agent says on its own once a background task ended, in a turn it starts itself. */
export type Followup = (script: Script, task: BackgroundTask) => AsyncGenerator<AgentEvent, void>;

export interface BackgroundScript {
  /** Printed one after another over `durationMs`; a task without `exitCode` runs until it is stopped. */
  output: string[];
  durationMs?: number;
  exitCode?: number;
  followup?: Followup;
}

/**
 * The demo's background tasks: their output goes to files the tasks panel reads, and they end on a timer or when
 * stopped, between turns, with a turn the agent starts itself to look at them.
 */
class DemoTasks {
  readonly listeners = new Set<(event: AgentEvent) => void>();
  private readonly tasks = new Map<string, { task: BackgroundTask; timers: NodeJS.Timeout[]; followup?: Followup }>();
  /** The turn a `turn-start` announced, until `join` plays it. */
  pending?: (context: RunContext) => AsyncGenerator<AgentEvent>;

  constructor(private readonly play: (followup: Followup, task: BackgroundTask, context: RunContext) => AsyncGenerator<AgentEvent>, private readonly pace: number) {}

  start(id: string, command: string, { output, durationMs = 3000, exitCode, followup }: BackgroundScript) {
    const folder = join(tmpdir(), 'jinion-demo-tasks');
    mkdirSync(folder, { recursive: true });
    const file = join(folder, `${id}.output`);
    writeFileSync(file, '');
    const task: BackgroundTask = { id, kind: 'shell', title: command, status: 'running', startedAt: Date.now(), output: file };
    const step = (durationMs / Math.max(1, output.length)) * this.pace;
    const timers = output.map((line, index) => setTimeout(() => appendFileSync(file, `${line}\n`), step * index));
    if (exitCode !== undefined) {
      timers.push(setTimeout(() => this.end(id, exitCode === 0 ? 'completed' : 'failed', `exit code ${exitCode}`), durationMs * this.pace));
    }
    this.tasks.set(id, { task, timers, followup });
    return this.list();
  }

  stop(id: string) {
    if (this.tasks.get(id)?.task.status === 'running') this.end(id, 'stopped');
  }

  private end(id: string, status: BackgroundTask['status'], summary?: string) {
    const entry = this.tasks.get(id)!;
    for (const timer of entry.timers) clearTimeout(timer);
    Object.assign(entry.task, { status, endedAt: Date.now() });
    this.emit(this.list());
    this.emit({ type: 'task-end', task: { ...entry.task }, summary });
    const { followup } = entry;
    if (!followup) return;
    const task = { ...entry.task };
    this.pending = (context) => this.play(followup, task, context);
    this.emit({ type: 'turn-start' });
  }

  list(): AgentEvent {
    return { type: 'tasks', tasks: [...this.tasks.values()].map(({ task }) => ({ ...task })) };
  }

  private emit(event: AgentEvent) {
    for (const listener of this.listeners) listener(event);
  }
}

export interface Scenario {
  title: string | ((prompt: string) => string);
  /** Scenarios without a pattern are fallbacks. */
  match?: RegExp;
  play(script: Script, prompt: string): AsyncGenerator<AgentEvent, void>;
}

/** Plays prewritten scenarios through the same event stream a real agent will produce. */
export class ScriptedAgent implements Agent {
  readonly name = 'Demo';
  selection: ModelSelection = { model: 'scripted-demo' };
  /** The scenarios play the same in any mode, so there is only one. */
  readonly mode: AgentMode = 'edits';
  readonly modes: AgentMode[] = ['edits'];
  private readonly totals: Usage = { contextTokens: 0, contextWindow: 200_000, cost: 0 };
  private readonly tasks: DemoTasks;

  constructor(
    private readonly scenarios: Scenario[],
    private readonly agentCommands: AgentCommand[] = [],
    /** How long its pauses take: 1 plays like a real agent, 0 as fast as possible, for tests. */
    private readonly pace = 1,
  ) {
    this.tasks = new DemoTasks((followup, task, context) => followup(this.script(context), task), pace);
  }

  async commands() {
    return this.agentCommands;
  }

  async *run({ text: prompt }: AgentPrompt, context: RunContext): AsyncGenerator<AgentEvent> {
    const scenario = this.scenarios.find((candidate) => candidate.match?.test(prompt)) ??
      this.scenarios.find((candidate) => !candidate.match);
    if (!scenario) throw new Error('No scenario matches this prompt.');

    yield { type: 'sent', id: `prompt_${++promptSequence}` };
    yield { type: 'title', title: typeof scenario.title === 'string' ? scenario.title : scenario.title(prompt) };
    yield* scenario.play(this.script(context), prompt);
  }

  subscribe(listener: (event: AgentEvent) => void) {
    this.tasks.listeners.add(listener);
    return () => void this.tasks.listeners.delete(listener);
  }

  join(context: RunContext): AsyncIterable<AgentEvent> {
    const play = this.tasks.pending;
    this.tasks.pending = undefined;
    return play ? play(context) : (async function* () {})();
  }

  async stopTask(id: string) {
    this.tasks.stop(id);
  }

  async usage({ drivers = false } = {}) {
    return demoUsage(drivers);
  }

  async history() {
    return demoHistory();
  }

  private script(context: RunContext) {
    return new Script(context, this.totals, this.pace, this.tasks);
  }

  /** The demo changes no real files, so there is never anything to restore. */
  async rewindPreview() {
    return undefined;
  }

  /** Nothing to undo but the conversation on screen, which the app takes back itself. */
  async rewind() {}

  reset() {
    Object.assign(this.totals, { contextTokens: 0, cost: 0 });
  }

  async models(): Promise<ModelOption[]> {
    return [{ id: 'scripted-demo', name: 'Scripted demo', description: 'Plays prewritten scenarios', efforts: [] }];
  }

  async select(selection: ModelSelection) {
    this.selection = selection;
  }

  async setMode() {}
}

let toolSequence = 0;
let promptSequence = 0;

export class Script {
  constructor(
    private readonly context: RunContext,
    private readonly totals: Usage,
    private readonly pace = 1,
    private readonly tasks?: DemoTasks,
  ) {}

  /** A command that goes on in the background; the turn goes on without waiting for it. */
  async *background(command: string, script: BackgroundScript): AsyncGenerator<AgentEvent> {
    if (!this.tasks) throw new Error('This script runs no background tasks.');
    const id = `tool_${++toolSequence}`;
    yield { type: 'tool-start', id, call: { name: 'bash', input: { command, timeoutMs: 120_000 } } };
    await this.wait(300);
    const task = `task_${toolSequence}`;
    yield this.tasks.start(task, command, script);
    yield { type: 'tool-end', id, ok: true, result: { exitCode: 0, wallMs: 300, background: task } };
  }

  think(text: string) {
    return this.stream('thinking', text);
  }

  say(text: string) {
    return this.stream('text', text);
  }

  // biome-ignore lint/correctness/useYield: scenarios `yield*` every step, pauses included, to keep one shape.
  async *pause(ms: number): AsyncGenerator<AgentEvent> {
    await this.wait(ms);
  }

  async *usage(tokens: number, cost: number): AsyncGenerator<AgentEvent> {
    this.totals.contextTokens += tokens;
    this.totals.cost += cost;
    yield { type: 'usage', usage: { ...this.totals } };
  }

  async *tool<N extends ToolName>(
    name: N,
    input: Tools[N]['input'],
    result: Tools[N]['result'],
    durationMs = 600,
  ): AsyncGenerator<AgentEvent> {
    const id = `tool_${++toolSequence}`;
    yield { type: 'tool-start', id, call: { name, input } as ToolCall };
    await this.wait(durationMs);
    yield { type: 'tool-end', id, ok: true, result };
  }

  /** A subagent that makes `calls` one after another. */
  async *agent(description: string, calls: { call: ToolCall; result?: ToolResult }[], stepMs = 350): AsyncGenerator<AgentEvent> {
    const id = `tool_${++toolSequence}`;
    yield { type: 'tool-start', id, call: { name: 'agent', input: { description, kind: 'Explore' } } };
    for (const { call, result } of calls) {
      const child = `tool_${++toolSequence}`;
      yield { type: 'tool-start', id: child, call, parent: id };
      await this.wait(stepMs);
      yield { type: 'tool-end', id: child, ok: true, result, parent: id };
    }
    yield { type: 'tool-end', id, ok: true, result: {} };
  }

  async *bash(
    command: string,
    output: string[],
    { exitCode = 0, durationMs = 1200, timeoutMs = 120_000 } = {},
  ): AsyncGenerator<AgentEvent> {
    const id = `tool_${++toolSequence}`;
    yield { type: 'tool-start', id, call: { name: 'bash', input: { command, timeoutMs } } };
    for (const line of output) {
      await this.wait(durationMs / Math.max(1, output.length));
      yield { type: 'tool-output', id, lines: [line] };
    }
    yield { type: 'tool-end', id, ok: exitCode === 0, result: { exitCode, wallMs: durationMs } };
  }

  async *ask(questions: Question[]): AsyncGenerator<AgentEvent, QuestionAnswer[]> {
    const id = `tool_${++toolSequence}`;
    yield { type: 'tool-start', id, call: { name: 'ask', input: { questions } } };
    const answers = await this.context.ask(questions);
    yield { type: 'tool-end', id, ok: true, result: { answers } };
    return answers;
  }

  private async *stream(type: 'thinking' | 'text', text: string): AsyncGenerator<AgentEvent> {
    for (const [word] of text.matchAll(/\s*\S+/g)) {
      await this.wait(12 + Math.random() * 24);
      yield { type, delta: word };
    }
  }

  private wait(ms: number) {
    const { signal } = this.context;
    return new Promise<void>((resolve, reject) => {
      if (signal.aborted) return reject(signal.reason);
      const timer = setTimeout(() => {
        signal.removeEventListener('abort', onAbort);
        resolve();
      }, ms * this.pace);
      const onAbort = () => {
        clearTimeout(timer);
        reject(signal.reason);
      };
      signal.addEventListener('abort', onAbort, { once: true });
    });
  }
}
