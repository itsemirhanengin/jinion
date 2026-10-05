import { Undo2 } from 'lucide-react';
import { Button } from '../primitives/button.js';

export interface UserMessageProps {
  text: string;
  /** Goes back to before this message; the button shows only when given. */
  onRewind?: () => void;
}

export function UserMessage({ text, onRewind }: UserMessageProps) {
  return (
    <div className="group relative rounded-xl border border-line bg-raised px-3.5 py-2.5 pr-10 whitespace-pre-wrap">
      {text}
      {onRewind && (
        <Button
          size="icon"
          aria-label="Rewind to here"
          onClick={onRewind}
          className="absolute right-1.5 bottom-1.5 opacity-0 group-hover:opacity-100 [&_svg]:size-3.5"
        >
          <Undo2 />
        </Button>
      )}
    </div>
  );
}
