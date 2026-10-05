import type { Activity, Command, Feature, StatusItem, TabKind, View } from './feature.js';
import * as layouts from './layout.js';
import type { Layout, OpenOptions, Place, TabRef } from './layout.js';

/** One project's window: the features in it and how it is laid out, for `useSyncExternalStore`. */
export class Workbench {
  readonly activities: (Activity & { id: string })[];
  readonly commands: Command[];
  private readonly kinds = new Map<string, TabKind>();
  private readonly views: View[];
  private readonly status: StatusItem[];
  private readonly listeners = new Set<() => void>();
  private layout: Layout;

  constructor(features: Feature[], layout: Layout = layouts.emptyLayout) {
    this.activities = features.flatMap((feature) => (feature.activity ? [{ id: feature.id, ...feature.activity }] : []));
    this.commands = features.flatMap((feature) => feature.commands ?? []);
    this.views = features.flatMap((feature) => feature.views ?? []);
    this.status = features.flatMap((feature) => feature.status ?? []);
    for (const kind of features.flatMap((feature) => feature.tabs ?? [])) this.kinds.set(kind.kind, kind);
    this.layout = layout;
  }

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);

    return () => void this.listeners.delete(listener);
  };

  readonly getLayout = () => this.layout;

  tabKind(kind: string) {
    return this.kinds.get(kind);
  }

  viewsAt(place: Place) {
    return this.views.filter((view) => view.place === place);
  }

  statusAt(side: StatusItem['side']) {
    return this.status.filter((item) => item.side === side);
  }

  open(ref: TabRef, options?: OpenOptions) {
    this.update(layouts.openTab(this.layout, ref, options));
  }

  close(key: string) {
    this.update(layouts.closeTab(this.layout, key));
  }

  closeActive() {
    const tab = layouts.activeTab(this.layout);

    if (tab) this.close(layouts.keyOf(tab));
  }

  pin(key: string) {
    this.update(layouts.pinTab(this.layout, key));
  }

  split(key: string) {
    this.update(layouts.splitTab(this.layout, key));
  }

  focusGroup(group: number) {
    this.update(layouts.focusGroup(this.layout, group));
  }

  /** The activity's sidebar opens or closes; one without a sidebar opens its page. */
  activate(id: string) {
    const activity = this.activities.find((candidate) => candidate.id === id);
    if (!activity) return;

    if (activity.Sidebar) this.update(layouts.toggleActivity(this.layout, id));
    else if (activity.page) this.open(activity.page);
  }

  toggleSidebar() {
    const first = this.activities.find((activity) => activity.Sidebar);

    if (first) this.update(layouts.toggleSidebar(this.layout, first.id));
  }

  togglePanel(place: Place) {
    const layout = this.layout[place].view ? this.layout : layouts.showView(this.layout, place, this.viewsAt(place)[0]?.id ?? '');

    this.update(layout === this.layout ? layouts.togglePanel(layout, place) : layout);
  }

  showView(place: Place, view: string) {
    this.update(layouts.showView(this.layout, place, view));
  }

  resize(part: 'sidebar' | Place, size: number) {
    this.update(layouts.resize(this.layout, part, size));
  }

  private update(layout: Layout) {
    if (layout === this.layout) return;

    this.layout = layout;
    for (const listener of this.listeners) listener();
  }
}
