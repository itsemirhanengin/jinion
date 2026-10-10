import { atom, useAtomValue } from 'jotai';
import { useEffect } from 'react';
import type { Core } from '../core/core.js';

/** A file to scroll to in a tab of diffs one under another; `at` tells the same file asked for twice apart. */
const revealAtom = atom<{ tab: string; path: string; at: number } | undefined>(undefined);

export function reveal(core: Core, tab: string, path: string) {
  core.client.store.set(revealAtom, { tab, path, at: Date.now() });
}

/** How long after the ask the tab follows the file, while the diffs above it are still being drawn and measured. */
const FOLLOW = 1500;

/** Scrolls the tab to the file asked for, again as diffs are drawn, through its list's own `scrollTo`. */
export function useReveal(tab: string, scrollTo: (path: string) => void, drawn: unknown) {
  const target = useAtomValue(revealAtom);

  useEffect(() => {
    if (target?.tab !== tab || Date.now() - target.at > FOLLOW) return;

    scrollTo(target.path);
  }, [target, tab, drawn]);
}
