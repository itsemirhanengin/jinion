import { ShieldQuestion } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../primitives/button.js';

export interface PermissionRequest {
  title: string;
  command?: string;
  subject?: string;
  description?: string;
  /** What a yes for good covers, such as `` `pnpm add:*` in this project ``; left out when there is no such yes. */
  always?: string;
}

export type PermissionDecision = { allow: true; always?: boolean } | { allow: false; note?: string };

export interface PermissionPanelProps {
  request: PermissionRequest;
  onAnswer: (decision: PermissionDecision) => void;
}

/** What the agent asks before it acts; it takes the composer's place until answered. */
export function PermissionPanel({ request, onAnswer }: PermissionPanelProps) {
  const [note, setNote] = useState<string>();

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-floating p-4 shadow-sm ring-1 ring-edge">
      <div className="flex items-center gap-2 font-medium">
        <ShieldQuestion className="size-4 text-warning" />
        {request.title}
      </div>
      {request.command && (
        <pre className="overflow-x-auto rounded-xl bg-raised px-3 py-2 font-mono ring-1 ring-edge text-mono select-text">{request.command}</pre>
      )}
      {request.subject && <div className="font-mono text-mono text-muted">{request.subject}</div>}
      {request.description && <p className="text-muted">{request.description}</p>}
      {note === undefined ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" size="small" onClick={() => onAnswer({ allow: true })}>
            Yes
          </Button>
          {request.always && (
            <Button variant="outline" size="small" onClick={() => onAnswer({ allow: true, always: true })}>
              Yes, and don't ask again for {request.always.replaceAll('`', '')}
            </Button>
          )}
          <Button size="small" onClick={() => onAnswer({ allow: false })}>
            No
          </Button>
          <Button size="small" onClick={() => setNote('')}>
            No, and say what instead
          </Button>
        </div>
      ) : (
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            onAnswer({ allow: false, note: note.trim() || undefined });
          }}
        >
          <input
            ref={(field) => field?.focus()}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="What should the agent do instead?"
            className="h-8 min-w-0 flex-1 rounded-lg bg-background px-3 ring-1 ring-edge outline-none placeholder:text-faint focus:ring-primary/40"
          />
          <Button type="submit" variant="primary" size="small">
            Send
          </Button>
        </form>
      )}
    </div>
  );
}
