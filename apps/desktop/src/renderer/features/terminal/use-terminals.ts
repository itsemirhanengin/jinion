import { useAtom, useAtomValue } from 'jotai';
import type { Core } from '../../core/core.js';
import { useCore } from '../../state/session.js';
import { focusedTerminalAtom, terminalGroupsAtom } from '../../state/terminals.js';
import { groupOf, reconcile, splitBeside } from './groups.js';

// The pane gives the real size once it shows; the shell starts at this one meanwhile.
const COLS = 120;

const ROWS = 30;

/** The project's terminals in their groups, the one with the keys, and what the panel does with them. */
export function useTerminals() {
  const core = useCore();
  const terminals = useAtomValue(core.terminalsAtom);
  const stored = useAtomValue(terminalGroupsAtom);
  const [chosen, setFocused] = useAtom(focusedTerminalAtom);

  const groups = reconcile(
    stored,
    terminals.map((terminal) => terminal.id),
  );

  const focused = focusedOf(groups, terminals.map((terminal) => terminal.id), chosen);

  return {
    terminals,
    groups,
    focused,
    shownGroup: groupOf(groups, focused) ?? [],
    focus: setFocused,
    open: () => core.act(openTerminal(core)),
    split: () => core.act(splitTerminal(core)),
    close: (id: string) => core.act(core.closeTerminal(id)),
  };
}

/** A new shell in the folder of the thread in sight, its worktree when it has one, with the keys. */
export async function openTerminal(core: Core) {
  const { store } = core.client;
  const { id } = await core.openTerminal(store.get(core.client.shownAtom), COLS, ROWS);

  store.set(focusedTerminalAtom, id);

  return id;
}

/** A new shell beside the one with the keys, in its group; a first one when there is none. */
export async function splitTerminal(core: Core) {
  const { store } = core.client;

  const read = () => {
    const ids = store.get(core.terminalsAtom).map((terminal) => terminal.id);
    const groups = reconcile(store.get(terminalGroupsAtom), ids);

    return { groups, focused: focusedOf(groups, ids, store.get(focusedTerminalAtom)) };
  };

  const { focused } = read();
  const id = await openTerminal(core);

  if (focused) store.set(terminalGroupsAtom, splitBeside(read().groups, focused, id));
}

/** The one chosen while it is open; otherwise the first of the last group, the newest. */
function focusedOf(groups: string[][], ids: string[], chosen: string | undefined) {
  return chosen !== undefined && ids.includes(chosen) ? chosen : groups.at(-1)?.[0];
}
