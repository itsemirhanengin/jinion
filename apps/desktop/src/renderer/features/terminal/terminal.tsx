import { IconButton, type Feature, useWorkbench, type Workbench } from '@jinion/workbench';
import { Columns2, Plus } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { Core } from '../../core/core.js';
import { useCore } from '../../state/session.js';
import { focusedTerminalAtom } from '../../state/terminals.js';
import { TerminalList } from './list.js';
import { TerminalPane } from './pane.js';
import { openTerminal, splitTerminal, useTerminals } from './use-terminals.js';

/** The project's terminals in the bottom panel: shells and what the agent started, which every thread shares. */
export function terminal(core: Core): Feature {
  return {
    id: 'terminal',
    views: [{ id: 'terminal', title: 'Terminal', place: 'bottom', Content: TerminalView, Actions }],
    commands: [
      {
        id: 'terminal.split',
        title: 'Split the terminal',
        keys: 'mod+\\',
        // Only with the keys in a terminal; elsewhere the same keys split the tab.
        when: () => document.activeElement?.closest('[data-terminal-pane]') != null,
        run: () => core.act(splitTerminal(core)),
      },
    ],
  };
}

/** Shows the panel on a terminal the agent starts, so the user sees what it runs; the keys stay where they were. */
export function followAgentTerminals(core: Core, workbench: Workbench) {
  const { store } = core.client;
  const known = new Set(store.get(core.terminalsAtom).map((terminal) => terminal.id));

  store.sub(core.terminalsAtom, () => {
    for (const terminal of store.get(core.terminalsAtom)) {
      if (known.has(terminal.id)) continue;

      known.add(terminal.id);
      if (!terminal.agent) continue;

      store.set(focusedTerminalAtom, terminal.id);
      workbench.showView('bottom', 'terminal');
    }
  });
}

function TerminalView() {
  const core = useCore();
  const workbench = useWorkbench();
  const { terminals, groups, focused, shownGroup, focus, close } = useTerminals();

  const had = useRef(false);
  const opening = useRef(false);

  const byId = new Map(terminals.map((terminal) => [terminal.id, terminal]));

  // Shown with none, the panel opens a shell at once; once the last one goes, closed or exited, the panel closes with it.
  useEffect(() => {
    if (terminals.length > 0) {
      had.current = true;

      return;
    }

    if (had.current) return workbench.togglePanel('bottom');
    if (opening.current) return;

    opening.current = true;
    core.act(openTerminal(core).finally(() => (opening.current = false)));
  }, [terminals.length]);

  if (terminals.length === 0) return null;

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1">
        {shownGroup.map((id, index) => {
          const terminal = byId.get(id);
          if (!terminal) return null;

          return (
            <div key={id} className={index > 0 ? 'flex min-w-0 flex-1 border-l border-line' : 'flex min-w-0 flex-1'}>
              <TerminalPane terminal={terminal} focused={id === focused} split={shownGroup.length > 1} onFocus={() => focus(id)} onClose={() => close(id)} />
            </div>
          );
        })}
      </div>
      <TerminalList terminals={terminals} groups={groups} focused={focused} onFocus={focus} onClose={close} />
    </div>
  );
}

function Actions() {
  const { open, split, focused } = useTerminals();

  return (
    <>
      <IconButton label="New terminal" onClick={open}>
        <Plus />
      </IconButton>
      {focused && (
        <IconButton label="Split the terminal (⌘\)" onClick={split}>
          <Columns2 />
        </IconButton>
      )}
    </>
  );
}
