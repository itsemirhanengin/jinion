import { type ReactNode, useState } from 'react';
import { classNames } from '../lib/class-names.js';
import { WorkBody, WorkLine } from './work-line.js';

export interface ToolGroupProps {
  icon?: ReactNode;
  /** What the calls did together, such as `Explored`. */
  title: string;
  /** Counted, such as `3 files, 1 search`. */
  summary?: string;
  defaultOpen?: boolean;
  /** One of its calls still runs. */
  active?: boolean;
  children: ReactNode;
}

/** Calls that read rather than change, folded into one line until opened. */
export function ToolGroup({ icon, title, summary, defaultOpen = false, active, children }: ToolGroupProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="flex flex-col">
      <WorkLine icon={icon} open={open} onToggle={() => setOpen(!open)} active={active}>
        <span className="truncate">
          {title} <span className="text-faint">{summary}</span>
        </span>
      </WorkLine>
      {open && (
        <WorkBody>
          <div className="flex flex-col">{children}</div>
        </WorkBody>
      )}
    </div>
  );
}

export interface ToolLineProps {
  icon?: ReactNode;
  label: string;
  /** What it worked on: a path, a pattern, a command. */
  detail?: string;
  /** After the detail, dimmer, such as the lines read. */
  note?: string;
  /** The line opens what it names, such as the file it read. */
  onOpen?: () => void;
}

/** One call in a group, or a call that only says what it did. */
export function ToolLine({ icon, label, detail, note, onOpen }: ToolLineProps) {
  const content = (
    <>
      {icon && <span className="flex size-4 shrink-0 items-center justify-center text-faint [&_svg]:size-3.5">{icon}</span>}
      <span className="shrink-0 text-muted">{label}</span>
      {detail && <span className={classNames('min-w-0 truncate', onOpen ? 'text-ink/75 group-hover:text-ink' : 'text-faint')}>{detail}</span>}
      {note && <span className="shrink-0 text-faint tabular-nums">{note}</span>}
    </>
  );

  if (!onOpen) return <div className="flex h-6.5 min-w-0 items-center gap-2">{content}</div>;

  return (
    <button type="button" title={detail} onClick={onOpen} className="group -mx-1.5 flex h-6.5 min-w-0 cursor-default items-center gap-2 self-start rounded-md px-1.5 text-left hover:bg-shade">
      {content}
    </button>
  );
}
