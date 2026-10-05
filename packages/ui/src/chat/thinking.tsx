import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { classNames } from '../lib/class-names.js';

export interface ThinkingProps {
  text: string;
  /** How long it took, such as `4s`; left out while the model still thinks. */
  took?: string;
}

export function Thinking({ text, took }: ThinkingProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex w-fit cursor-default items-center gap-1 font-medium text-ink/90"
      >
        {took ? (
          <>
            Thought <span className="font-normal text-faint">for {took}</span>
          </>
        ) : (
          <span className="animate-pulse">Thinking</span>
        )}
        <ChevronRight className={classNames('size-3.5 text-faint transition-transform', open && 'rotate-90')} />
      </button>
      {open && <div className="border-l-2 border-line pl-3 whitespace-pre-wrap text-muted">{text}</div>}
    </div>
  );
}
