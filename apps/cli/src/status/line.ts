import type { ReactNode } from 'react';
import type { StatusItem } from '../settings/user.js';
import type { StatusData } from './segment.js';
import { findSegment } from './segments/index.js';

export const DEFAULT_STATUS_LINE: StatusItem[] = [
  { id: 'brand', side: 'left' },
  { id: 'model', side: 'left' },
  { id: 'directory', side: 'left' },
  { id: 'worktree', side: 'left' },
  { id: 'context', side: 'left' },
  { id: 'cost', side: 'left' },
  { id: 'title', side: 'right' },
];

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

export const styleOf = (item: StatusItem) => item.style ?? findSegment(item.id)?.styles?.[0]?.id ?? '';

/** Settings can name segments a later version dropped. */
export const knownItems = (items: StatusItem[]) => items.filter((item) => findSegment(item.id));
