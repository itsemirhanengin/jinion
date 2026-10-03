import type { Jinion } from '../../controllers/jinion.js';
import { TasksPanel } from './tasks-panel.js';

export const openTasks = (jinion: Jinion) => jinion.screen.openPanel({ id: 'tasks', placement: 'bottom', element: <TasksPanel /> });
