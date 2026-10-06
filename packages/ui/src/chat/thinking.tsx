import { Brain } from 'lucide-react';
import { useState } from 'react';
import { classNames } from '../lib/class-names.js';
import { WorkBody, WorkLine } from './work-line.js';

export interface ThinkingProps {
  text: string;
  /** How long it took, such as `4s`. */
  took?: string;
  /** The model still thinks. */
  active?: boolean;
}

export function Thinking({ text, took, active }: ThinkingProps) {
  const [open, setOpen] = useState(false);
  const [whole, setWhole] = useState(false);

  // Models end their thoughts with blank lines, which would show as room under the text.
  const thought = text.trim();
  const long = thought.length > 480 || thought.split('\n').length > 6;

  return (
    <div className="flex flex-col">
      <WorkLine icon={<Brain />} open={open} onToggle={() => setOpen(!open)} active={active}>
        {active ? (
          <span>Thinking</span>
        ) : (
          <span>
            Thought {took && <span className="text-faint">for {took}</span>}
          </span>
        )}
      </WorkLine>
      {open && (
        <WorkBody>
          <p
            className={classNames(
              'text-pretty whitespace-pre-wrap text-muted',
              long && !whole && 'max-h-30 overflow-hidden [mask-image:linear-gradient(to_bottom,black_55%,transparent)]',
            )}
          >
            {thought}
          </p>
          {long && !whole && (
            <button type="button" onClick={() => setWhole(true)} className="mt-1 cursor-default text-faint hover:text-ink">
              Show all
            </button>
          )}
        </WorkBody>
      )}
    </div>
  );
}
