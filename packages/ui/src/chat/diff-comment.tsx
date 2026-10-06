import { Pencil, X } from 'lucide-react';
import { type KeyboardEvent, useState } from 'react';
import { Button } from '../primitives/button.js';

export interface DiffComment {
  id: string;
  text: string;
  /** The lines it is on, by their place in the card's lines; none once the file no longer has them. */
  from?: number;
  to?: number;
}

/** What sits between the lines stays in view as the lines scroll sideways, as wide as the card. */
const BETWEEN_LINES = 'sticky left-0 w-full px-3 py-1.5 font-sans text-ui whitespace-normal select-auto';

export function DiffCommentBlock({ comment, label, onEdit, onRemove }: { comment: DiffComment; label: string; onEdit?: () => void; onRemove?: () => void }) {
  return (
    <div className={BETWEEN_LINES}>
      <div className="group/comment flex items-start gap-2 rounded-[4px] bg-(--tint-blue) py-1.5 pr-1 pl-3 ring-1 ring-(--tint-blue-ink)/15">
        <div className="min-w-0 flex-1">
          <p className="text-small text-(--tint-blue-ink)/70">{label}</p>
          <p className="text-pretty whitespace-pre-wrap text-ink">{comment.text}</p>
        </div>
        <div className="flex opacity-0 group-focus-within/comment:opacity-100 group-hover/comment:opacity-100">
          {onEdit && (
            <Button size="icon" aria-label="Edit comment" title="Edit" onClick={onEdit}>
              <Pencil />
            </Button>
          )}
          {onRemove && (
            <Button size="icon" aria-label="Remove comment" title="Remove" onClick={onRemove}>
              <X />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function DiffCommentForm({ initial = '', onSave, onCancel }: { initial?: string; onSave: (text: string) => void; onCancel: () => void }) {
  const [text, setText] = useState(initial);

  const ready = text.trim() !== '';

  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
    } else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      if (ready) onSave(text.trim());
    }
  };

  return (
    <div className={BETWEEN_LINES}>
      <div className="rounded-[4px] bg-floating ring-1 ring-edge">
        <textarea
          name="comment"
          aria-label="Comment"
          value={text}
          // biome-ignore lint/a11y/noAutofocus: the form opens because the user asked to write in it
          autoFocus
          rows={2}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={keyDown}
          placeholder="Tell the agent what to change here"
          className="field-sizing-content block max-h-60 min-h-14 w-full resize-none bg-transparent px-3 pt-2 outline-none placeholder:text-faint"
        />
        <div className="flex items-center justify-end gap-1 px-1.5 pb-1.5">
          <Button size="small" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="small" variant="primary" disabled={!ready} title="⌘↵" onClick={() => onSave(text.trim())}>
            Comment
          </Button>
        </div>
      </div>
    </div>
  );
}
