import type { Status } from '@jinion/tui';
import type { BackgroundTask } from '@jinion/core/agent/tasks';

export const TASK_MARKS: Record<BackgroundTask['status'], Status> = {
  running: 'running',
  completed: 'done',
  failed: 'error',
  stopped: 'cancelled',
};
