import { atom, useAtomValue } from 'jotai';
import { type RefObject, useEffect } from 'react';
import type { Core } from '../core/core.js';

/** A file to scroll to in a tab of diffs one under another; `at` tells the same file asked for twice apart. */
const revealAtom = atom<{ tab: string; path: string; at: number } | undefined>(undefined);

export function reveal(core: Core, tab: string, path: string) {
  core.client.store.set(revealAtom, { tab, path, at: Date.now() });
}

/** How long after the ask the tab follows the file, while the diffs above it are still being drawn. */
const FOLLOW = 1500;

/** Scrolls the tab to the file asked for, again as diffs are drawn; each file's diff carries its path as `data-path`. */
export function useReveal(tab: string, list: RefObject<HTMLElement | null>, drawn: unknown) {
  const target = useAtomValue(revealAtom);

  useEffect(() => {
    if (target?.tab !== tab || Date.now() - target.at > FOLLOW) return;

    list.current?.querySelector(`[data-path="${CSS.escape(target.path)}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [target, tab, list, drawn]);
}
