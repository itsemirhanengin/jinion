import { join } from 'node:path';
import type { ModelSelection } from '@jinion/tui';
import { readJson, writeJson } from './json-file.js';
import { jinionHome } from './paths.js';
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
