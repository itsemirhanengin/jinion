import { CornerDownRight, Pencil, X } from 'lucide-react';
import type { ReactNode } from 'react';

/** Messages typed while a turn runs, sent one by one when it ends; each can go back to the composer or away. */
export function Queued({ messages, onEdit, onRemove }: { messages: string[]; onEdit?: (index: number) => void; onRemove?: (index: number) => void }) {
  if (messages.length === 0) return null;

  return (
    <div className="flex flex-col gap-1 pb-2">
      {messages.map((message, index) => (
        <div key={index} className="flex h-8 items-center gap-2 rounded-lg bg-floating pr-1 pl-3 text-muted shadow-xs ring-1 ring-edge">
          <CornerDownRight className="size-4 shrink-0 text-faint" />
          <span className="min-w-0 flex-1 truncate">{message}</span>
          <span className="pr-1.5 text-faint">queued</span>
          {onEdit && (
            <Action label="Edit" onClick={() => onEdit(index)}>
              <Pencil className="size-3.5" />
            </Action>
          )}
          {onRemove && (
            <Action label="Remove" onClick={() => onRemove(index)}>
              <X className="size-4" />
            </Action>
          )}
        </div>
      ))}
    </div>
  );
}

function Action({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-6 cursor-default items-center justify-center rounded-md text-faint hover:bg-shade hover:text-ink"
    >
      {children}
    </button>
  );
}
