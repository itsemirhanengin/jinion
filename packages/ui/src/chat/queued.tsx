import { CornerDownRight, X } from 'lucide-react';

/** Messages typed while a turn runs, sent one by one when it ends; each has a remove button when `onRemove` is given. */
export function Queued({ messages, onRemove }: { messages: string[]; onRemove?: (index: number) => void }) {
  if (messages.length === 0) return null;

  return (
    <div className="flex flex-col gap-1 px-1 pb-2">
      {messages.map((message, index) => (
        <div key={index} className="group flex items-center gap-2 rounded-lg bg-hover/60 py-1 pr-1 pl-2.5 text-muted">
          <CornerDownRight className="size-3.5 shrink-0 text-faint" />
          <span className="min-w-0 flex-1 truncate">{message}</span>
          <span className="pr-1.5 text-small text-faint">queued</span>
          {onRemove && (
            <button
              type="button"
              aria-label="Remove"
              onClick={() => onRemove(index)}
              className="flex size-5 cursor-default items-center justify-center rounded-md text-faint hover:bg-hover hover:text-ink"
            >
              <X className="size-3" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
