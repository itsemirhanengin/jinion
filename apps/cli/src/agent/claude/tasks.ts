import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type { AgentEvent } from '../events.js';
import type { BackgroundTask } from '../tasks.js';

type System = Extract<SDKMessage, { type: 'system' }>;
type Message<S extends System['subtype']> = Extract<System, { subtype: S }>;

/** Claude Code registers a long command as a task in the foreground too, which ctrl+b can send to the background. */
type Tracked = BackgroundTask & { background: boolean };

const KINDS: Record<string, BackgroundTask['kind']> = { local_bash: 'shell', local_agent: 'agent' };

/** `Command running in background with ID: … Output is being written to: <file>.` and the like. */
const OUTPUT_FILE = /Output is being written to: (\S+?\.output)\b/;

export class ClaudeTasks {
  private readonly tasks = new Map<string, Tracked>();

  *map(message: System, command: (toolUseId: string) => string | undefined): Generator<AgentEvent> {
    switch (message.subtype) {
      case 'task_started':
        yield* this.started(message, command);
        return;
      case 'task_updated': {
        const task = this.tasks.get(message.task_id);
        if (!task || !message.patch.is_backgrounded || task.background) return;
        task.background = true;
        yield this.list();
        return;
      }
      case 'task_progress': {
        const task = this.tasks.get(message.task_id);
        if (!task) return;
        task.calls = message.usage.tool_uses;
        task.lastCall = message.summary ?? message.last_tool_name;
        yield this.list();
        return;
      }
      case 'task_notification':
        yield* this.ended(message);
        return;
    }
  }

  get running() {
    return [...this.tasks.values()].filter((task) => task.background && task.status === 'running').length;
  }

  *output(taskId: string, result: string): Generator<AgentEvent> {
    const task = this.tasks.get(taskId);
    const file = OUTPUT_FILE.exec(result)?.[1];
    if (!task || !file) return;
    task.output = file;
    yield this.list();
  }

  stopAll(): AgentEvent | undefined {
    const running = [...this.tasks.values()].filter((task) => task.background && task.status === 'running');
    for (const task of running) Object.assign(task, { status: 'stopped', endedAt: Date.now() });
    return running.length > 0 ? this.list() : undefined;
  }

  private *started(message: Message<'task_started'>, command: (toolUseId: string) => string | undefined): Generator<AgentEvent> {
    // Housekeeping Claude Code does on its own.
    if (message.ambient || message.skip_transcript) return;
    const kind = KINDS[message.task_type ?? ''] ?? 'other';
    const title = (kind === 'shell' && message.tool_use_id && command(message.tool_use_id)) || message.description;
    const background = message.is_backgrounded === true;
    this.tasks.set(message.task_id, { id: message.task_id, kind, title, status: 'running', startedAt: Date.now(), background });
    yield this.list();
  }

  private *ended(message: Message<'task_notification'>): Generator<AgentEvent> {
    const task = this.tasks.get(message.task_id);
    if (!task) return;
    if (!task.background) {
      // A command or subagent that finished where it started, as an ordinary tool call.
      this.tasks.delete(task.id);
      yield this.list();
      return;
    }
    Object.assign(task, { status: message.status, endedAt: Date.now() });
    if (message.output_file) task.output = message.output_file;
    yield this.list();
    yield { type: 'task-end', task: copy(task), summary: message.summary || undefined };
  }

  private list(): AgentEvent {
    return { type: 'tasks', tasks: [...this.tasks.values()].map(copy) };
  }
}

const copy = ({ background, ...task }: Tracked): BackgroundTask => ({ ...task, ...(!background && { foreground: true }) });
