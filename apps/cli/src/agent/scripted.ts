import type { ModelOption, ModelSelection, Question, QuestionAnswer } from '@jinion/tui';
import type {
  Agent,
  AgentCommand,
  AgentEvent,
  AgentMode,
  AgentPrompt,
  RunContext,
  ToolCall,
  ToolName,
  Tools,
  Usage,
} from './types.js';

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
  private readonly usage: Usage = { contextTokens: 0, contextWindow: 200_000, cost: 0 };

  constructor(
    private readonly scenarios: Scenario[],
    private readonly agentCommands: AgentCommand[] = [],
    /** How long its pauses take: 1 plays like a real agent, 0 as fast as possible, for tests. */
    private readonly pace = 1,
  ) {}

  async commands() {
    return this.agentCommands;
  }

  async *run({ text: prompt }: AgentPrompt, context: RunContext): AsyncGenerator<AgentEvent> {
    const scenario = this.scenarios.find((candidate) => candidate.match?.test(prompt)) ??
      this.scenarios.find((candidate) => !candidate.match);
    if (!scenario) throw new Error('No scenario matches this prompt.');

    yield { type: 'sent', id: `prompt_${++promptSequence}` };
    yield { type: 'title', title: typeof scenario.title === 'string' ? scenario.title : scenario.title(prompt) };
    yield* scenario.play(new Script(context, this.usage, this.pace), prompt);
  }

  /** The demo changes no real files, so there is never anything to restore. */
  async rewindPreview() {
    return undefined;
  }

  /** Nothing to undo but the conversation on screen, which the app takes back itself. */
  async rewind() {}

  reset() {
    Object.assign(this.usage, { contextTokens: 0, cost: 0 });
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
  ) {}

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
