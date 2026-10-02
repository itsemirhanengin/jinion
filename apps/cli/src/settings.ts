import { join } from 'node:path';
import type { ModelSelection } from '@jinion/tui';
import { readJson, writeJson } from './json-file.js';
import { jinionHome } from './paths.js';

/** Choices that carry over between runs, in `~/.jinion/settings.json`. */
export interface Settings {
  /** The last model picked for each agent, keyed by `Agent.name`. */
  models?: Record<string, ModelSelection>;
}

const file = () => join(jinionHome(), 'settings.json');

export const loadSettings = () => readJson<Settings>(file(), {});

export function saveModel(agent: string, selection: ModelSelection) {
  const settings = loadSettings();
  writeJson(file(), { ...settings, models: { ...settings.models, [agent]: selection } });
}
