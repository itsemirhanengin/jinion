import type { ReactNode } from 'react';
import { useView, ViewItem } from '../runtime/context.js';
import { Clickable } from './clickable.js';
import { useScrollArea } from './scroll-view.js';

export interface ExpandableProps {
  /** Stable across renders and unique in the view, so the item stays open after it scrolls out of view and back. */
  id: string;
  /** As wide as its content, so a line lights up only as far as its text goes, rather than the full width. */
  fit?: boolean;
  children: ReactNode;
}

/**
 * Something that opens and closes on its own with a click, such as a command's output: what is inside reads
 * `useView().expanded` as set for it. It lights up under the pointer like any `Clickable`. ctrl+o still opens or closes
 * everything at once.
 */
export function Expandable({ id, fit = false, children }: ExpandableProps) {
  const area = useScrollArea();
  const { expanded, items, setItem } = useView();
  const open = items.get(id) ?? expanded;
  const toggle = () => {
    area?.hold();
    setItem(id, !open);
  };

  return (
    <Clickable id={id} onClick={toggle} fit={fit}>
      <ViewItem id={id}>{children}</ViewItem>
    </Clickable>
  );
}
