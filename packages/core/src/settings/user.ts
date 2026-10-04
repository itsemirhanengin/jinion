import { join } from 'node:path';
import type { ModelSelection } from '../agent/models.js';
import { readJson, updateJson } from '../lib/json-file.js';
import { jinionHome } from '../lib/paths.js';

/** What the core keeps in the user's settings file; a client may keep keys of its own there too, which stay as they are. */
export interface Settings {
  models?: Record<string, ModelSelection>;
  accounts?: Record<string, string>;
  mcp?: { disabled?: string[] };
  notifications?: boolean;
  worktrees?: boolean;
  askBeforeCommits?: boolean;
}

const file = () => join(jinionHome(), 'settings.json');

export const loadSettings = () => readJson<Settings>(file(), {});

/** `patch` gets the settings on disk and returns the keys to change. */
export const updateSettings = (patch: (current: Settings) => Settings) =>
  updateJson<Settings>(file(), {}, (current) => ({ ...current, ...patch(current) }));

export const saveModel = (agent: string, selection: ModelSelection) =>
  updateSettings((current) => ({ models: { ...current.models, [agent]: selection } }));

export const saveAccount = (agent: string, account: string) =>
  updateSettings((current) => ({ accounts: { ...current.accounts, [agent]: account } }));

export const saveNotifications = (notifications: boolean) => updateSettings(() => ({ notifications }));

export const saveWorktrees = (worktrees: boolean) => updateSettings(() => ({ worktrees }));

export const saveAskBeforeCommits = (askBeforeCommits: boolean) => updateSettings(() => ({ askBeforeCommits }));
