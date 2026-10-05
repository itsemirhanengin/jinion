import { atom, createStore } from 'jotai';
import { Core } from '../core/core.js';

/** The app's own store: which project is open. Each project's window reads its core's store instead. */
export const appStore = createStore();

/** The folder open in the window; undefined on the projects screen. */
export const projectAtom = atom<string | undefined>(undefined);

/** The open folder's core once it answered, or why it couldn't open. */
export const coreAtom = atom<Core | { error: string } | undefined>(undefined);

const cores = new Map<string, Promise<Core>>();

/** Goes to the folder's window, opening its core the first time; cores stay while the app runs, so threads go on. */
export async function openProject(path: string) {
  appStore.set(projectAtom, path);
  appStore.set(coreAtom, undefined);

  try {
    const core = await coreFor(path);

    if (appStore.get(projectAtom) === path) appStore.set(coreAtom, core);
  } catch (error) {
    cores.delete(path);
    if (appStore.get(projectAtom) === path) appStore.set(coreAtom, { error: error instanceof Error ? error.message : String(error) });
  }
}

export function closeProject() {
  appStore.set(projectAtom, undefined);
  appStore.set(coreAtom, undefined);
}

function coreFor(path: string) {
  const known = cores.get(path);
  if (known) return known;

  let core: Core | undefined;

  const opening = Core.open(path, {
    notify: (title, body) => {
      if (!document.hasFocus()) new Notification(title, { body });
    },
    fillPrompt: (session, text) => core?.client.store.set(draftsAtom, (drafts) => ({ ...drafts, [session]: text })),
  }).then((opened) => {
    core = opened;

    return opened;
  });

  cores.set(path, opening);

  return opening;
}

window.desktop.onCoreExit(async (path) => {
  const core = await cores.get(path);

  cores.delete(path);
  core?.gone();
});

addEventListener('focus', () => focusCores(true));
addEventListener('blur', () => focusCores(false));

function focusCores(focused: boolean) {
  for (const opening of cores.values()) void opening.then((core) => core.client.focus(focused));
}

// What follows lives in each project's store, so every project keeps its own.

/** What the window's middle shows: the thread in the active tab, or a screen of its own. */
export const viewAtom = atom<'thread' | 'skills' | 'memory' | 'accounts'>('thread');

export const sidebarAtom = atom(true);

export type PanelTab = 'changes' | 'files' | 'tasks';

export const panelAtom = atom({ open: false, tab: 'changes' as PanelTab, width: 480 });

/** Where the panel points in each thread, so it follows the tab shown. */
export const panelFileAtom = atom<Record<string, string | undefined>>({});

/** How many changed files of each thread the user has seen, so the panel's button can mark new ones. */
export const seenChangesAtom = atom<Record<string, number>>({});

/** What is typed in each thread's composer: the app's, as in the terminal app. */
export const draftsAtom = atom<Record<string, string>>({});
