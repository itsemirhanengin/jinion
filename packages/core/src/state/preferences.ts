import { loadSettings, saveNotifications, saveWorktrees } from '../settings/user.js';
import { persistedAtom } from './persisted.js';

export const notificationsAtom = persistedAtom(() => loadSettings().notifications !== false, saveNotifications);

export const worktreesAtom = persistedAtom(() => loadSettings().worktrees === true, saveWorktrees);
