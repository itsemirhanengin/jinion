import { useSyncExternalStore } from 'react';
import { Subscribable } from '../utils/subscribable.js';

/** Kept outside React, so a pointer move redraws only what it left and what it came onto. */
export class Hover extends Subscribable {
  private id: string | undefined;

  readonly current = () => this.id;

  set(id: string | undefined) {
    if (id === this.id) return;
    this.id = id;
    this.changed();
  }
}

const NEVER = () => () => {};

export const useHoveredId = (hover: Hover | undefined) => useSyncExternalStore(hover?.subscribe ?? NEVER, () => hover?.current());

export const useIsHovered = (hover: Hover | undefined, id: string) =>
  useSyncExternalStore(hover?.subscribe ?? NEVER, () => hover !== undefined && hover.current() === id);
