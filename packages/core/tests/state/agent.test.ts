import { join } from 'node:path';
import { createStore } from 'jotai/vanilla';
import { describe, expect, it } from 'vitest';
import { readJson } from '../../src/lib/json-file.js';
import { seenLimitsAtom } from '../../src/state/agent.js';
import { sandboxEach } from '../support/sandbox.js';

const box = sandboxEach();

describe('seenLimitsAtom', () => {
  it('keeps the limits another Jinion saved after this one loaded them', () => {
    const store = createStore();
    const file = join(box.home, '.jinion', 'limits.json');
    const seen = (at: number) => ({ windows: [], at });

    expect(store.get(seenLimitsAtom)).toEqual({});

    box.write(file, { 'claude:work': seen(1) });
    store.set(seenLimitsAtom, (limits) => ({ ...limits, 'claude:default': seen(2) }));

    expect(readJson(file, {})).toEqual({ 'claude:work': seen(1), 'claude:default': seen(2) });
    expect(store.get(seenLimitsAtom)).toEqual({ 'claude:work': seen(1), 'claude:default': seen(2) });
  });
});
