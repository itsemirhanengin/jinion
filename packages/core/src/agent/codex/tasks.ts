import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AgentEvent } from '../events.js';
import type { BackgroundTask } from '../tasks.js';

export const CODEX_TASKS_FOLDER = join(tmpdir(), 'jinion-codex-tasks');

type Tracked = BackgroundTask & { processId?: string; stopping?: boolean };

/**
 * Commands Codex left running when its turn ended, which go on in its background terminals. Their output goes to a file
 * as it comes, as Claude Code's does, so `ctrl+t` can show it.
 */
export class CodexTasks {
  private readonly tasks = new Map<string, Tracked>();

  constructor(private readonly folder = CODEX_TASKS_FOLDER) {}

  has(id: string) {
    return this.tasks.has(id);
  }

  get running() {
    return [...this.tasks.values()].filter((task) => task.status === 'running');
  }

  /** `output` is what it printed so far. */
  start(id: string, task: { title: string; startedAt: number; processId?: string; output: string }): AgentEvent {
    const file = join(this.folder, `${id}.output`);

    mkdirSync(this.folder, { recursive: true });
    writeFileSync(file, task.output);
    this.tasks.set(id, { id, kind: 'shell', title: task.title, status: 'running', startedAt: task.startedAt, processId: task.processId, output: file });

    return this.list();
  }

  output(id: string, delta: string) {
    const output = this.tasks.get(id)?.output;

    if (output) appendFileSync(output, delta);
  }

  /** The process to terminate for it; a task stopped this way ends as stopped rather than failed. */
  stop(id: string) {
    const task = this.tasks.get(id);
    if (!task || task.status !== 'running') return undefined;

    task.stopping = true;

    return task.processId;
  }

  /** `output` is all it printed, as Codex reports it at the end, which has what came before it was sent here too. */
  end(id: string, ok: boolean, output?: string | null): AgentEvent[] {
    const task = this.tasks.get(id);
    if (!task || task.status !== 'running') return [];

    if (output && task.output) writeFileSync(task.output, output);
    Object.assign(task, { status: task.stopping ? 'stopped' : ok ? 'completed' : 'failed', endedAt: Date.now() });

    return [this.list(), { type: 'task-end', task: copy(task) }];
  }

  /** The conversation closed or Codex stopped, and its terminals with it. */
  stopAll(): AgentEvent | undefined {
    const running = this.running;

    for (const task of running) Object.assign(task, { status: 'stopped', endedAt: Date.now() });

    return running.length > 0 ? this.list() : undefined;
  }

  private list(): AgentEvent {
    return { type: 'tasks', tasks: [...this.tasks.values()].map(copy) };
  }
}

const copy = ({ processId: _, stopping: __, ...task }: Tracked): BackgroundTask => ({ ...task });
