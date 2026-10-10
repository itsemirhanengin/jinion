import { StatusIcon } from '@jinion/ui';
import { type Feature, useWorkbench } from '@jinion/workbench';
import { useAtomValue } from 'jotai';
import { FileText, Search as SearchIcon } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { filesByName } from '../lib/find.js';
import { useCore } from '../state/session.js';

const SHOWN = 50;

/** Finds the project's files and threads by name, each opening in a tab. */
export function search(): Feature {
  return { id: 'search', activity: { title: 'Search', icon: <SearchIcon />, mode: 'code', Sidebar: Search } };
}

function Search() {
  const core = useCore();
  const workbench = useWorkbench();
  const shown = useAtomValue(core.client.shownAtom);
  const files = useAtomValue(core.filesAtom);
  const saved = useAtomValue(core.savedAtom);
  const { sessions } = useAtomValue(core.sessionsAtom);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (shown && files.length === 0) void core.refreshFiles(shown);
  }, [shown]);

  const wanted = query.trim().toLowerCase();
  const titled = sessions.map((session) => ({ id: session.id, title: core.client.store.get(core.session(session.id))?.state.title ?? 'New thread', open: true }));

  const closed = saved.filter((thread) => !sessions.some((session) => session.id === thread.id));

  const threads = [...titled, ...closed.map((thread) => ({ id: thread.id, title: thread.title, open: false }))].filter((thread) =>
    thread.title.toLowerCase().includes(wanted),
  );

  const found = wanted ? filesByName(files, wanted).slice(0, SHOWN) : [];

  return (
    <div className="flex flex-col gap-4">
      <label className="flex h-8 items-center gap-2 rounded-lg bg-shade px-2.5">
        <SearchIcon className="size-4 shrink-0 text-faint" />
        <input
          name="search"
          aria-label="Search files and threads"
          ref={(input) => input?.focus()}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Files and threads"
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-faint"
        />
      </label>
      {wanted && found.length === 0 && threads.length === 0 && <p className="px-2 text-muted">Nothing is named like that.</p>}
      {wanted && found.length > 0 && (
        <Group title="Files">
          {found.map((path) => {
            const name = path.slice(path.lastIndexOf('/') + 1);

            return (
              <Row key={path} onClick={() => shown && workbench.open({ kind: 'file', id: `${shown}|${path}` }, { preview: true })}>
                <FileText className="size-4 shrink-0 text-faint" />
                <span className="shrink-0">{name}</span>
                <span className="min-w-0 flex-1 truncate text-faint">{path.slice(0, -name.length - 1)}</span>
              </Row>
            );
          })}
        </Group>
      )}
      {wanted && threads.length > 0 && (
        <Group title="Threads">
          {threads.map((thread) => (
            <Row
              key={thread.id}
              onClick={() => (thread.open ? workbench.open({ kind: 'thread', id: thread.id }) : core.act(core.resume(thread.id)))}
            >
              <span className="flex w-4 shrink-0 justify-center">
                <StatusIcon status="idle" />
              </span>
              <span className="min-w-0 flex-1 truncate">{thread.title}</span>
            </Row>
          ))}
        </Group>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="px-2 text-muted">{title}</p>
      <ul className="flex flex-col">{children}</ul>
    </div>
  );
}

function Row({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <li>
      <button type="button" onClick={onClick} className="flex h-8 w-full cursor-default items-center gap-2 rounded-lg px-2 text-left hover:bg-shade">
        {children}
      </button>
    </li>
  );
}
