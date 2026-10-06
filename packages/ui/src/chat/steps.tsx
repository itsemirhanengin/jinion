import { CircleCheck } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { WorkBody, WorkLine } from './work-line.js';

export interface StepsProps {
  /** The turn still works on them: they show one under another as they come. */
  live: boolean;
  /** The one line they fold into once done, such as `Worked for 14s`. */
  summary: ReactNode;
  /** After the summary, dimmer, such as `3 files read, 1 command`. */
  detail?: string;
  children: ReactNode;
}

/** What the agent did between its words: a live list while it works, one line that opens to the list once done. */
export function Steps({ live, summary, detail, children }: StepsProps) {
  const [open, setOpen] = useState(false);

  if (live) return <div className="flex flex-col">{children}</div>;

  return (
    <div className="flex flex-col">
      <WorkLine icon={<CircleCheck />} open={open} onToggle={() => setOpen(!open)}>
        <span className="shrink-0">{summary}</span>
        {detail && <span className="min-w-0 truncate text-faint">{detail}</span>}
      </WorkLine>
      {open && (
        <WorkBody>
          <div className="flex flex-col">{children}</div>
        </WorkBody>
      )}
    </div>
  );
}
