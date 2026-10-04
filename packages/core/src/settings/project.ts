import { join } from 'node:path';
import type { AgentMode } from '../agent/agent.js';
import { readJson, writeJson } from '../lib/json-file.js';
import { projectDir } from '../lib/paths.js';
import { loadSettings } from './user.js';

export interface ProjectSettings {
  mode?: AgentMode;
  mcp?: { approved?: string[] };
  askBeforeCommits?: boolean;
}

const file = (cwd: string) => join(projectDir(cwd), 'settings.json');

export const loadProjectSettings = (cwd: string) => readJson<ProjectSettings>(file(cwd), {});

export const saveProjectSettings = (cwd: string, patch: ProjectSettings) =>
  writeJson(file(cwd), { ...loadProjectSettings(cwd), ...patch });

export const asksBeforeCommits = (cwd: string) => loadProjectSettings(cwd).askBeforeCommits ?? loadSettings().askBeforeCommits ?? true;
