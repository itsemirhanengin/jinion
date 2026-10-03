import type { TodoItem } from '@jinion/tui/chat';
import type { AgentEvent } from '../events.js';
import { type Input, text } from './input.js';

const TASK_TOOLS = new Set(['TaskCreate', 'TaskUpdate', 'TaskList', 'TaskGet']);

/** Claude Code's task tools, which keep its todo list, unlike its background tasks. */
export const isTodoTool = (name: string) => TASK_TOOLS.has(name);

export class ClaudeTodos {
  private readonly items = new Map<string, TodoItem>();

  create(task: Input) {
    this.items.set(text(task.id), { text: text(task.subject), status: 'pending' });
  }

  update(input: Input) {
    const task = this.items.get(text(input.taskId));
    if (!task) return false;

    const { status, subject } = input;

    if (status === 'deleted') this.items.delete(text(input.taskId));
    else {
      if (typeof subject === 'string') task.text = subject;
      if (status === 'pending') task.status = 'pending';
      if (status === 'in_progress') task.status = 'active';
      if (status === 'completed') task.status = 'done';
    }

    return true;
  }

  /** Claude Code updates its task list one task at a time; Jinion shows the whole list, as the call `id`. */
  *events(id: string): Generator<AgentEvent> {
    const items = [...this.items.values()].map((item) => ({ ...item }));

    yield { type: 'tool-start', id, call: { name: 'todo', input: { groups: [{ title: 'Tasks', items }] } } };
    yield { type: 'tool-end', id, ok: true, result: {} };
  }
}
