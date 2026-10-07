import { atom } from 'jotai';
import type { PreviewPick, PreviewState } from '../../main/bridge.js';

/** An element or an area picked on the page, waiting in a thread's composer. */
export interface DraftPick {
  /** The chip in the draft that stands for it, as `PricingCard button` or `Area 1`. */
  name: string;
  pick: PreviewPick;
}

/** The picks put in each thread's composer, sent with its next message if their name is still in it. */
export const draftPicksAtom = atom<Record<string, DraftPick[]>>({});

/** Each preview tab's address, by the tab's id; in each project's store, kept between launches. */
export const previewUrlsAtom = atom<Record<string, string>>({});

/** What the main process last said of each preview's page, by the tab's id. */
export const previewStatesAtom = atom<Record<string, PreviewState>>({});
