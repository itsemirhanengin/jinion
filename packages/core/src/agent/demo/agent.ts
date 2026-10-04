import type { ModelOption, ModelSelection } from '../models.js';
import type { AgentBackend, AgentCommand, AgentMode, AgentPrompt, AgentSession, RunContext, SessionOptions } from '../agent.js';
import type { AgentEvent } from '../events.js';
import type { Usage } from '../usage.js';
import { demoContext, demoSummary } from './context.js';
import { Script } from './script.js';
import { DemoTasks } from './tasks.js';
import type { Scenario } from './types.js';
import { demoHistory, demoUsage } from './usage.js';

const MODEL: ModelOption = { id: 'scripted-demo', name: 'Scripted demo', description: 'Plays prewritten scenarios', efforts: [] };

/** Plays scripted scenarios instead of asking a model, for `--demo` and the app's tests. */
export class ScriptedBackend implements AgentBackend {
  readonly defaultModel = MODEL.id;
  /** The scenarios play the same in any mode, so there is only one. */
  readonly modes: AgentMode[] = ['edits'];
  /** The title of the scenario played last, which is what a conversation is about. */
  titled?: string;

  constructor(
    readonly scenarios: Scenario[],
    private readonly agentCommands: AgentCommand[] = [],
    /** 1 plays like a real agent, 0 as fast as possible, for tests. */
    readonly pace = 1,
    /** Tests give a second one another name, to move a conversation between backends. */
    readonly name = 'Demo',
  ) {}

  session({ selection }: SessionOptions = {}): ScriptedSession {
    return new ScriptedSession(this, selection ?? { model: this.defaultModel });
  }

  async models() {
    return [MODEL];
  }

  async commands() {
    return this.agentCommands;
  }

  async titleFor() {
    return this.titled;
  }

  async usage({ drivers = false } = {}) {
    return demoUsage(drivers);
  }

  async history() {
    return demoHistory();
  }
}

export class ScriptedSession implements AgentSession {
  readonly mode: AgentMode = 'edits';
  private readonly totals: Usage = { contextTokens: 0, contextWindow: 200_000, cost: 0, compactAt: 167_000 };
  private readonly tasks: DemoTasks;
  private prompts = 0;
  private calls = 0;

  constructor(
    private readonly backend: ScriptedBackend,
    public selection: ModelSelection,
  ) {
    this.tasks = new DemoTasks((followup, task, context) => followup(this.script(context), task), backend.pace);
  }

  async select(selection: ModelSelection) {
    this.selection = selection;
  }

  async setMode() {}

  async *run({ text: prompt }: AgentPrompt, context: RunContext): AsyncGenerator<AgentEvent> {
    const { scenarios } = this.backend;
    const scenario = scenarios.find((candidate) => candidate.match?.test(prompt)) ?? scenarios.find((candidate) => !candidate.match);
    if (!scenario) throw new Error('No scenario matches this prompt.');

    this.backend.titled = typeof scenario.title === 'string' ? scenario.title : scenario.title(prompt);
    yield { type: 'sent', id: `prompt_${++this.prompts}` };
    yield* scenario.play(this.script(context), prompt);
  }

  subscribe(listener: (event: AgentEvent) => void) {
    return this.tasks.subscribe(listener);
  }

  join(context: RunContext): AsyncIterable<AgentEvent> {
    return this.tasks.join(context);
  }

  async stopTask(id: string) {
    this.tasks.stop(id);
  }

  async *compact(focus: string | undefined, context: RunContext): AsyncGenerator<AgentEvent> {
    yield { type: 'compaction', state: 'running' };
    yield* this.script(context).pause(800);

    const before = this.totals.contextTokens;

    this.totals.contextTokens = Math.round(before / 3);
    const after = this.totals.contextTokens;

    yield { type: 'compaction', state: 'done', trigger: 'manual', before, after, summary: demoSummary(focus) };
    yield { type: 'usage', usage: { ...this.totals } };
  }

  async context() {
    return demoContext(this.totals);
  }

  async rewindPreview() {
    return undefined;
  }

  async rewind() {}

  /** The scenarios don't touch the disk, so there is nothing to move. */
  moveTo() {}

  close() {}

  private script(context: RunContext) {
    return new Script(context, { totals: this.totals, pace: this.backend.pace, tasks: this.tasks, nextCall: () => ++this.calls });
  }
}
