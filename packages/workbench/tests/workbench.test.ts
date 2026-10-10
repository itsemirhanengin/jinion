import { describe, expect, it } from 'vitest';
import type { Feature } from '../src/feature.js';
import { emptyLayout, keyOf } from '../src/layout.js';
import { Workbench } from '../src/workbench.js';

const Nothing = () => null;

const features: Feature[] = [
  {
    id: 'threads',
    activity: { title: 'Threads', icon: null, mode: 'agent', Sidebar: Nothing },
    tabs: [{ kind: 'thread', mode: 'agent', Title: Nothing, Content: Nothing }],
  },
  { id: 'files', activity: { title: 'Files', icon: null, mode: 'code', Sidebar: Nothing }, tabs: [{ kind: 'file', Title: Nothing, Content: Nothing }] },
  { id: 'git', activity: { title: 'Git', icon: null, mode: 'code', Sidebar: Nothing, page: { kind: 'git', id: 'changes' } } },
];

function workbench(mode = 'agent') {
  return new Workbench(features, {
    mode,
    layouts: { agent: { ...emptyLayout, activity: 'threads' }, code: { ...emptyLayout, activity: 'files' } },
  });
}

const keys = (made: Workbench, mode: string) => made.getState().layouts[mode]!.groups.flatMap((group) => group.tabs.map(keyOf));

describe('a workbench with modes', () => {
  it('opens a tab of a kind with a mode in that mode, whatever mode shows', () => {
    const made = workbench('code');

    made.open({ kind: 'thread', id: 'a' });

    expect(keys(made, 'agent')).toEqual(['thread:a']);
    expect(keys(made, 'code')).toEqual([]);
    expect(made.getMode()).toBe('code');
  });

  it('opens a tab of a kind without one in the mode shown', () => {
    const made = workbench('code');

    made.open({ kind: 'file', id: 'a|page.tsx' });
    made.setMode('agent');
    made.open({ kind: 'file', id: 'a|page.tsx' });

    expect(keys(made, 'code')).toEqual(['file:a|page.tsx']);
    expect(keys(made, 'agent')).toEqual(['file:a|page.tsx']);
  });

  it('takes a tab away from every mode', () => {
    const made = workbench('code');

    made.open({ kind: 'file', id: 'a|page.tsx' });
    made.setMode('agent');
    made.open({ kind: 'file', id: 'a|page.tsx' });
    made.remove('file:a|page.tsx');

    expect(made.tabs()).toEqual([]);
  });

  it("shows an activity's mode when it is activated from another", () => {
    const made = workbench('agent');

    made.activate('git');

    expect(made.getMode()).toBe('code');
    expect(made.getLayout().activity).toBe('git');
    expect(keys(made, 'code')).toEqual(['git:changes']);
  });

  it('keeps an open sidebar open when its view is shown again', () => {
    const made = workbench('code');

    made.show('files');

    expect(made.getLayout().activity).toBe('files');
  });

  it('lists only the activities of the mode shown', () => {
    const made = workbench('code');

    expect(made.activitiesOf().map((activity) => activity.id)).toEqual(['files', 'git']);
    expect(made.activitiesOf('agent').map((activity) => activity.id)).toEqual(['threads']);
  });

  it('goes to the next mode and back to the first', () => {
    const made = workbench('agent');

    made.nextMode();
    expect(made.getMode()).toBe('code');

    made.nextMode();
    expect(made.getMode()).toBe('agent');
  });
});
