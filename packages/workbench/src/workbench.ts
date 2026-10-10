import type { Activity, Command, Feature, StatusItem, TabKind, View } from './feature.js';
import * as layouts from './layout.js';
import type { Layout, OpenOptions, Place, Side, TabRef } from './layout.js';

/** Everything a project's window keeps: the mode shown, and each mode's own tabs, sidebar and panels. */
export interface WorkbenchState {
  mode: string;
  layouts: Record<string, Layout>;
}

/** One project's window: the features in it and how each of its modes is laid out, for `useSyncExternalStore`. */
export class Workbench {
  readonly activities: (Activity & { id: string })[];
  readonly commands: Command[];
  private readonly kinds = new Map<string, TabKind>();
  private readonly views: View[];
  private readonly status: StatusItem[];
  private readonly listeners = new Set<() => void>();
  private state: WorkbenchState;

  constructor(features: Feature[], state: WorkbenchState) {
    this.activities = features.flatMap((feature) => (feature.activity ? [{ id: feature.id, ...feature.activity }] : []));
    this.commands = features.flatMap((feature) => feature.commands ?? []);
    this.views = features.flatMap((feature) => feature.views ?? []);
    this.status = features.flatMap((feature) => feature.status ?? []);
    for (const kind of features.flatMap((feature) => feature.tabs ?? [])) this.kinds.set(kind.kind, kind);
    this.state = state;
  }

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);

    return () => void this.listeners.delete(listener);
  };

  /** The layout of the mode shown. */
  readonly getLayout = () => this.state.layouts[this.state.mode]!;

  readonly getMode = () => this.state.mode;

  readonly getState = () => this.state;

  setMode(mode: string) {
    if (mode === this.state.mode || !this.state.layouts[mode]) return;

    this.state = { ...this.state, mode };
    this.notify();
  }

  /** The mode after the one shown, back to the first after the last. */
  nextMode() {
    const modes = Object.keys(this.state.layouts);

    this.setMode(modes[(modes.indexOf(this.state.mode) + 1) % modes.length]!);
  }

  /** The activities of the mode's sidebar, in their order. */
  activitiesOf(mode = this.state.mode) {
    return this.activities.filter((activity) => (activity.mode ?? mode) === mode);
  }

  tabKind(kind: string) {
    return this.kinds.get(kind);
  }

  viewsAt(place: Place) {
    return this.views.filter((view) => view.place === place);
  }

  statusAt(side: StatusItem['side']) {
    return this.status.filter((item) => item.side === side);
  }

  /** Opens the tab in its kind's own mode, without showing that mode; in the mode shown for a kind without one. */
  open(ref: TabRef, options?: OpenOptions) {
    this.change(this.kinds.get(ref.kind)?.mode ?? this.state.mode, (layout) => layouts.openTab(layout, ref, options));
  }

  /** Closes the tab as the user does, telling its kind. */
  close(key: string) {
    const tab = this.tabs().find((each) => layouts.keyOf(each) === key);

    this.remove(key);
    if (tab) this.kinds.get(tab.kind)?.onClose?.(tab.id);
  }

  /** Takes the tab away from every mode without telling its kind, as when what it shows is gone already. */
  remove(key: string) {
    for (const mode of Object.keys(this.state.layouts)) this.change(mode, (layout) => layouts.closeTab(layout, key));
  }

  /** The tabs of every mode. */
  tabs() {
    return Object.values(this.state.layouts).flatMap((layout) => layout.groups.flatMap((group) => group.tabs));
  }

  closeActive() {
    const tab = layouts.activeTab(this.getLayout());

    if (tab) this.close(layouts.keyOf(tab));
  }

  pin(key: string) {
    this.update(layouts.pinTab(this.getLayout(), key));
  }

  split(key: string) {
    this.update(layouts.splitTab(this.getLayout(), key));
  }

  moveTab(key: string, group: number, index?: number) {
    this.update(layouts.moveTab(this.getLayout(), key, group, index));
  }

  canSplit(key: string) {
    return layouts.canSplit(this.getLayout(), key);
  }

  splitTo(key: string, side: Side) {
    this.update(layouts.splitTo(this.getLayout(), key, side));
  }

  resizeSplit(share: number) {
    this.update(layouts.resizeSplit(this.getLayout(), share));
  }

  focusGroup(group: number) {
    this.update(layouts.focusGroup(this.getLayout(), group));
  }

  /**
   * The activity's sidebar opens or closes, and its page opens with the sidebar; one without a sidebar opens its page.
   * One of another mode shows that mode first.
   */
  activate(id: string) {
    const activity = this.activities.find((candidate) => candidate.id === id);
    if (!activity) return;

    if (activity.mode) this.setMode(activity.mode);
    if (activity.Sidebar) this.update(layouts.toggleActivity(this.getLayout(), id));
    if (activity.page && (!activity.Sidebar || this.getLayout().activity === id)) this.open(activity.page);
  }

  /** As `activate`, but a sidebar already open stays open, as the row at the sidebar's top wants. */
  show(id: string) {
    if (this.getLayout().activity === id) {
      const page = this.activities.find((candidate) => candidate.id === id)?.page;

      if (page) this.open(page);

      return;
    }

    this.activate(id);
  }

  toggleSidebar() {
    const first = this.activitiesOf().find((activity) => activity.Sidebar);

    if (first) this.update(layouts.toggleSidebar(this.getLayout(), first.id));
  }

  togglePanel(place: Place) {
    const current = this.getLayout();
    const layout = current[place].view ? current : layouts.showView(current, place, this.viewsAt(place)[0]?.id ?? '');

    this.update(layout === current ? layouts.togglePanel(layout, place) : layout);
  }

  showView(place: Place, view: string) {
    this.update(layouts.showView(this.getLayout(), place, view));
  }

  resize(part: 'sidebar' | Place, size: number) {
    this.update(layouts.resize(this.getLayout(), part, size));
  }

  private update(layout: Layout) {
    this.change(this.state.mode, () => layout);
  }

  private change(mode: string, next: (layout: Layout) => Layout) {
    const layout = this.state.layouts[mode];
    if (!layout) return;

    const changed = next(layout);
    if (changed === layout) return;

    this.state = { ...this.state, layouts: { ...this.state.layouts, [mode]: changed } };
    this.notify();
  }

  private notify() {
    for (const listener of this.listeners) listener();
  }
}
