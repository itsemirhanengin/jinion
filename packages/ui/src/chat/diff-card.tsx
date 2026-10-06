import { FilePen, Maximize2, Plus, Undo2 } from 'lucide-react';
import { Fragment, type MouseEvent, useEffect, useRef, useState } from 'react';
import { classNames } from '../lib/class-names.js';
import { Button } from '../primitives/button.js';
import { LineCounts } from '../primitives/line-counts.js';
import { type DiffComment, DiffCommentBlock, DiffCommentForm } from './diff-comment.js';
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
  comments?: DiffComment[];
  /** Lets the user comment on a line, or on the lines dragged across, by their place in `lines`. */
  onComment?: (from: number, to: number, text: string) => void;
  onEditComment?: (id: string, text: string) => void;
  onRemoveComment?: (id: string) => void;
}

const rows: Record<DiffLineKind, string> = {
  context: '',
  added: 'bg-added-surface text-added-ink',
  removed: 'bg-removed-surface text-removed-ink',
};

const signs: Record<DiffLineKind, string> = { context: ' ', added: '+', removed: '-' };

const NO_COMMENTS: DiffComment[] = [];

/** An edit the agent made: `Edited server.ts +6 -2`, the lines it changed under it. */
export function DiffCard({
  path,
  lines,
  folded = 12,
  bare,
  defaultOpen = false,
  active,
  onRevert,
  onOpen,
  comments = NO_COMMENTS,
  onComment,
  onEditComment,
  onRemoveComment,
}: DiffCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [whole, setWhole] = useState(false);
  const [picking, setPicking] = useState<{ anchor: number; to: number; dragging: boolean }>();
  const [editing, setEditing] = useState<string>();
  const body = useRef<HTMLDivElement>(null);

  const added = lines.filter((line) => line.kind === 'added').length;
  const removed = lines.filter((line) => line.kind === 'removed').length;
  const name = path.slice(path.lastIndexOf('/') + 1);
  const folds = lines.length > folded && !whole;
  const shown = folds ? lines.slice(0, folded) : lines;
  const picked = picking && { from: Math.min(picking.anchor, picking.to), to: Math.max(picking.anchor, picking.to) };
  const outdated = comments.filter((comment) => comment.to === undefined);

  useEffect(() => {
    if (!picking?.dragging) return;

    const stop = () => setPicking((now) => now && { ...now, dragging: false });

    const move = (event: globalThis.MouseEvent) => {
      const row = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-line]');

      if (row?.closest('[data-diff]') === body.current) setPicking((now) => now && { ...now, to: Number(row.dataset.line) });
    };

    addEventListener('mouseup', stop);
    addEventListener('mousemove', move);

    return () => {
      removeEventListener('mouseup', stop);
      removeEventListener('mousemove', move);
    };
  }, [picking?.dragging]);

  const label = (comment: DiffComment) => {
    if (comment.from === undefined || comment.to === undefined) return 'Outdated: those lines changed since';

    return linesLabel(lines[comment.from]?.number, lines[comment.to]?.number);
  };

  const commentOn = (index: number) => ({
    onMouseDown: (event: MouseEvent) => {
      if (event.button !== 0) return;

      event.preventDefault();
      setPicking({ anchor: index, to: index, dragging: true });
    },
    // A click from the keyboard comes without the mouse going down first.
    onClick: (event: MouseEvent) => {
      if (event.detail === 0) setPicking({ anchor: index, to: index, dragging: false });
    },
  });

  const commentBlock = (comment: DiffComment) =>
    editing === comment.id ? (
      <DiffCommentForm
        key={comment.id}
        initial={comment.text}
        onCancel={() => setEditing(undefined)}
        onSave={(text) => {
          onEditComment?.(comment.id, text);
          setEditing(undefined);
        }}
      />
    ) : (
      <DiffCommentBlock
        key={comment.id}
        comment={comment}
        label={label(comment)}
        onEdit={onEditComment && (() => setEditing(comment.id))}
        onRemove={onRemoveComment && (() => onRemoveComment(comment.id))}
      />
    );

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
      <div ref={body} data-diff className="overflow-x-auto py-1.5 font-mono text-mono select-text">
        {outdated.map(commentBlock)}
        {shown.map((line, index) => {
          const commentable = onComment && line.number !== undefined;
          const inPick = picked && index >= picked.from && index <= picked.to;

          return (
            <Fragment key={index}>
              <div
                data-line={index}
                className={classNames('group/line relative flex min-w-fit whitespace-pre', rows[line.kind], inPick && 'after:pointer-events-none after:absolute after:inset-0 after:bg-(--tint-blue)')}
              >
                <span className="w-12 shrink-0 pr-3 text-right text-faint tabular-nums select-none">{line.number}</span>
                <span className={classNames('relative w-5 shrink-0 select-none', line.kind === 'added' && 'text-added', line.kind === 'removed' && 'text-removed')}>
                  {signs[line.kind]}
                  {commentable && (
                    <button
                      type="button"
                      aria-label={`Comment on line ${line.number}`}
                      title="Comment, or drag for several lines"
                      className="absolute top-0.5 -left-2 hidden size-4 cursor-default items-center justify-center rounded-[4px] bg-accent text-on-primary group-hover/line:flex focus-visible:flex"
                      {...commentOn(index)}
                    >
                      <Plus className="size-3" strokeWidth={3} />
                    </button>
                  )}
                </span>
                <span className="pr-4">{line.text}</span>
              </div>
              {comments.filter((comment) => comment.to === index).map(commentBlock)}
              {picked && !picking.dragging && picked.to === index && (
                <DiffCommentForm
                  onCancel={() => setPicking(undefined)}
                  onSave={(text) => {
                    onComment?.(picked.from, picked.to, text);
                    setPicking(undefined);
                  }}
                />
              )}
            </Fragment>
          );
        })}
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

function linesLabel(from: number | undefined, to: number | undefined) {
  if (from === undefined || from === to || to === undefined) return `Line ${from ?? to}`;

  return `Lines ${from}-${to}`;
}
