import { Undo2 } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import { classNames } from '../lib/class-names.js';
import { Button } from '../primitives/button.js';
import { CopyButton } from '../primitives/copy-button.js';

export interface UserMessageProps {
  text: string;
  /** Goes back to before this message; the button shows only when given. */
  onRewind?: () => void;
}

/**
 * The user's message, kept on top while its answer scrolls. A long one shows its first lines fading out and opens on a
 * click, still on top; past 40% of the window it scrolls inside, so it never covers the whole answer.
 */
export function UserMessage({ text, onRewind }: UserMessageProps) {
  const body = useRef<HTMLParagraphElement>(null);

  const [long, setLong] = useState(false);
  const [open, setOpen] = useState(false);

  useLayoutEffect(() => {
    const node = body.current;
    if (!node || open) return;

    const measure = () => setLong(node.scrollHeight > node.clientHeight + 1);
    const observer = new ResizeObserver(measure);

    observer.observe(node);
    measure();

    return () => observer.disconnect();
  }, [text, open]);

  // A click that ends a selection selects; only a plain click opens or closes it.
  const toggle = () => {
    if (long && !getSelection()?.toString()) setOpen(!open);
  };

  return (
    <div className={classNames('group sticky top-2 z-10 rounded-xl bg-background px-4 py-3 shadow-xs ring-1 ring-edge', long && 'cursor-pointer')}>
      <p
        ref={body}
        onClick={toggle}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggle();
          }
        }}
        role={long ? 'button' : undefined}
        tabIndex={long ? 0 : undefined}
        className={classNames(
          'pr-14 text-pretty whitespace-pre-wrap',
          open ? 'max-h-[40vh] overflow-y-auto' : 'max-h-20 overflow-hidden',
          !open && long && '[mask-image:linear-gradient(to_bottom,black_45%,transparent)]',
        )}
      >
        {text}
      </p>
      <div className="absolute top-2 right-2 flex items-center opacity-0 group-hover:opacity-100 focus-within:opacity-100">
        <CopyButton text={text} label="Copy the message" className="size-7" />
        {onRewind && (
          <Button size="icon" aria-label="Rewind to here" title="Rewind to here" onClick={onRewind}>
            <Undo2 />
          </Button>
        )}
      </div>
    </div>
  );
}
