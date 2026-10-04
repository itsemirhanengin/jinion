import type { ModelOption, ModelSelection } from '../models.js';
import type { Agent, AgentCommand, AgentMode, AgentPrompt, RunContext } from '../agent.js';
import type { AgentEvent } from '../events.js';
import type { Usage } from '../usage.js';
import { demoContext, demoSummary } from './context.js';
import { Script } from './script.js';
import { DemoTasks } from './tasks.js';
import type { Scenario } from './types.js';
import { demoHistory, demoUsage } from './usage.js';

export class ScriptedAgent implements Agent {
  readonly name = 'Demo';
  selection: ModelSelection = { model: 'scripted-demo' };
  /** The scenarios play the same in any mode, so there is only one. */
  readonly mode: AgentMode = 'edits';
  readonly modes: AgentMode[] = ['edits'];
  private readonly totals: Usage = { contextTokens: 0, contextWindow: 200_000, cost: 0, compactAt: 167_000 };
  private readonly tasks: DemoTasks;
  private titled?: string;
  private prompts = 0;
  private calls = 0;

  constructor(
    private readonly scenarios: Scenario[],
    private readonly agentCommands: AgentCommand[] = [],
    /** 1 plays like a real agent, 0 as fast as possible, for tests. */
    private readonly pace = 1,
  ) {
    this.tasks = new DemoTasks((followup, task, context) => followup(this.script(context), task), pace);
  }

  async models(): Promise<ModelOption[]> {
    return [{ id: 'scripted-demo', name: 'Scripted demo', description: 'Plays prewritten scenarios', efforts: [] }];
  }

  async select(selection: ModelSelection) {
    this.selection = selection;
  }

  async setMode() {}

  async commands() {
    return this.agentCommands;
  }

  async titleFor() {
    return this.titled;
  }

  async *run({ text: prompt }: AgentPrompt, context: RunContext): AsyncGenerator<AgentEvent> {
    const scenario = this.scenarios.find((candidate) => candidate.match?.test(prompt)) ??
      this.scenarios.find((candidate) => !candidate.match);
    if (!scenario) throw new Error('No scenario matches this prompt.');

    this.titled = typeof scenario.title === 'string' ? scenario.title : scenario.title(prompt);
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

  async usage({ drivers = false } = {}) {
    return demoUsage(drivers);
  }

  async history() {
    return demoHistory();
  }

  async rewindPreview() {
    return undefined;
  }

  async rewind() {}

  reset() {
    Object.assign(this.totals, { contextTokens: 0, cost: 0 });
  }

  private script(context: RunContext) {
    return new Script(context, { totals: this.totals, pace: this.pace, tasks: this.tasks, nextCall: () => ++this.calls });
  }
}
