import { LineCounts } from '../primitives/line-counts.js';

export interface ChangedFile {
  path: string;
  created: boolean;
  added: number;
  removed: number;
}

export interface ChangesCardProps {
  files: ChangedFile[];
  /** A file opens its diff. */
  onOpen?: (path: string) => void;
  /** Opens every change, as `Review`. */
  onReview?: () => void;
}

/** What a turn changed, at its end. */
export function ChangesCard({ files, onOpen, onReview }: ChangesCardProps) {
  const added = files.reduce((sum, file) => sum + file.added, 0);
  const removed = files.reduce((sum, file) => sum + file.removed, 0);

  return (
    <div className="rounded-xl bg-background ring-1 ring-edge">
      <div className="flex h-10 items-center gap-2 pr-2 pl-4">
        <p className="flex min-w-0 flex-1 items-center gap-1.5 font-medium">
          {files.length} {files.length === 1 ? 'file' : 'files'} changed
          <span className="font-normal">
            <LineCounts added={added} removed={removed} />
          </span>
        </p>
        {onReview && (
          <button type="button" onClick={onReview} className="h-7 cursor-default rounded-lg px-2.5 font-medium hover:bg-shade">
            Review
          </button>
        )}
      </div>
      <ul className="border-t border-line py-1">
        {files.map((file) => {
          const name = file.path.slice(file.path.lastIndexOf('/') + 1);
          const folder = file.path.slice(0, -name.length - 1);

          return (
            <li key={file.path}>
              <button type="button" onClick={() => onOpen?.(file.path)} className="flex h-8 w-full cursor-default items-center gap-2 px-4 text-left hover:bg-shade">
                <span className="shrink-0">{name}</span>
                <span className="min-w-0 flex-1 truncate text-faint">{folder}</span>
                {file.created && <span className="shrink-0 text-faint">new</span>}
                <span className="flex w-16 shrink-0 justify-end">
                  <LineCounts added={file.added} removed={file.removed} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
