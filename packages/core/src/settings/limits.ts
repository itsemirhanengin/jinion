import { join } from 'node:path';
import type { SeenLimits } from '../agent/usage.js';
import { readJson, updateJson } from '../lib/json-file.js';
import { jinionHome } from '../lib/paths.js';

const file = () => join(jinionHome(), 'limits.json');

export const loadLimits = () => readJson<SeenLimits>(file(), {});

export const updateLimits = (change: (seen: SeenLimits) => SeenLimits) => updateJson<SeenLimits>(file(), {}, change);
