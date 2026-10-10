import { nextMode } from '@jinion/core/agent/modes';
import { StatusIcon } from '@jinion/ui';
import { activeTab, type Feature, type Workbench } from '@jinion/workbench';
import { MessagesSquare } from 'lucide-react';
import type { Core } from '../../core/core.js';
import { statusOf, useCore, useSession } from '../../state/session.js';
import { closeThread, newThread } from './spare.js';
import { ThreadActions, ThreadList, Waiting } from './thread-list.js';
import { ThreadView } from './thread-view.js';

/** The project's threads: all of them in the sidebar, the open ones as tabs. */
export function threads(core: Core): Feature {
  const shown = () => {
    const id = core.client.store.get(core.client.shownAtom);
    const snapshot = id ? core.client.store.get(core.session(id)) : undefined;

    return id && snapshot ? { id, snapshot } : undefined;
  };

  const fresh = (workbench: Workbench) => core.act(newThread(core, workbench));

  return {
    id: 'threads',
    activity: { title: 'Threads', icon: <MessagesSquare />, mode: 'agent', Badge: Waiting, Sidebar: ThreadList, Actions: ThreadActions },
    tabs: [{ kind: 'thread', mode: 'agent', Title: ThreadTitle, Mark: ThreadMark, Content: ThreadView, onClose: (id) => core.act(closeThread(core, id)) }],
    commands: [
      { id: 'thread.new', title: 'New thread', keys: 'mod+n', run: fresh },
      { id: 'thread.new-tab', title: 'New thread', keys: 'mod+t', run: fresh },
      {
        id: 'thread.focus',
        title: 'Go to the composer',
        keys: 'mod+l',
        // In a file's tab, ⌘L asks about the file instead.
        when: (workbench) => activeTab(workbench.getLayout())?.kind !== 'file',
        run: () => document.querySelector<HTMLTextAreaElement>('textarea[name="message"]')?.focus(),
      },
      {
        id: 'thread.mode',
        title: 'Next mode',
        keys: 'shift+tab',
        when: () => shown() !== undefined,
        run: () => {
          const { id, snapshot } = shown()!;
          const modes = core.client.store.get(core.appAtom)?.agents.find((agent) => agent.name === snapshot.fields.agent)?.modes ?? [];

          if (modes.length > 0) core.act(core.setMode(id, nextMode(modes, snapshot.fields.mode)));
        },
      },
      {
        id: 'thread.stop',
        title: 'Stop the turn',
        keys: 'escape',
        // Escape closes the composer's completions or an image open over the window first, which run after this listener;
        // in another tab, such as a plan being changed, it belongs to that tab, and in a field, such as the threads' search, to the field.
        when: (workbench) =>
          activeTab(workbench.getLayout())?.kind === 'thread' &&
          shown()?.snapshot.fields.working === true &&
          document.activeElement?.getAttribute('aria-expanded') !== 'true' &&
          !(document.activeElement instanceof HTMLInputElement) &&
          !document.querySelector('[role="dialog"]'),
        run: () => core.act(core.interrupt(shown()!.id)),
      },
    ],
  };
}

function ThreadTitle({ id }: { id: string }) {
  const core = useCore();
  const snapshot = useSession(core, id);

  return snapshot?.state.title ?? 'New thread';
}

function ThreadMark({ id }: { id: string }) {
  const core = useCore();
  const snapshot = useSession(core, id);
  const status = snapshot && statusOf(snapshot);

  return status === 'working' || status === 'waiting' ? <StatusIcon status={status} /> : null;
}
