import { join } from 'node:path';
import type { AgentMode } from '../agent/agent.js';
import { readJson, updateJson } from '../lib/json-file.js';
import { projectDir } from '../lib/paths.js';
import { loadSettings } from './user.js';

export interface ProjectSettings {
  mode?: AgentMode;
  mcp?: { approved?: string[] };
  askBeforeCommits?: boolean;
}

const file = (cwd: string) => join(projectDir(cwd), 'settings.json');

export const loadProjectSettings = (cwd: string) => readJson<ProjectSettings>(file(cwd), {});

/** `patch` gets the project's settings on disk and returns the keys to change. */
export const updateProjectSettings = (cwd: string, patch: (current: ProjectSettings) => ProjectSettings) =>
  updateJson<ProjectSettings>(file(cwd), {}, (current) => ({ ...current, ...patch(current) }));

export const saveProjectSettings = (cwd: string, patch: ProjectSettings) => updateProjectSettings(cwd, () => patch);

export const asksBeforeCommits = (cwd: string) => loadProjectSettings(cwd).askBeforeCommits ?? loadSettings().askBeforeCommits ?? true;
