import { describe, expect, it } from 'vitest';
import { commitApproval } from '../../src/commands/commit-approval.js';
import type { Jinion } from '../../src/controllers/jinion.js';
import { asksBeforeCommits, loadProjectSettings } from '../../src/settings/project.js';
import { sandboxEach } from '../support/sandbox.js';

const box = sandboxEach();

function run(args: string) {
  const notices: string[] = [];
  const jinion = { info: { cwd: box.project }, notice: (text: string) => notices.push(text) } as unknown as Jinion;

  commitApproval.run(jinion, args);

  return notices;
}

describe('/commit-approval', () => {
  it('asks by default, and turns off for this project alone', () => {
    expect(asksBeforeCommits(box.project)).toBe(true);

    run('off');

    expect(asksBeforeCommits(box.project)).toBe(false);
    expect(asksBeforeCommits(`${box.project}-other`)).toBe(true);
  });

  it('sets every project with global, where this project’s own setting gives way', () => {
    run('on');
    run('off global');

    expect(asksBeforeCommits(box.project)).toBe(false);
    expect(asksBeforeCommits(`${box.project}-other`)).toBe(false);
    expect(loadProjectSettings(box.project).askBeforeCommits).toBeUndefined();
  });

  it('lets a project keep asking when the global setting is off', () => {
    run('off global');
    run('on');

    expect(asksBeforeCommits(box.project)).toBe(true);
    expect(asksBeforeCommits(`${box.project}-other`)).toBe(false);
  });

  it('toggles without an argument, and says how to type it otherwise', () => {
    run('');
    expect(asksBeforeCommits(box.project)).toBe(false);

    run('');
    expect(asksBeforeCommits(box.project)).toBe(true);

    expect(run('maybe')[0]).toMatch(/^Type \/commit-approval on/);
  });
});
