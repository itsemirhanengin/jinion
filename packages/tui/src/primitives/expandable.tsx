import type { ReactNode } from 'react';
import { useView, ViewItem } from '../runtime/view.js';
import { Clickable } from './clickable.js';
import { useScrollArea } from './scroll-view.js';

export interface ExpandableProps {
  /** Stable and unique in the view, so the item stays open after scrolling out and back. */
  id: string;
  fit?: boolean;
  children: ReactNode;
}

export function Expandable({ id, fit = false, children }: ExpandableProps) {
  const area = useScrollArea();
  const { expanded, items, setItem } = useView();
  // Whether it is open is read on the click: opening it draws again only what is inside, not this.
  const toggle = () => {
    area?.hold();
    setItem(id, !(items.get(id) ?? expanded));
  };

  return (
    <Clickable id={id} onClick={toggle} fit={fit}>
      <ViewItem id={id}>{children}</ViewItem>
    </Clickable>
  );
}
