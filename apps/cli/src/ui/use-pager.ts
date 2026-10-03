import { useState } from 'react';
import { useWindowSize, type Key, type KeyHint } from '@jinion/tui';

export interface PagerOptions {
  chrome: number;
  follow?: boolean;
}

export const PAGER_HINTS: KeyHint[] = [
  ['Up/Down', 'scroll'],
  ['PgUp/PgDn', 'page'],
];

export function usePager(lines: number, { chrome, follow = false }: PagerOptions) {
  const { rows } = useWindowSize();

  // `undefined` follows the end.
  const [top, setTop] = useState<number | undefined>(follow ? undefined : 0);

  const view = Math.max(3, rows - chrome);
  const last = Math.max(0, lines - view);
  const shown = Math.min(top ?? last, last);
  const range = lines > view ? `lines ${shown + 1}-${Math.min(lines, shown + view)} of ${lines}` : undefined;

  const scroll = (key: Key) => {
    const step = key.pageDown ? view : key.pageUp ? -view : key.downArrow ? 1 : key.upArrow ? -1 : 0;
    if (!step) return false;

    const next = Math.min(last, Math.max(0, shown + step));

    setTop(follow && next >= last ? undefined : next);

    return true;
  };

  return { top: shown, view, scroll, range };
}
