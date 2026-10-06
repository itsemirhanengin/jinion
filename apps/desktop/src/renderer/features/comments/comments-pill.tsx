import { MessageSquare, X } from 'lucide-react';
import { counted } from '../../lib/numbers.js';

/** The thread's comments on its diffs, going with the next message; tinted as the files the user points at are. */
export function CommentsPill({ count, onOpen, onRemove }: { count: number; onOpen: () => void; onRemove: () => void }) {
  return (
    <span className="inline-flex h-6 items-center rounded-[4px] bg-(--tint-blue) text-(--tint-blue-ink)">
      <button type="button" onClick={onOpen} title="Show them in the changes" className="flex h-full cursor-default items-center gap-1.5 pr-1 pl-2">
        <MessageSquare className="size-3.5 shrink-0" />
        {counted(count, 'comment')}
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove the comments"
        title="Remove the comments"
        className="flex h-full cursor-default items-center rounded-r-[4px] pr-1.5 pl-0.5 opacity-60 hover:opacity-100"
      >
        <X className="size-3.5" />
      </button>
    </span>
  );
}
