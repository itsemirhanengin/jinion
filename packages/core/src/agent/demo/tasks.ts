import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { RunContext } from '../agent.js';
import type { AgentEvent } from '../events.js';
import type { BackgroundTask } from '../tasks.js';
import type { BackgroundScript, Followup } from './types.js';

export const DEMO_TASKS_FOLDER = join(tmpdir(), 'jinion-demo-tasks');

export class DemoTasks {
  private readonly listeners = new Set<(event: AgentEvent) => void>();
  private readonly tasks = new Map<string, { task: BackgroundTask; timers: NodeJS.Timeout[]; followup?: Followup }>();
  private pending?: (context: RunContext) => AsyncGenerator<AgentEvent>;

  constructor(
    private readonly play: (followup: Followup, task: BackgroundTask, context: RunContext) => AsyncGenerator<AgentEvent>,
    private readonly pace: number,
    private readonly folder = DEMO_TASKS_FOLDER,
  ) {}

  start(id: string, command: string, { output, durationMs = 3000, exitCode, followup }: BackgroundScript) {
    const file = join(this.folder, `${id}.output`);

    mkdirSync(this.folder, { recursive: true });
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

  subscribe(listener: (event: AgentEvent) => void) {
    this.listeners.add(listener);

    return () => void this.listeners.delete(listener);
  }

  join(context: RunContext): AsyncIterable<AgentEvent> {
    const play = this.pending;

    this.pending = undefined;

    return play ? play(context) : (async function* () {})();
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

  private list(): AgentEvent {
    return { type: 'tasks', tasks: [...this.tasks.values()].map(({ task }) => ({ ...task })) };
  }

  private emit(event: AgentEvent) {
    for (const listener of this.listeners) listener(event);
  }
}
