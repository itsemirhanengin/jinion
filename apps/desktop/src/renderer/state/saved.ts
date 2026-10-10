import { emptyLayout, type Layout, type WorkbenchState } from '@jinion/workbench';

/** What the window remembers between launches, in the page's own storage: the open projects and each one's layout. */
interface SavedProjects {
  open: string[];
  shown?: string;
}

const PROJECTS = 'jinion.projects';
/** A window as it was before it had modes, only read: an app of before, sharing this storage, still writes it. */
const LAYOUT = 'jinion.layout:';
const WORKBENCH = 'jinion.workbench:';
const PREVIEWS = 'jinion.previews:';
const ACCENT = 'jinion.accent';
const SEEN = 'jinion.seen:';

/** When the user last had the project's window in front of them. */
export function savedSeen(path: string) {
  return Number(localStorage.getItem(SEEN + path)) || undefined;
}

export function saveSeen(path: string, at = Date.now()) {
  localStorage.setItem(SEEN + path, String(at));
}

export function savedAccent() {
  return localStorage.getItem(ACCENT) ?? undefined;
}

export function saveAccent(accent: string) {
  localStorage.setItem(ACCENT, accent);
}

/** Tabs that belong to the project rather than to a session, and come back as they were. */
const KEPT = new Set(['page', 'git', 'preview']);

export function savedProjects(): SavedProjects {
  return read<SavedProjects>(PROJECTS) ?? { open: [] };
}

export function saveProjects(projects: SavedProjects) {
  localStorage.setItem(PROJECTS, JSON.stringify(projects));
}

/**
 * The project's window as it was left, each mode with only its pages, the git tab and its previews: a thread's, its
 * changes' or a file's tab belongs to a session that may have closed since, and the sessions still open come back as tabs
 * by themselves. A window saved before it had modes comes back as its Agent mode.
 */
export function savedWorkbench(path: string): Partial<WorkbenchState> | undefined {
  const saved = read<WorkbenchState>(WORKBENCH + path);
  const before = read<Layout>(LAYOUT + path);

  if (saved) return { mode: saved.mode, layouts: Object.fromEntries(Object.entries(saved.layouts).map(([mode, layout]) => [mode, kept(layout)])) };

  // Other versions of the app share this storage, so what is under the old key is only a layout if it looks like one.
  if (before && Array.isArray(before.groups)) return { layouts: { agent: { ...kept(before), activity: 'threads', lastActivity: 'threads' } } };

  return undefined;
}

export function saveWorkbench(path: string, state: WorkbenchState) {
  localStorage.setItem(WORKBENCH + path, JSON.stringify(state));
}

function kept(layout: Layout): Layout {
  const groups = layout.groups
    .map((group) => {
      const tabs = group.tabs.filter((tab) => KEPT.has(tab.kind));
      const kept = (key?: string) => (key && tabs.some((tab) => `${tab.kind}:${tab.id}` === key) ? key : undefined);

      return { tabs, active: kept(group.active) ?? (tabs[0] && `${tabs[0].kind}:${tabs[0].id}`), preview: kept(group.preview) };
    })
    .filter((group, index) => index === 0 || group.tabs.length > 0);

  return { ...emptyLayout, ...layout, groups, focused: Math.min(layout.focused, groups.length - 1) };
}

/** Each preview tab's address, by the tab's id. */
export function savedPreviews(path: string) {
  return read<Record<string, string>>(PREVIEWS + path) ?? {};
}

export function savePreviews(path: string, urls: Record<string, string>) {
  localStorage.setItem(PREVIEWS + path, JSON.stringify(urls));
}

function read<T>(key: string) {
  try {
    const text = localStorage.getItem(key);

    return text ? (JSON.parse(text) as T) : undefined;
  } catch {
    return undefined;
  }
}
