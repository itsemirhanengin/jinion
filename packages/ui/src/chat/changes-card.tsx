import { FileDiff } from 'lucide-react';
import { LineCounts } from '../primitives/line-counts.js';

export interface ChangedFile {
  path: string;
  created: boolean;
  added: number;
  removed: number;
}

/** What a turn changed, at its end; a file opens its diff. */
export function ChangesCard({ files, onOpen }: { files: ChangedFile[]; onOpen?: (path: string) => void }) {
  const added = files.reduce((sum, file) => sum + file.added, 0);
  const removed = files.reduce((sum, file) => sum + file.removed, 0);

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-raised">
      <div className="flex h-9 items-center gap-2 border-b border-line px-3">
        <FileDiff className="size-3.5 text-muted" />
        <span className="font-medium">
          {files.length} {files.length === 1 ? 'file' : 'files'} changed
        </span>
        <LineCounts added={added} removed={removed} />
      </div>
      {files.map((file) => (
        <button
          key={file.path}
          type="button"
          onClick={() => onOpen?.(file.path)}
          className="flex h-8 w-full cursor-default items-center gap-2 px-3 text-left hover:bg-hover/50"
        >
          <span className="min-w-0 flex-1 truncate font-mono text-mono">{file.path}</span>
          {file.created && <span className="text-small text-accent">new</span>}
          <LineCounts added={file.added} removed={file.removed} />
        </button>
      ))}
    </div>
  );
}
