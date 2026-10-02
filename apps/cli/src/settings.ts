import { join } from 'node:path';
import type { ModelSelection } from '@jinion/tui';
import { readJson, writeJson } from './json-file.js';
import { jinionHome, projectDir } from './paths.js';
import type { AgentMode, LimitWindow } from './agent/types.js';
import type { StatusItem } from './status/line.js';

/** Choices that carry over between runs, in `~/.jinion/settings.json`. */
export interface Settings {
  /** The last model picked for each agent, keyed by `Agent.name`. */
  models?: Record<string, ModelSelection>;
  /** What the status line shows, from `/statusline`. */
  statusLine?: StatusItem[];
  /** The account last switched to for each agent, keyed by `Agent.name`. */
  accounts?: Record<string, string>;
  /** MCP servers turned off in `/mcp`, by name, in every project. */
  mcp?: { disabled?: string[] };
}

const file = () => join(jinionHome(), 'settings.json');

export const loadSettings = () => readJson<Settings>(file(), {});

const update = (patch: Settings) => writeJson(file(), { ...loadSettings(), ...patch });

export function saveModel(agent: string, selection: ModelSelection) {
  update({ models: { ...loadSettings().models, [agent]: selection } });
}

export const saveStatusLine = (items: StatusItem[]) => update({ statusLine: items });

export function saveAccount(agent: string, account: string) {
  update({ accounts: { ...loadSettings().accounts, [agent]: account } });
}

export const saveMcpSettings = (mcp: Settings['mcp']) => update({ mcp });

/** The plan limits last seen for each account, so accounts not in use still show how full they were. */
export type SeenLimits = Record<string, { windows: LimitWindow[]; at: number }>;

const limitsFile = () => join(jinionHome(), 'limits.json');

export const limitsKey = (agent: string, account = 'default') => `${agent}/${account}`;

export const loadLimits = () => readJson<SeenLimits>(limitsFile(), {});

export const saveLimits = (limits: SeenLimits) => writeJson(limitsFile(), limits);

/** Choices kept per project, in `~/.jinion/projects/<project>/settings.json`. */
export interface ProjectSettings {
  /** The mode last picked in this project. */
  mode?: AgentMode;
  /** Servers from the project's `.mcp.json` the user turned on. */
  mcp?: { approved?: string[] };
}

const projectFile = (cwd: string) => join(projectDir(cwd), 'settings.json');

export const loadProjectSettings = (cwd: string) => readJson<ProjectSettings>(projectFile(cwd), {});

export const saveProjectSettings = (cwd: string, patch: ProjectSettings) =>
  writeJson(projectFile(cwd), { ...loadProjectSettings(cwd), ...patch });
