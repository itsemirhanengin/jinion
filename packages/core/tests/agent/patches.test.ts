import { describe, expect, it } from 'vitest';
import { addPatch, hunksToPatch, replacePatch } from '../../src/agent/patches.js';

describe('patches', () => {
  it('previews a replacement and a new file', () => {
    expect(replacePatch('a\nb\n', 'c')).toBe('@@ -1,2 +1,1 @@\n-a\n-b\n+c');
    expect(addPatch('one\ntwo\n')).toBe('@@ -0,0 +1,2 @@\n+one\n+two');
    expect(addPatch('')).toBe('@@ -0,0 +1,0 @@');
  });

  it('joins the hunks Claude Code reports', () => {
    expect(hunksToPatch([{ oldStart: 3, oldLines: 1, newStart: 3, newLines: 1, lines: ['-a', '+b'] }])).toBe('@@ -3,1 +3,1 @@\n-a\n+b');
  });
});
