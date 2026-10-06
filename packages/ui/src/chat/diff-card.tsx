import { FilePen, Maximize2, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { classNames } from '../lib/class-names.js';
import { Button } from '../primitives/button.js';
import { LineCounts } from '../primitives/line-counts.js';
import { WorkBody, WorkLine } from './work-line.js';

export type DiffLineKind = 'context' | 'added' | 'removed';

export interface DiffLine {
  kind: DiffLineKind;
  text: string;
  /** Its line in the file: the new file's for context and added lines, the old one's for removed. */
  number?: number;
}

export interface DiffCardProps {
  path: string;
  lines: DiffLine[];
  /** How many lines show before the card is opened in full. */
  folded?: number;
  /** Drawn as the card alone, without the line that opens it, as in a tab of its own. */
  bare?: boolean;
  /** Whether the line starts opened to its card. */
  defaultOpen?: boolean;
  /** The agent is still writing it. */
  active?: boolean;
  onRevert?: () => void;
  onOpen?: () => void;
}

const rows: Record<DiffLineKind, string> = {
  context: '',
  added: 'bg-added-surface text-added-ink',
  removed: 'bg-removed-surface text-removed-ink',
};

const signs: Record<DiffLineKind, string> = { context: ' ', added: '+', removed: '-' };

/** An edit the agent made: `Edited server.ts +6 -2`, the lines it changed under it. */
export function DiffCard({ path, lines, folded = 12, bare, defaultOpen = false, active, onRevert, onOpen }: DiffCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [whole, setWhole] = useState(false);

  const added = lines.filter((line) => line.kind === 'added').length;
  const removed = lines.filter((line) => line.kind === 'removed').length;
  const name = path.slice(path.lastIndexOf('/') + 1);
  const folds = lines.length > folded && !whole;
  const shown = folds ? lines.slice(0, folded) : lines;

  const card = (
    <div className="animate-enter overflow-hidden rounded-xl bg-background ring-1 ring-edge">
      <div className="flex h-9 items-center gap-2 border-b border-line bg-raised pr-1 pl-3">
        <span className="min-w-0 flex-1 truncate font-medium" title={path}>
          {name}
        </span>
        <span className="font-mono text-mono">
          <LineCounts added={added} removed={removed} />
        </span>
        {onRevert && (
          <Button size="icon" aria-label="Revert" title="Revert" onClick={onRevert}>
            <Undo2 />
          </Button>
        )}
        {onOpen && (
          <Button size="icon" aria-label="Open" title="Open" onClick={onOpen}>
            <Maximize2 />
          </Button>
        )}
      </div>
      <div className="overflow-x-auto py-1.5 font-mono text-mono select-text">
        {shown.map((line, index) => (
          <div key={index} className={classNames('flex min-w-fit whitespace-pre', rows[line.kind])}>
            <span className="w-12 shrink-0 pr-3 text-right text-faint tabular-nums select-none">{line.number}</span>
            <span className={classNames('w-5 shrink-0 select-none', line.kind === 'added' && 'text-added', line.kind === 'removed' && 'text-removed')}>
              {signs[line.kind]}
            </span>
            <span className="pr-4">{line.text}</span>
          </div>
        ))}
      </div>
      {folds && (
        <button type="button" onClick={() => setWhole(true)} className="flex h-8 w-full cursor-default items-center border-t border-line px-3 text-muted hover:bg-shade hover:text-ink">
          Show all {lines.length} lines
        </button>
      )}
    </div>
  );

  if (bare) return card;

  return (
    <div className="flex flex-col">
      <WorkLine icon={<FilePen />} open={open} onToggle={() => setOpen(!open)} active={active}>
        <span className="shrink-0">{active ? 'Editing' : 'Edited'}</span>
        <span className="min-w-0 truncate text-ink/75" title={path}>
          {name}
        </span>
        <LineCounts added={added} removed={removed} />
      </WorkLine>
      {open && <WorkBody>{card}</WorkBody>}
    </div>
  );
}
