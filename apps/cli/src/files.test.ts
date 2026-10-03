import { describe, expect, it } from 'vitest';
import { fileCompletion } from './files.js';

const FILES = ['apps/', 'apps/cli/', 'README.md', 'apps/cli/src/app.tsx', 'apps/cli/src/main.tsx', 'docs/release notes.md'];

const complete = (value: string) => fileCompletion(FILES)(value, value.length);
const labels = (value: string) => complete(value)?.items.map((item) => item.label);

describe('fileCompletion', () => {
  it('lists the top level for a bare @', () => {
    expect(labels('look at @')).toEqual(['apps/', 'README.md']);
  });

  it('ranks matches in the file name above matches in the path', () => {
    // `apps/cli/` has it in its name, the files below it only in their path.
    expect(labels('@cli')).toEqual(['apps/cli/', 'apps/cli/src/app.tsx', 'apps/cli/src/main.tsx']);
  });

  it('inserts files with a space, folders without, and quotes paths with spaces', () => {
    expect(complete('@apps/cl')!.items[0]).toMatchObject({ label: 'apps/cli/', insert: '@apps/cli/', tag: 'dir' });
    expect(complete('@main')!.items[0]!.insert).toBe('@apps/cli/src/main.tsx ');
    expect(complete('@release')!.items[0]!.insert).toBe('@"docs/release notes.md" ');
  });

  it('leaves out the folder typed so far and ignores emails', () => {
    expect(labels('@apps/cli/')).not.toContain('apps/cli/');
    expect(complete('me@exam')).toBeUndefined();
  });
});
