import { keyOf, type TabRef, type Workbench } from '@jinion/workbench';

/**
 * A tab beside the thread, in the other group, or in a new one on the right with `share` of the room left to the thread;
 * the keys stay with the thread.
 */
export function openBesideThread(workbench: Workbench, tab: TabRef, session: string | undefined, share: number) {
  const thread = `thread:${session}`;
  const threadGroup = () => workbench.getLayout().groups.findIndex((group) => group.tabs.some((each) => keyOf(each) === thread));

  if (workbench.getLayout().groups.length > 1) {
    workbench.open(tab, { group: threadGroup() === 0 ? 1 : 0 });
  } else {
    workbench.open(tab);
    workbench.splitTo(keyOf(tab), 'right');
    workbench.resizeSplit(share);
  }

  workbench.focusGroup(Math.max(0, threadGroup()));
}
