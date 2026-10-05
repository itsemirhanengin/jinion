import { atom, createStore } from 'jotai';
import { MockJinion } from '../mock/jinion.js';
import { projects } from '../mock/projects.js';

export const store = createStore();

const instances = new Map<string, MockJinion>();

/** The open project's core, one per project, kept while the app runs as a window per project will keep its own. */
function jinionFor(project: string) {
  const known = instances.get(project);
  if (known) return known;

  const jinion = new MockJinion(store, projects.find(({ id }) => id === project)!);

  jinion.onNotify = notify;
  instances.set(project, jinion);

  return jinion;
}

/** Undefined on the projects screen. */
export const projectAtom = atom<string | undefined>(undefined);

export const jinionAtom = atom((get) => {
  const project = get(projectAtom);

  return project ? jinionFor(project) : undefined;
});

/** What the window's middle shows: the thread in the active tab, or a screen of its own. */
export const viewAtom = atom<'thread' | 'skills' | 'memory'>('thread');

export const sidebarAtom = atom(true);

export type PanelTab = 'changes' | 'files' | 'tasks';

export const panelAtom = atom({ open: false, tab: 'changes' as PanelTab, width: 480 });

/** Where the panel points in each thread, so it follows the tab shown. */
export const panelFileAtom = atom<Record<string, string | undefined>>({});

/** How many changed files of each thread the user has seen, so the panel's button can mark new ones. */
export const seenChangesAtom = atom<Record<string, number>>({});

/** What is typed in each thread's composer: the app's, as in the terminal app. */
export const draftsAtom = atom<Record<string, string>>({});

function notify(title: string, body: string) {
  if (!document.hasFocus()) new Notification(title, { body });
}
