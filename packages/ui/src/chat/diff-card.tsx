import { ChevronDown, ChevronUp, Maximize2, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { Line } from '../code/code-view.js';
import { languageOf, useTokens } from '../code/highlight.js';
import { classNames } from '../lib/class-names.js';
import { Button } from '../primitives/button.js';
import { LineCounts } from '../primitives/line-counts.js';

export type DiffLineKind = 'context' | 'added' | 'removed';

export interface DiffLine {
  kind: DiffLineKind;
  text: string;
}

export interface DiffCardProps {
  path: string;
  lines: DiffLine[];
  /** How many lines show before the card is opened. */
  folded?: number;
  onRevert?: () => void;
  onOpen?: () => void;
}

const looks: Record<DiffLineKind, string> = {
  context: 'border-transparent',
  added: 'border-added bg-added-soft',
  removed: 'border-removed bg-removed-soft',
};

export function DiffCard({ path, lines, folded = 12, onRevert, onOpen }: DiffCardProps) {
  const [open, setOpen] = useState(false);

  // The lines are colored together, so a construct spanning several reads as it does in the file.
  const tokens = useTokens(lines.map((line) => line.text).join('\n'), languageOf(path));

  const added = lines.filter((line) => line.kind === 'added').length;
  const removed = lines.filter((line) => line.kind === 'removed').length;
  const folds = lines.length > folded;
  const shown = folds && !open ? lines.slice(0, folded) : lines;
  const name = path.slice(path.lastIndexOf('/') + 1);
  const folder = path.slice(0, path.length - name.length);

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-raised">
      <div className="flex h-10 items-center gap-2 border-b border-line pr-1.5 pl-3">
        <span className="min-w-0 truncate" title={path}>
          {folder && <span className="text-faint">{folder}</span>}
          <span className="font-medium">{name}</span>
        </span>
        <LineCounts added={added} removed={removed} />
        <span className="flex-1" />
        {onRevert && (
          <Button size="icon" aria-label="Revert" onClick={onRevert} className="[&_svg]:size-3.5">
            <Undo2 />
          </Button>
        )}
        {onOpen && (
          <Button size="icon" aria-label="Open" onClick={onOpen} className="[&_svg]:size-3.5">
            <Maximize2 />
          </Button>
        )}
      </div>
      <pre className="overflow-x-auto py-1.5 font-mono text-code select-text">
        {shown.map((line, index) => (
          <div key={index} className={classNames('min-w-fit border-l-2 px-3 whitespace-pre', looks[line.kind])}>
            <Line tokens={tokens?.[index]} text={line.text} />
          </div>
        ))}
      </pre>
      {folds && (
        <button
          type="button"
          aria-label={open ? 'Show less' : 'Show all'}
          onClick={() => setOpen(!open)}
          className="flex h-6 w-full cursor-default items-center justify-center text-faint hover:bg-hover/60 hover:text-muted"
        >
          {open ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </button>
      )}
    </div>
  );
}
