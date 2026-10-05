import { useState } from 'react';
import { Spinner } from '../primitives/spinner.js';
import { WorkLine } from './work-line.js';

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

/** A shell command the agent ran, as one line whose output opens under it. */
export function CommandCard({ command, output, exitCode, took, background }: CommandCardProps) {
  const [open, setOpen] = useState(false);

  const running = exitCode === undefined && !background;
  const failed = exitCode !== undefined && exitCode !== 0;

  return (
    <div className="flex flex-col gap-1">
      <WorkLine open={open} onToggle={() => setOpen(!open)}>
        {running ? <Spinner /> : <span className="shrink-0">Ran</span>}
        <code className="min-w-0 truncate font-mono text-mono">{command}</code>
        {background && <span className="shrink-0 text-faint">in the background</span>}
        {failed && <span className="shrink-0 text-error">exit {exitCode}</span>}
        {took && <span className="shrink-0 text-faint tabular-nums">{took}</span>}
      </WorkLine>
      {open && (
        <pre className="max-h-72 animate-enter overflow-auto rounded-xl bg-raised px-4 py-3 font-mono text-mono whitespace-pre text-ink/80 ring-1 ring-edge select-text">
          {output.length > 0 ? output.join('\n') : <span className="text-faint">No output</span>}
        </pre>
      )}
    </div>
  );
}
