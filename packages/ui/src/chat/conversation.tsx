import type { ReactNode } from 'react';

export interface ConversationProps {
  children: ReactNode;
  /** Stays under the conversation as it scrolls: the composer. */
  footer?: ReactNode;
}

export function Conversation({ children, footer }: ConversationProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-170 flex-col gap-4 px-6 pt-3 pb-10">{children}</div>
      </div>
      {footer && <div className="mx-auto w-full max-w-170 px-6 pb-3">{footer}</div>}
    </div>
  );
}
