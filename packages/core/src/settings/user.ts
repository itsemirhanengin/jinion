import { join } from 'node:path';
import type { ModelSelection } from '../agent/models.js';
import { readJson, writeJson } from '../lib/json-file.js';
import { jinionHome } from '../lib/paths.js';

/** What the core keeps in the user's settings file; a client may keep keys of its own there too, which stay as they are. */
export interface Settings {
  models?: Record<string, ModelSelection>;
  accounts?: Record<string, string>;
  mcp?: { disabled?: string[] };
  notifications?: boolean;
  worktrees?: boolean;
}

const file = () => join(jinionHome(), 'settings.json');

export const loadSettings = () => readJson<Settings>(file(), {});

const update = (patch: (current: Settings) => Settings) => {
  const current = loadSettings();

  writeJson(file(), { ...current, ...patch(current) });
};

export const saveModel = (agent: string, selection: ModelSelection) =>
  update((current) => ({ models: { ...current.models, [agent]: selection } }));

export const saveAccount = (agent: string, account: string) =>
  update((current) => ({ accounts: { ...current.accounts, [agent]: account } }));

export const saveMcpSettings = (mcp: Settings['mcp']) => update(() => ({ mcp }));

export const saveNotifications = (notifications: boolean) => update(() => ({ notifications }));

export const saveWorktrees = (worktrees: boolean) => update(() => ({ worktrees }));
