import { SquareTerminal } from 'lucide-react';
import { useState } from 'react';
import { WorkBody, WorkLine } from './work-line.js';

export interface CommandCardProps {
  command: string;
  output: string[];
  exitCode?: number;
  /** The turn still waits on it. */
  running?: boolean;
  /** How long it took, such as `1.6s`. */
  took?: string;
  /** It went on in the background, so the turn didn't wait for it. */
  background?: boolean;
}

/** A shell command the agent ran, as one line whose output opens under it. */
export function CommandCard({ command, output, exitCode, running = false, took, background }: CommandCardProps) {
  const [open, setOpen] = useState(false);

  const failed = exitCode !== undefined && exitCode !== 0;

  return (
    <div className="flex flex-col">
      <WorkLine icon={<SquareTerminal />} open={open} onToggle={() => setOpen(!open)} active={running}>
        <span className="shrink-0">{running ? 'Running' : 'Ran'}</span>
        <code className="min-w-0 truncate font-mono text-mono text-ink/75">{command}</code>
        {background && <span className="shrink-0 text-faint">in the background</span>}
        {failed && <span className="shrink-0 text-error">exit {exitCode}</span>}
        {took && <span className="shrink-0 text-faint tabular-nums">{took}</span>}
      </WorkLine>
      {open && (
        <WorkBody>
          <pre className="max-h-72 overflow-auto rounded-lg bg-raised px-3 py-2 font-mono text-mono whitespace-pre text-ink/80 ring-1 ring-edge select-text">
            {output.length > 0 ? output.join('\n') : <span className="text-faint">No output</span>}
          </pre>
        </WorkBody>
      )}
    </div>
  );
}
