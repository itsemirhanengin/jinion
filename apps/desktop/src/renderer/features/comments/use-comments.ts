import type { DiffCardProps, DiffLine } from '@jinion/ui/chat';
import { useAtom } from 'jotai';
import { type DraftComment, draftCommentsAtom } from '../../state/comments.js';
import { placeComments } from './comments.js';

const NONE: DraftComment[] = [];

/** What a diff card needs to take the thread's comments on one file and show them. */
export function useComments(session: string | undefined, tab: DraftComment['tab']) {
  const [all, setAll] = useAtom(draftCommentsAtom);

  const comments = (session && all[session]) || NONE;

  const change = (update: (comments: DraftComment[]) => DraftComment[]) => {
    if (session) setAll((drafts) => ({ ...drafts, [session]: update(drafts[session] ?? []) }));
  };

  return (path: string, lines: DiffLine[]): Partial<DiffCardProps> => ({
    comments: placeComments(
      comments.filter((comment) => comment.path === path),
      lines,
    ),
    onComment: (from, to, text) => change((list) => [...list, { id: crypto.randomUUID(), path, lines: lines.slice(from, to + 1), text, tab }]),
    onEditComment: (id, text) => change((list) => list.map((comment) => (comment.id === id ? { ...comment, text } : comment))),
    onRemoveComment: (id) => change((list) => list.filter((comment) => comment.id !== id)),
  });
}
