import type { DiffLine } from '@jinion/ui/chat';
import { atom } from 'jotai';

export interface DraftComment {
  id: string;
  /** The file as its diff names it, which is how the agent gets it. */
  path: string;
  /** The lines commented on as the diff showed them, which find them again once the file changes. */
  lines: DiffLine[];
  text: string;
  /** The tab it was left in, which shows it again. */
  tab: 'changes' | 'git';
}

/** The comments left on each thread's diffs, sent all together with its next message; in each project's store. */
export const draftCommentsAtom = atom<Record<string, DraftComment[]>>({});

export interface QueuedComments {
  /** The queued message's text, as the core hands it back. */
  text: string;
  /** What the user typed, without the line that counts the comments. */
  typed: string;
  comments: DraftComment[];
}

/** The comments that went with each thread's queued messages, so a message taken back to edit brings them back. */
export const queuedCommentsAtom = atom<Record<string, QueuedComments[]>>({});
