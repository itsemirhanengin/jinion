import type { ChangedFile } from '@jinion/core/conversation/entries';
import { classNames, Empty, LineCounts } from '@jinion/ui';
import { DiffCard } from '@jinion/ui/chat';
import { diffLines } from '../../lib/diff.js';

export interface ChangesProps {
  files: (ChangedFile & { patch: string })[];
  selected?: string;
  onSelect: (path: string) => void;
}

/** The files the thread changed, and the one picked as a diff. */
export function Changes({ files, selected, onSelect }: ChangesProps) {
  if (files.length === 0) {
    return (
      <div className="p-4">
        <Empty>The files this thread changes show here.</Empty>
      </div>
    );
  }

  const shown = files.find((file) => file.path === selected) ?? files[0]!;

  return (
    <div className="flex flex-col">
      <div className="flex flex-col border-b border-line py-1">
        {files.map((file) => (
          <button
            key={file.path}
            type="button"
            onClick={() => onSelect(file.path)}
            className={classNames(
              'flex h-8 cursor-default items-center gap-2 px-3 text-left',
              file === shown ? 'bg-hover' : 'hover:bg-hover/50',
            )}
          >
            <span className="min-w-0 flex-1 truncate font-mono text-mono">{file.path}</span>
            {file.created && <span className="text-small text-accent">new</span>}
            <LineCounts added={file.added} removed={file.removed} />
          </button>
        ))}
      </div>
      <div className="p-3">
        <DiffCard key={shown.path} path={shown.path} lines={diffLines(shown.patch)} folded={Number.POSITIVE_INFINITY} />
      </div>
    </div>
  );
}
