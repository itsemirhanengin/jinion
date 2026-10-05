import type { ReactNode } from 'react';

export interface ConversationProps {
  children: ReactNode;
  /** At the bottom, under the conversation that scrolls: the composer, or what takes its place. */
  footer?: ReactNode;
}

export function Conversation({ children, footer }: ConversationProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-176 flex-col gap-5 px-8 pt-2 pb-8">{children}</div>
      </div>
      {footer && (
        <div className="relative shrink-0 before:pointer-events-none before:absolute before:inset-x-0 before:-top-8 before:h-8 before:bg-linear-to-t before:from-background before:to-transparent">
          {/* The top padding keeps the composer's ring and shadow clear of the fade, which paints over what is under it. */}
          <div className="mx-auto w-full max-w-176 px-8 pt-1 pb-4">{footer}</div>
        </div>
      )}
    </div>
  );
}

/** A user's message and what answered it; the message stays on top while the answer scrolls under it. */
export function Turn({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-5">{children}</div>;
}
