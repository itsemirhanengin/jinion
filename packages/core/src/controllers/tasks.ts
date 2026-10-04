import { errorMessage } from '../lib/errors.js';
import { firstLine } from '../lib/text.js';
import type { BackgroundTask } from '../agent/tasks.js';
import type { SessionContext } from './context.js';

export class TaskController {
  constructor(private readonly context: SessionContext) {}

  stop(id: string) {
    this.context.agent.stopTask?.(id).catch((error: unknown) =>
      this.context.notice(`Couldn't stop the task: ${errorMessage(error)}`, 'error'),
    );
  }

  sendToBackground() {
    const { agent, atoms, store, notice } = this.context;
    if (!agent.background) return;

    if (!store.get(atoms.waitsOnForegroundTask)) {
      return notice('Nothing to send to the background yet: a command or subagent can go there once it has run a few seconds.', 'muted');
    }

    agent.background().catch((error: unknown) => notice(`Couldn't send it to the background: ${errorMessage(error)}`, 'error'));
  }

  ended(task: BackgroundTask) {
    this.context.notify(`${task.kind === 'agent' ? 'Subagent' : 'Background command'} ${task.status}: ${firstLine(task.title)}`);
  }
}
