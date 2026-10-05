import { atom, createStore } from 'jotai';
import { Core } from '../core/core.js';
import { saveProjects, savedProjects } from './saved.js';

/** The app's own store: which projects are open as tabs, and the one shown. Each project's window reads its core's store. */
export const appStore = createStore();

/** The folders open as tabs along the top, in their order. */
export const projectsAtom = atom<string[]>([]);

/** The folder shown; undefined on the projects screen. */
export const projectAtom = atom<string | undefined>(undefined);

/** The shown folder's core once it answered, or why it couldn't open. */
export const coreAtom = atom<Core | { error: string } | undefined>(undefined);

/** Every core that answered, by its folder, so each project's tab can show whether a thread there works or waits. */
export const coresAtom = atom<Record<string, Core>>({});

const cores = new Map<string, Promise<Core>>();

/** Opens the folder as a tab, or goes to its tab, starting its core the first time; cores stay while the app runs. */
export async function openProject(path: string) {
  appStore.set(projectsAtom, (open) => (open.includes(path) ? open : [...open, path]));
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

/** Closes the project's tab and shows the one beside it, or the projects screen after the last. */
export function closeProject(path: string) {
  const open = appStore.get(projectsAtom);
  const index = open.indexOf(path);
  const rest = open.filter((each) => each !== path);

  appStore.set(projectsAtom, rest);
  if (appStore.get(projectAtom) !== path) return;

  const next = rest[index] ?? rest[index - 1];

  if (next) void openProject(next);
  else showProjects();
}

export function showProjects() {
  appStore.set(projectAtom, undefined);
  appStore.set(coreAtom, undefined);
}

export function moveProject(from: number, to: number) {
  appStore.set(projectsAtom, (open) => {
    const next = [...open];
    const [path] = next.splice(from, 1);

    next.splice(to, 0, path!);

    return next;
  });
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
    appStore.set(coresAtom, (all) => ({ ...all, [path]: opened }));

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

/** What is typed in each thread's composer: the app's, as in the terminal app; in each project's store. */
export const draftsAtom = atom<Record<string, string>>({});

// The project tabs come back as they were left; only the one shown starts its core, the others when picked.
const saved = savedProjects();

appStore.set(projectsAtom, saved.open);
if (saved.shown) void openProject(saved.shown);

for (const each of [projectsAtom, projectAtom]) {
  appStore.sub(each, () => saveProjects({ open: appStore.get(projectsAtom), shown: appStore.get(projectAtom) }));
}
