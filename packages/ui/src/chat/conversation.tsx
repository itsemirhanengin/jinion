import { ArrowDown } from 'lucide-react';
import { Children, isValidElement, type ReactElement, type ReactNode, useRef, useState } from 'react';
import { VirtualList, type VirtualListHandle } from '../primitives/virtual-list.js';

export interface ConversationProps {
  /** The conversation's pieces, each a turn or a line of its own, keyed; only those in view are drawn. */
  children: ReactNode;
  /** At the bottom, under the conversation that scrolls: the composer, or what takes its place. */
  footer?: ReactNode;
}

/** A turn's height before it is drawn: a message and a few lines of answer. */
const TURN = 240;

/**
 * Follows the conversation as it grows while the user is at its end. Only the user's own scrolling up lets go, and
 * coming back down to the end follows again, so a reply that streams never pulls against the user's hand. However long
 * it gets, only the turns in view and a screen around them are drawn.
 */
export function Conversation({ children, footer }: ConversationProps) {
  const list = useRef<VirtualListHandle>(null);
  const [away, setAway] = useState(false);

  const pieces = Children.toArray(children).filter(isValidElement) as ReactElement[];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <VirtualList
        handle={list}
        items={pieces}
        keyOf={(piece) => String(piece.key)}
        estimate={() => TURN}
        follow
        onAway={setAway}
        gap={20}
        className="min-h-0 flex-1"
        innerClassName="mx-auto w-full max-w-208 px-8 pt-2 pb-8 select-text [&_button]:select-none"
      >
        {(piece) => piece}
      </VirtualList>
      {footer && (
        // The fade over the conversation's end stops short of its scrollbar, which it would hide at the bottom.
        <div className="relative shrink-0 before:pointer-events-none before:absolute before:inset-x-2.5 before:-top-8 before:h-8 before:bg-linear-to-t before:from-background before:to-transparent">
          {away && (
            <button
              type="button"
              aria-label="Jump to the end"
              title="Jump to the end"
              onClick={() => list.current?.scrollToEnd()}
              className="absolute -top-11 left-1/2 z-10 flex size-8 -translate-x-1/2 animate-enter cursor-default items-center justify-center rounded-full bg-floating text-muted shadow-lg ring-1 ring-edge hover:text-ink"
            >
              <ArrowDown className="size-4" />
            </button>
          )}
          {/* The top padding keeps the composer's ring and shadow clear of the fade, which paints over what is under it. */}
          <div className="mx-auto w-full max-w-208 px-8 pt-1 pb-4">{footer}</div>
        </div>
      )}
    </div>
  );
}

/** A user's message and what answered it; the message stays on top while the answer scrolls under it. */
export function Turn({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3">{children}</div>;
}
