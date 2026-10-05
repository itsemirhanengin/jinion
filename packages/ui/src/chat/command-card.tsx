import { ChevronRight, LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { classNames } from '../lib/class-names.js';

export interface CommandCardProps {
  command: string;
  output: string[];
  /** Left out while the command runs. */
  exitCode?: number;
  /** How long it took, such as `1.6s`. */
  took?: string;
  /** It went on in the background, so the turn didn't wait for it. */
  background?: boolean;
}

/** A shell command the agent ran, its output folded until opened. */
export function CommandCard({ command, output, exitCode, took, background }: CommandCardProps) {
  const [open, setOpen] = useState(false);

  const running = exitCode === undefined && !background;
  const failed = exitCode !== undefined && exitCode !== 0;

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-raised">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-9 w-full cursor-default items-center gap-2 px-3 text-left hover:bg-hover/50"
      >
        <ChevronRight className={classNames('size-3.5 shrink-0 text-faint transition-transform', open && 'rotate-90')} />
        <code className="min-w-0 flex-1 truncate font-mono text-mono">
          <span className="text-faint">$ </span>
          {command}
        </code>
        {running && <LoaderCircle className="size-3.5 shrink-0 animate-spin text-working" />}
        {background && <span className="shrink-0 text-small text-faint">in the background</span>}
        {failed && <span className="shrink-0 text-small text-removed">exit {exitCode}</span>}
        {took && <span className="shrink-0 text-small text-faint">{took}</span>}
      </button>
      {open && (
        <pre className="max-h-72 overflow-auto border-t border-line bg-sidebar px-3 py-2 font-mono text-mono whitespace-pre text-ink/80 select-text">
          {output.length > 0 ? output.join('\n') : <span className="text-faint">No output</span>}
        </pre>
      )}
    </div>
  );
}
