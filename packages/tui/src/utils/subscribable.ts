/** For `useSyncExternalStore`: a change redraws only the components whose part changed, not everything under a context. */
export class Subscribable {
  private readonly listeners = new Set<() => void>();

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  };

  protected changed() {
    for (const listener of this.listeners) listener();
  }
}
