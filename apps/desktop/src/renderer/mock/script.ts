import type { AgentMode } from '@jinion/core/agent/agent';
import type { AgentEvent } from '@jinion/core/agent/events';
import type { PermissionDecision, PermissionRequest } from '@jinion/core/agent/permissions';
import type { BackgroundTask } from '@jinion/core/agent/tasks';
import type { TodoGroup } from '@jinion/core/agent/todos';
import type { GrepMatch, ToolCall, ToolResult } from '@jinion/core/agent/tools';

/** Where a scenario plays: a live session, or a thread made up front, which plays at once on a clock of its own. */
export interface Stage {
  instant: boolean;
  signal: AbortSignal;
  mode(): AgentMode;
  /** Moves the instant clock on; a live stage really waits instead. */
  advance(ms: number): void;
  emit(event: AgentEvent): void;
  approve(request: PermissionRequest): Promise<PermissionDecision>;
  write(path: string, content: string): void;
  task(task: BackgroundTask): void;
}

export interface Scenario {
  match?: RegExp;
  play(script: Script, prompt: string): Promise<void>;
}

/** What a scenario says and does, sent as the events a backend would send. */
export class Script {
  private calls = 0;

  constructor(private readonly stage: Stage) {}

  get mode() {
    return this.stage.mode();
  }

  async wait(ms: number) {
    if (this.stage.instant) return this.stage.advance(ms);

    const { signal } = this.stage;

    await new Promise<void>((resolve, reject) => {
      if (signal.aborted) return reject(signal.reason);

      const timer = setTimeout(resolve, ms);

      signal.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(signal.reason);
      });
    });
  }

  think(text: string) {
    return this.stream('thinking', text);
  }

  say(text: string) {
    return this.stream('text', text);
  }

  async tool(call: ToolCall, result: ToolResult, ms = 400, parent?: string) {
    const id = `call-${++this.calls}`;

    this.stage.emit({ type: 'tool-start', id, call, parent });
    await this.wait(ms);
    this.stage.emit({ type: 'tool-end', id, ok: true, result, parent });
  }

  read(...paths: string[]) {
    return this.tool({ name: 'read', input: { files: paths.map((path) => ({ path })) } }, {}, 350);
  }

  grep(pattern: string, path: string, matches: GrepMatch[]) {
    return this.tool({ name: 'grep', input: { pattern, path } }, { matches }, 450);
  }

  glob(pattern: string, files: string[]) {
    return this.tool({ name: 'glob', input: { pattern } }, { files }, 300);
  }

  async edit(path: string, patch: string, content: string, created?: boolean) {
    await this.tool({ name: 'edit', input: { path, patch, created } }, {}, 800);
    this.stage.write(path, content);
  }

  todo(groups: TodoGroup[]) {
    return this.tool({ name: 'todo', input: { groups } }, {}, 150);
  }

  /** Its output comes a few lines at a time, as a real command's does. */
  async bash(command: string, output: string[], { exitCode = 0, ms = 1200 } = {}) {
    const id = `call-${++this.calls}`;
    const step = Math.max(1, Math.ceil(output.length / 4));

    this.stage.emit({ type: 'tool-start', id, call: { name: 'bash', input: { command } } });

    for (let from = 0; from < output.length; from += step) {
      await this.wait(ms / Math.ceil(output.length / step));
      this.stage.emit({ type: 'tool-output', id, lines: output.slice(from, from + step) });
    }

    if (output.length === 0) await this.wait(ms);
    this.stage.emit({ type: 'tool-end', id, ok: exitCode === 0, result: { exitCode, wallMs: ms } });
  }

  /** A command that goes on in the background, as a task the turn doesn't wait for. */
  async background(command: string, output: string[]) {
    const id = `call-${++this.calls}`;
    const task = `task-${this.calls}`;

    this.stage.emit({ type: 'tool-start', id, call: { name: 'bash', input: { command } } });
    await this.wait(600);
    this.stage.task({ id: task, kind: 'shell', title: command, status: 'running', startedAt: Date.now(), output: output.join('\n') });
    this.stage.emit({ type: 'tool-end', id, ok: true, result: { exitCode: 0, wallMs: 600, background: task } });
  }

  /** A subagent, its calls shown under it. */
  async agent(description: string, calls: { call: ToolCall; result: ToolResult }[]) {
    const id = `call-${++this.calls}`;

    this.stage.emit({ type: 'tool-start', id, call: { name: 'agent', input: { description } } });

    for (const { call, result } of calls) await this.tool(call, result, 500, id);

    this.stage.emit({ type: 'tool-end', id, ok: true, result: {} });
  }

  /** Auto lets it through without asking, as its reviewer would for routine work. */
  approve(request: PermissionRequest): Promise<PermissionDecision> {
    if (this.stage.instant || this.mode === 'auto') return Promise.resolve({ allow: true });

    return this.stage.approve(request);
  }

  private async stream(kind: 'thinking' | 'text', text: string) {
    if (this.stage.instant) {
      this.stage.emit({ type: kind, delta: text });

      return this.stage.advance(kind === 'thinking' ? 4_000 : 1_000);
    }

    const words = text.match(/\S+\s*/g) ?? [];

    for (let from = 0; from < words.length; from += 3) {
      this.stage.emit({ type: kind, delta: words.slice(from, from + 3).join('') });
      await this.wait(28);
    }
  }
}
