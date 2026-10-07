import { emptyLayout, type Layout } from '@jinion/workbench';

/** What the window remembers between launches, in the page's own storage: the open projects and each one's layout. */
interface SavedProjects {
  open: string[];
  shown?: string;
}

const PROJECTS = 'jinion.projects';
const LAYOUT = 'jinion.layout:';
const PREVIEWS = 'jinion.previews:';

/** Tabs that belong to the project rather than to a session, and come back as they were. */
const KEPT = new Set(['page', 'git', 'preview']);

export function savedProjects(): SavedProjects {
  return read<SavedProjects>(PROJECTS) ?? { open: [] };
}

export function saveProjects(projects: SavedProjects) {
  localStorage.setItem(PROJECTS, JSON.stringify(projects));
}

/**
 * The project's layout as it was left, with only its pages, the git tab and its previews: a thread's, its changes' or a
 * file's tab belongs to a session that may have closed since, and the sessions still open come back as tabs by themselves.
 */
export function savedLayout(path: string): Layout | undefined {
  const layout = read<Layout>(LAYOUT + path);
  if (!layout) return undefined;

  const groups = layout.groups
    .map((group) => {
      const tabs = group.tabs.filter((tab) => KEPT.has(tab.kind));
      const kept = (key?: string) => (key && tabs.some((tab) => `${tab.kind}:${tab.id}` === key) ? key : undefined);

      return { tabs, active: kept(group.active) ?? (tabs[0] && `${tabs[0].kind}:${tabs[0].id}`), preview: kept(group.preview) };
    })
    .filter((group, index) => index === 0 || group.tabs.length > 0);

  return { ...emptyLayout, ...layout, groups, focused: Math.min(layout.focused, groups.length - 1) };
}

export function saveLayout(path: string, layout: Layout) {
  localStorage.setItem(LAYOUT + path, JSON.stringify(layout));
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
