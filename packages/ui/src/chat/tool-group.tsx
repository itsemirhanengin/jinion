import { ChevronDown } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { classNames } from '../lib/class-names.js';

export interface ToolGroupProps {
  /** What the calls did together, such as `Explored`. */
  title: string;
  /** Counted, such as `3 files, 1 search`. */
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

/** Calls that read rather than change, folded into one line until opened. */
export function ToolGroup({ title, summary, defaultOpen = false, children }: ToolGroupProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex w-fit cursor-default items-center gap-1 font-medium text-ink/90"
      >
        {title}
        {summary && <span className="font-normal text-faint">{summary}</span>}
        <ChevronDown className={classNames('size-3.5 text-faint transition-transform', !open && '-rotate-90')} />
      </button>
      {open && <div className="flex flex-col gap-1">{children}</div>}
    </div>
  );
}

export interface ToolLineProps {
  label: string;
  /** What it worked on: a path, a pattern, a command. */
  detail?: string;
}

export function ToolLine({ label, detail }: ToolLineProps) {
  return (
    <div className="flex min-w-0 items-baseline gap-1.5">
      <span className="shrink-0 text-muted">{label}</span>
      {detail && <span className="truncate text-faint">{detail}</span>}
    </div>
  );
}
