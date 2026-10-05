import { LineCounts } from '@jinion/ui';
import { DiffCard } from '@jinion/ui/chat';
import { Dot, type Feature, useLayout, useWorkbench, type Workbench } from '@jinion/workbench';
import { useAtomValue } from 'jotai';
import { GitCompare } from 'lucide-react';
import { diffLines } from '../../lib/diff.js';
import { changesOf, useCore, useSession } from '../../state/session.js';

/** The files the shown thread changed, each opening its diff in a tab. */
export function changes(): Feature {
  return {
    id: 'changes',
    activity: { title: 'Changes', icon: <GitCompare />, Badge: Changed, Sidebar: ChangeList },
    tabs: [{ kind: 'diff', Title: DiffTitle, Content: DiffTab }],
  };
}

/** Shows a change's diff in a tab of its own; a single click's tab gives way to the next one's. */
export function openChange(workbench: Workbench, session: string, path: string, preview = true) {
  workbench.open({ kind: 'diff', id: `${session}|${path}` }, { preview });
}

function Changed() {
  const files = useShownChanges();

  return files.length > 0 ? <Dot /> : null;
}

function ChangeList() {
  const workbench = useWorkbench();
  const core = useCore();
  const shown = useAtomValue(core.client.shownAtom);
  const files = useShownChanges();
  const open = useLayout((layout) => layout.groups[layout.focused]?.active);

  if (!shown || files.length === 0) return <p className="px-2 text-pretty text-muted">The files the thread changes show here.</p>;

  return (
    <ul className="flex flex-col">
      {files.map((file) => {
        const name = file.path.slice(file.path.lastIndexOf('/') + 1);

        return (
          <li key={file.path}>
            <button
              type="button"
              onClick={() => openChange(workbench, shown, file.path)}
              onDoubleClick={() => openChange(workbench, shown, file.path, false)}
              className={`flex h-8 w-full cursor-default items-center gap-2 rounded-lg px-2 text-left ${open === `diff:${shown}|${file.path}` ? 'bg-selected' : 'hover:bg-shade'}`}
            >
              <span className="shrink-0">{name}</span>
              <span className="min-w-0 flex-1 truncate text-faint">{file.path.slice(0, -name.length - 1)}</span>
              {file.created && <span className="shrink-0 text-faint">new</span>}
              <LineCounts added={file.added} removed={file.removed} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function DiffTitle({ id }: { id: string }) {
  const path = id.slice(id.indexOf('|') + 1);

  return path.slice(path.lastIndexOf('/') + 1);
}

function DiffTab({ id }: { id: string }) {
  const core = useCore();
  const session = id.slice(0, id.indexOf('|'));
  const path = id.slice(id.indexOf('|') + 1);
  const snapshot = useSession(core, session);

  const file = snapshot && changesOf(snapshot).find((each) => each.path === path);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-240 flex-col gap-3 px-8 py-6">
        <p className="truncate text-muted" title={path}>
          {path}
        </p>
        {file ? (
          <DiffCard key={path} path={path} lines={diffLines(file.patch)} folded={Number.POSITIVE_INFINITY} bare />
        ) : (
          <p className="text-muted">This change is gone with its thread.</p>
        )}
      </div>
    </div>
  );
}

function useShownChanges() {
  const core = useCore();
  const shown = useAtomValue(core.client.shownAtom);
  const snapshot = useSession(core, shown ?? '');

  return shown && snapshot ? changesOf(snapshot) : [];
}
