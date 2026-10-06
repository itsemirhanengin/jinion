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
  /** How two groups sit: side by side, the default, or one above the other. */
  split?: Direction;
  /** The first of two groups' share of the room, from `MIN_SHARE` to `1 - MIN_SHARE`; half by default. */
  share?: number;
  right: Panel;
  bottom: Panel;
}

export type Direction = 'row' | 'column';

/** Where a tab dropped on a group's edge goes, beside the group or above or under it. */
export type Side = 'left' | 'right' | 'top' | 'bottom';

export const MIN_SHARE = 0.2;

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
    return { ...layout, groups: layout.groups.toSpliced(index, 1), focused: 0, split: undefined, share: undefined };
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

/**
 * Moves a tab, as it is dragged, into a group at `index` (at its end without one), shown there and kept for good; a
 * group it leaves empty closes, unless it is the only one.
 */
export function moveTab(layout: Layout, key: string, group: number, index?: number): Layout {
  const from = groupOf(layout, key);
  if (from < 0 || !layout.groups[group] || (from === group && layout.groups[from]!.tabs.length === 1)) return layout;

  const ref = layout.groups[from]!.tabs.find((tab) => keyOf(tab) === key)!;
  const before = layout.groups[from]!.tabs.findIndex((tab) => keyOf(tab) === key);
  const closed = closeTab(layout, key);
  const target = closed.groups.length < layout.groups.length && group > from ? group - 1 : group;
  const at = from === group && index !== undefined && index > before ? index - 1 : index;

  return withGroup({ ...closed, focused: target }, target, (shown) => ({
    tabs: shown.tabs.toSpliced(at ?? shown.tabs.length, 0, ref),
    active: key,
    preview: shown.preview === key ? undefined : shown.preview,
  }));
}

/**
 * Whether a tab dropped on a group's edge can make a split: with one group, when it leaves a tab behind; with two, when
 * it is the only tab of its group, so the two only change places. There are never more than two.
 */
export function canSplit(layout: Layout, key: string) {
  const from = groupOf(layout, key);
  if (from < 0) return false;

  return layout.groups.length === 1 ? layout.groups[0]!.tabs.length > 1 : layout.groups[from]!.tabs.length === 1;
}

/** Puts the tab in a group of its own on `side` of the other, half the room each. */
export function splitTo(layout: Layout, key: string, side: Side): Layout {
  if (!canSplit(layout, key)) return layout;

  const from = groupOf(layout, key);
  const ref = layout.groups[from]!.tabs.find((tab) => keyOf(tab) === key)!;
  const moved: Group = { tabs: [ref], active: key };
  const rest = layout.groups.length === 1 ? closeTab(layout, key).groups[0]! : layout.groups[from === 0 ? 1 : 0]!;
  const first = side === 'left' || side === 'top';

  return {
    ...layout,
    groups: first ? [moved, rest] : [rest, moved],
    focused: first ? 0 : 1,
    split: side === 'left' || side === 'right' ? 'row' : 'column',
    share: 0.5,
  };
}

export function resizeSplit(layout: Layout, share: number): Layout {
  return { ...layout, share: Math.min(1 - MIN_SHARE, Math.max(MIN_SHARE, share)) };
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

function groupOf(layout: Layout, key: string) {
  return layout.groups.findIndex((group) => group.tabs.some((tab) => keyOf(tab) === key));
}

function withGroup(layout: Layout, index: number, change: (group: Group) => Group): Layout {
  return { ...layout, groups: layout.groups.with(index, change(layout.groups[index]!)) };
}
