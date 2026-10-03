import type { ReactNode } from 'react';
import type { StatusData } from './segment.js';
import { findSegment } from './segments/index.js';

export type StatusSide = 'left' | 'right';

export interface StatusItem {
  id: string;
  side: StatusSide;
  style?: string;
}

export const DEFAULT_STATUS_LINE: StatusItem[] = [
  { id: 'brand', side: 'left' },
  { id: 'model', side: 'left' },
  { id: 'directory', side: 'left' },
  { id: 'context', side: 'left' },
  { id: 'cost', side: 'left' },
  { id: 'title', side: 'right' },
];

export const styleOf = (item: StatusItem) => item.style ?? findSegment(item.id)?.styles?.[0]?.id ?? '';

export function renderStatusLine(items: StatusItem[], data: StatusData) {
  const left: ReactNode[] = [];
  const right: ReactNode[] = [];
  for (const item of items) {
    const node = findSegment(item.id)?.render(data, styleOf(item));
    if (node === undefined || node === null || node === false || node === '') continue;
    (item.side === 'right' ? right : left).push(node);
  }
  return { left, right };
}

/** Settings can name segments a later version dropped. */
export const knownItems = (items: StatusItem[]) => items.filter((item) => findSegment(item.id));
