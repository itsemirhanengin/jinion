export interface TabRef {
  kind: string;
  id: string;
}

export interface Group {
  tabs: TabRef[];
  active?: string;
  /** The tab a single click opened, which the next single click replaces. */
  preview?: string;
}

export type Place = 'right' | 'bottom';

export interface Panel {
  open: boolean;
  view?: string;
  size: number;
}

/** Everything a project remembers of its window, so it can be saved as it is. */
export interface Layout {
  /** The activity whose sidebar is open, none when the sidebar is closed. */
  activity?: string;
  lastActivity?: string;
  sidebarWidth: number;
  groups: Group[];
  focused: number;
  right: Panel;
  bottom: Panel;
}

export interface OpenOptions {
  preview?: boolean;
  group?: number;
}

export const MAX_GROUPS = 2;

export const emptyLayout: Layout = {
  sidebarWidth: 260,
  groups: [{ tabs: [] }],
  focused: 0,
  right: { open: false, size: 380 },
  bottom: { open: false, size: 240 },
};

export function keyOf(ref: TabRef) {
  return `${ref.kind}:${ref.id}`;
}

export function activeTab(layout: Layout, group = layout.focused) {
  const shown = layout.groups[group];

  return shown?.tabs.find((tab) => keyOf(tab) === shown.active);
}

export function openTab(layout: Layout, ref: TabRef, { preview = false, group }: OpenOptions = {}): Layout {
  const key = keyOf(ref);
  const found = layout.groups.findIndex((candidate) => candidate.tabs.some((tab) => keyOf(tab) === key));

  if (found >= 0) {
    return withGroup({ ...layout, focused: found }, found, (shown) => ({
      ...shown,
      active: key,
      preview: !preview && shown.preview === key ? undefined : shown.preview,
    }));
  }

  const target = Math.min(group ?? layout.focused, layout.groups.length, MAX_GROUPS - 1);
  const groups = target === layout.groups.length ? [...layout.groups, { tabs: [] }] : layout.groups;

  return withGroup({ ...layout, groups, focused: target }, target, (shown) => {
    const replaced = preview ? shown.tabs.findIndex((tab) => keyOf(tab) === shown.preview) : -1;

    if (replaced >= 0) return { tabs: shown.tabs.with(replaced, ref), active: key, preview: key };

    const after = shown.tabs.findIndex((tab) => keyOf(tab) === shown.active);
    const tabs = shown.tabs.toSpliced(after + 1, 0, ref);

    return { tabs, active: key, preview: preview ? key : shown.preview };
  });
}

export function closeTab(layout: Layout, key: string): Layout {
  const index = layout.groups.findIndex((group) => group.tabs.some((tab) => keyOf(tab) === key));
  if (index < 0) return layout;

  const shown = layout.groups[index]!;
  const at = shown.tabs.findIndex((tab) => keyOf(tab) === key);
  const tabs = shown.tabs.toSpliced(at, 1);

  if (tabs.length === 0 && layout.groups.length > 1) {
    return { ...layout, groups: layout.groups.toSpliced(index, 1), focused: 0 };
  }

  const next = tabs[at] ?? tabs[at - 1];
  const active = shown.active === key ? next && keyOf(next) : shown.active;

  return withGroup(layout, index, () => ({ tabs, active, preview: shown.preview === key ? undefined : shown.preview }));
}

export function pinTab(layout: Layout, key: string): Layout {
  const index = layout.groups.findIndex((group) => group.preview === key);
  if (index < 0) return layout;

  return withGroup(layout, index, (shown) => ({ ...shown, preview: undefined }));
}

/** Moves the tab to the other group, opening one beside the first when there is only one. */
export function splitTab(layout: Layout, key: string): Layout {
  const index = layout.groups.findIndex((group) => group.tabs.some((tab) => keyOf(tab) === key));
  if (index < 0) return layout;

  const ref = layout.groups[index]!.tabs.find((tab) => keyOf(tab) === key)!;
  const other = index === 0 ? 1 : 0;

  if (layout.groups.length === 1 && layout.groups[0]!.tabs.length === 1) return layout;

  const closed = closeTab(layout, key);
  const target = closed.groups.length < layout.groups.length ? 0 : other;

  return openTab(closed, ref, { group: target });
}

export function focusGroup(layout: Layout, group: number): Layout {
  if (group === layout.focused || !layout.groups[group]) return layout;

  return { ...layout, focused: group };
}

export function toggleActivity(layout: Layout, activity: string): Layout {
  if (layout.activity === activity) return { ...layout, activity: undefined };

  return { ...layout, activity, lastActivity: activity };
}

export function toggleSidebar(layout: Layout, fallback: string): Layout {
  if (layout.activity) return { ...layout, activity: undefined };

  return { ...layout, activity: layout.lastActivity ?? fallback };
}

export function togglePanel(layout: Layout, place: Place): Layout {
  return { ...layout, [place]: { ...layout[place], open: !layout[place].open } };
}

export function showView(layout: Layout, place: Place, view: string): Layout {
  return { ...layout, [place]: { ...layout[place], open: true, view } };
}

export function resize(layout: Layout, part: 'sidebar' | Place, size: number): Layout {
  if (part === 'sidebar') return { ...layout, sidebarWidth: size };

  return { ...layout, [part]: { ...layout[part], size } };
}

function withGroup(layout: Layout, index: number, change: (group: Group) => Group): Layout {
  return { ...layout, groups: layout.groups.with(index, change(layout.groups[index]!)) };
}
