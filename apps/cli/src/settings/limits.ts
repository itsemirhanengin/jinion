import { join } from 'node:path';
import type { LimitWindow } from '../agent/usage.js';
import { readJson, writeJson } from '../lib/json-file.js';
import { jinionHome } from '../lib/paths.js';

/** Kept per account, so `/account` can show how full the plans not in use were when last seen. */
export type SeenLimits = Record<string, SeenLimit>;

export interface SeenLimit {
  windows: LimitWindow[];
  at: number;
}

const file = () => join(jinionHome(), 'limits.json');

export const limitsKey = (agent: string, account = 'default') => `${agent}/${account}`;

export const loadLimits = () => readJson<SeenLimits>(file(), {});

export const saveLimits = (limits: SeenLimits) => writeJson(file(), limits);
