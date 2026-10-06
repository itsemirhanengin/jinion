import { ArrowDown } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';

export interface ConversationProps {
  children: ReactNode;
  /** At the bottom, under the conversation that scrolls: the composer, or what takes its place. */
  footer?: ReactNode;
}

/** How close to the end still counts as there, in pixels. */
const END = 24;

/**
 * Follows the conversation as it grows while the user is at its end. Only the user's own scrolling up lets go, and
 * coming back down to the end follows again, so a reply that streams never pulls against the user's hand.
 */
export function Conversation({ children, footer }: ConversationProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const lastTop = useRef(0);

  const [away, setAway] = useState(false);

  useEffect(() => {
    const node = scroller.current;
    if (!node || !content.current) return;

    // Only this list's own scrollTop moves, never the panes around it as `scrollIntoView` would.
    const observer = new ResizeObserver(() => {
      if (following.current) node.scrollTop = node.scrollHeight;
    });

    observer.observe(content.current);

    return () => observer.disconnect();
  }, []);

  const scroll = () => {
    const node = scroller.current;
    if (!node) return;

    const top = node.scrollTop;
    const atEnd = node.scrollHeight - top - node.clientHeight < END;

    if (top < lastTop.current - 1) following.current = false;
    else if (atEnd) following.current = true;

    lastTop.current = top;
    setAway(!following.current && !atEnd);
  };

  const toEnd = () => {
    const node = scroller.current;
    if (!node) return;

    following.current = true;
    node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* The scrollbar's room is kept on both sides, so the conversation stays centered over the composer under it. */}
      <div ref={scroller} onScroll={scroll} className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable_both-edges]">
        <div ref={content} className="mx-auto flex w-full max-w-176 flex-col gap-5 px-8 pt-2 pb-8 select-text [&_button]:select-none">
          {children}
        </div>
      </div>
      {footer && (
        <div className="relative shrink-0 before:pointer-events-none before:absolute before:inset-x-0 before:-top-8 before:h-8 before:bg-linear-to-t before:from-background before:to-transparent">
          {away && (
            <button
              type="button"
              aria-label="Jump to the end"
              title="Jump to the end"
              onClick={toEnd}
              className="absolute -top-11 left-1/2 z-10 flex size-8 -translate-x-1/2 animate-enter cursor-default items-center justify-center rounded-full bg-floating text-muted shadow-lg ring-1 ring-edge hover:text-ink"
            >
              <ArrowDown className="size-4" />
            </button>
          )}
          {/* The top padding keeps the composer's ring and shadow clear of the fade, which paints over what is under it. */}
          <div className="mx-auto w-full max-w-176 px-8 pt-1 pb-4">{footer}</div>
        </div>
      )}
    </div>
  );
}

/** A user's message and what answered it; the message stays on top while the answer scrolls under it. */
export function Turn({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3">{children}</div>;
}
