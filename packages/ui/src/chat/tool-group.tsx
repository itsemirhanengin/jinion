import { type ReactNode, useState } from 'react';
import { WorkLine } from './work-line.js';

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
    <div className="flex flex-col gap-1">
      <WorkLine open={open} onToggle={() => setOpen(!open)}>
        <span className="truncate">
          {title} {summary}
        </span>
      </WorkLine>
      {open && <div className="ml-1.5 flex animate-enter flex-col gap-1 border-l border-line py-1 pl-4">{children}</div>}
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
