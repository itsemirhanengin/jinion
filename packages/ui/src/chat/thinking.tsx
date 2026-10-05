import { useState } from 'react';
import { WorkLine } from './work-line.js';

export interface ThinkingProps {
  text: string;
  /** How long it took, such as `4s`; left out while the model still thinks. */
  took?: string;
}

export function Thinking({ text, took }: ThinkingProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-1">
      <WorkLine open={open} onToggle={() => setOpen(!open)}>
        {took ? (
          <span>
            Thought <span className="text-faint">for {took}</span>
          </span>
        ) : (
          <span>Thinking</span>
        )}
      </WorkLine>
      {open && <p className="ml-1.5 animate-enter border-l border-line pl-4 text-pretty whitespace-pre-wrap text-muted">{text}</p>}
    </div>
  );
}
