import type { Question, QuestionAnswer } from '@jinion/tui/chat';
import type { RunContext } from '../agent.js';
import type { AgentEvent } from '../events.js';
import type { ToolCall, ToolName, ToolResult, Tools } from '../tools.js';
import type { Usage } from '../usage.js';
import type { DemoTasks } from './tasks.js';
import type { BackgroundScript } from './types.js';

export interface Stage {
  totals: Usage;
  /** 1 plays like a real agent, 0 as fast as possible. */
  pace: number;
  tasks: DemoTasks;
  nextCall(): number;
}

export class Script {
  constructor(
    private readonly context: RunContext,
    private readonly stage: Stage,
  ) {}

  async *background(command: string, script: BackgroundScript): AsyncGenerator<AgentEvent> {
    const call = this.stage.nextCall();
    const id = `tool_${call}`;
    const task = `task_${call}`;

    yield { type: 'tool-start', id, call: { name: 'bash', input: { command, timeoutMs: 120_000 } } };
    await this.wait(300);
    yield this.stage.tasks.start(task, command, script);
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
    const { totals } = this.stage;

    totals.contextTokens += tokens;
    totals.cost += cost;
    yield { type: 'usage', usage: { ...totals } };
  }

  async *tool<N extends ToolName>(
    name: N,
    input: Tools[N]['input'],
    result: Tools[N]['result'],
    durationMs = 600,
  ): AsyncGenerator<AgentEvent> {
    const id = this.callId();

    yield { type: 'tool-start', id, call: { name, input } as ToolCall };
    await this.wait(durationMs);
    yield { type: 'tool-end', id, ok: true, result };
  }

  async *agent(description: string, calls: { call: ToolCall; result?: ToolResult }[], stepMs = 350): AsyncGenerator<AgentEvent> {
    const id = this.callId();

    yield { type: 'tool-start', id, call: { name: 'agent', input: { description, kind: 'Explore' } } };

    for (const { call, result } of calls) {
      const child = this.callId();

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
    const id = this.callId();

    yield { type: 'tool-start', id, call: { name: 'bash', input: { command, timeoutMs } } };

    for (const line of output) {
      await this.wait(durationMs / Math.max(1, output.length));
      yield { type: 'tool-output', id, lines: [line] };
    }

    yield { type: 'tool-end', id, ok: exitCode === 0, result: { exitCode, wallMs: durationMs } };
  }

  async *ask(questions: Question[]): AsyncGenerator<AgentEvent, QuestionAnswer[]> {
    const id = this.callId();

    yield { type: 'tool-start', id, call: { name: 'ask', input: { questions } } };
    const answers = await this.context.ask(questions);

    yield { type: 'tool-end', id, ok: true, result: { answers } };

    return answers;
  }

  private callId() {
    return `tool_${this.stage.nextCall()}`;
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
      }, ms * this.stage.pace);

      const onAbort = () => {
        clearTimeout(timer);
        reject(signal.reason);
      };

      signal.addEventListener('abort', onAbort, { once: true });
    });
  }
}
