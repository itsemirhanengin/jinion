import { Undo2 } from 'lucide-react';
import { Button } from '../primitives/button.js';

export interface UserMessageProps {
  text: string;
  /** Goes back to before this message; the button shows only when given. */
  onRewind?: () => void;
}

export function UserMessage({ text, onRewind }: UserMessageProps) {
  return (
    <div className="group sticky top-2 z-10 rounded-xl bg-background px-4 py-3 shadow-xs ring-1 ring-edge">
      <p className="max-h-36 overflow-y-auto pr-6 text-pretty whitespace-pre-wrap">{text}</p>
      {onRewind && (
        <Button size="icon" aria-label="Rewind to here" title="Rewind to here" onClick={onRewind} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100">
          <Undo2 />
        </Button>
      )}
    </div>
  );
}
