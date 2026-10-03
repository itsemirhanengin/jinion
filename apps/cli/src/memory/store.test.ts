import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { sandbox, type Sandbox } from '../test/sandbox.js';
import { MemoryStore } from './store.js';

let box: Sandbox;
beforeEach(() => {
  box = sandbox();
});
afterEach(() => box.restore());

const note = { scope: 'project' as const, type: 'fact' as const, description: 'Use pnpm', content: 'Never npm.' };

describe('MemoryStore', () => {
  it('saves notes as markdown with frontmatter and reads them back', () => {
    const store = new MemoryStore(box.project);
    const saved = store.save({ ...note, title: 'Use pnpm, not npm' });
    expect(saved.id).toBe('use-pnpm-not-npm');
    expect(readFileSync(store.path(saved), 'utf8')).toMatch(/^---\ntitle: Use pnpm, not npm\ndescription: Use pnpm\ntype: fact\n/);
    expect(store.find('project/use-pnpm-not-npm')).toMatchObject({ title: 'Use pnpm, not npm', content: 'Never npm.' });
  });

  it('keeps ids unique in a scope, and updates a note by its id', () => {
    const store = new MemoryStore(box.project);
    store.save({ ...note, title: 'Build' });
    const second = store.save({ ...note, title: 'Build' });
    expect(second.id).toBe('build-2');
    store.save({ ...note, title: 'Build', id: 'build', content: 'Changed.' });
    expect(store.find('project/build')?.content).toBe('Changed.');
    expect(store.list()).toHaveLength(2);
  });

  it('keeps user notes apart from the project’s and forgets them', () => {
    const store = new MemoryStore(box.project);
    store.save({ ...note, scope: 'user', title: 'Answer in Turkish' });
    expect(new MemoryStore(`${box.project}-other`).list().map((memory) => memory.id)).toEqual(['answer-in-turkish']);
    expect(store.remove('user/answer-in-turkish')?.title).toBe('Answer in Turkish');
    expect(store.list()).toEqual([]);
  });
});
