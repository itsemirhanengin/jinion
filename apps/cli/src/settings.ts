import { join } from 'node:path';
import type { ModelSelection } from '@jinion/tui';
import { readJson, writeJson } from './json-file.js';
import { jinionHome, projectDir } from './paths.js';
import type { AgentMode } from './agent/types.js';
import type { StatusItem } from './status/line.js';

/** Choices that carry over between runs, in `~/.jinion/settings.json`. */
export interface Settings {
  /** The last model picked for each agent, keyed by `Agent.name`. */
  models?: Record<string, ModelSelection>;
  /** What the status line shows, from `/statusline`. */
  statusLine?: StatusItem[];
}

const file = () => join(jinionHome(), 'settings.json');

export const loadSettings = () => readJson<Settings>(file(), {});

const update = (patch: Settings) => writeJson(file(), { ...loadSettings(), ...patch });

export function saveModel(agent: string, selection: ModelSelection) {
  update({ models: { ...loadSettings().models, [agent]: selection } });
}

export const saveStatusLine = (items: StatusItem[]) => update({ statusLine: items });

/** Choices kept per project, in `~/.jinion/projects/<project>/settings.json`. */
export interface ProjectSettings {
  /** The mode last picked in this project. */
  mode?: AgentMode;
}

const projectFile = (cwd: string) => join(projectDir(cwd), 'settings.json');

export const loadProjectSettings = (cwd: string) => readJson<ProjectSettings>(projectFile(cwd), {});

export const saveProjectSettings = (cwd: string, patch: ProjectSettings) =>
  writeJson(projectFile(cwd), { ...loadProjectSettings(cwd), ...patch });
