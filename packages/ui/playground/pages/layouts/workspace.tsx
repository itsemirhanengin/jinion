import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { pageSource, searchBoxSource } from './fixtures.js';
import { type Mode, PillSwitch, SideIcons, type View, WordsSwitch } from './mode-switch.js';
import { NewThread } from './new-thread.js';
import { Choice, Composer, FilePill, Mark, type Palette, TerminalLines, ThreadBody, Window } from './pieces.js';
import {
  ChangesCard,
  CodePane,
  FileTree,
  GitPanel,
  Group,
  PreviewCard,
  SearchPanel,
  TerminalCard,
  ThreadCard,
  ThreadList,
  TitleBar,
} from './workbench.js';

export type SwitchLook = 'words' | 'pills' | 'sidebar';

/** The project's window: Agent for threads and what they make, Code for files, Git and the editor, with a composer that asks from any file. */
export function Workspace({ palette, look }: { palette: Palette; look: SwitchLook }) {
  const [mode, setMode] = useState<Mode>('agent');
  const [thread, setThread] = useState<'new' | 'working'>('new');
  const [view, setView] = useState<View>('files');

  const openThread = () => {
    setMode('agent');
    setThread('working');
  };

  return (
    <Window palette={palette} className="flex-col bg-chrome">
      <TitleBar
        after={
          (look === 'words' && <WordsSwitch mode={mode} onMode={setMode} />) || (look === 'pills' && <PillSwitch mode={mode} onMode={setMode} />)
        }
      />
      <div className="flex min-h-0 flex-1 gap-2 px-2 pb-2">
        <aside className="flex w-72 shrink-0 flex-col gap-2">
          {(look === 'sidebar' || mode === 'code') && (
            <SideIcons
              withThreads={look === 'sidebar'}
              mode={mode}
              view={view}
              onThreads={() => setMode('agent')}
              onView={(next) => {
                setMode('code');
                setView(next);
              }}
            />
          )}
          {mode === 'agent' ? (
            <ThreadList active={thread === 'working' ? 0 : undefined} titled={look !== 'sidebar'} onNew={() => setThread('new')} onSelect={openThread} />
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto px-1">
              {view === 'files' && (
                <>
                  <button type="button" className="flex h-7 w-full items-center gap-1 rounded-md px-1.5 text-left text-[11px] font-semibold text-muted hover:bg-shade">
                    <ChevronDown className="size-3.5 text-faint" />
                    coding-agent
                  </button>
                  <FileTree />
                </>
              )}
              {view === 'search' && <SearchPanel />}
              {view === 'git' && <GitPanel />}
            </div>
          )}
        </aside>

        {mode === 'code' ? (
          <CodeArea />
        ) : thread === 'new' ? (
          <Group
            tabs={[
              { title: 'New thread', kind: 'thread', active: true },
              { title: 'Search on the users table', kind: 'thread', state: 'working' },
              { title: 'page.tsx', kind: 'file' },
            ]}
          >
            <NewThread onOpen={openThread} />
          </Group>
        ) : (
          <Group
            tabs={[
              { title: 'Search on the users table', kind: 'thread', state: 'working', active: true },
              { title: 'page.tsx', kind: 'file' },
              { title: 'Invite emails in Turkish', kind: 'thread', state: 'waiting' },
            ]}
          >
            <ThreadBody width="max-w-168" gutter="px-6" />
          </Group>
        )}

        <aside className="flex w-72 shrink-0 flex-col gap-2 overflow-y-auto">
          {(mode === 'code' || thread === 'new') && <ThreadCard onOpen={openThread} />}
          {(mode === 'code' || thread === 'working') && <ChangesCard />}
          {(mode === 'code' || thread === 'working') && <PreviewCard />}
          {mode === 'agent' && thread === 'working' && <TerminalCard />}
        </aside>
      </div>
    </Window>
  );
}

function CodeArea() {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <div className="flex min-h-0 flex-1 gap-2">
        <Group
          grow={false}
          className="flex-3"
          tabs={[
            { title: 'page.tsx', kind: 'file', active: true },
            { title: 'users-table.tsx', kind: 'file' },
          ]}
        >
          <CodePane path="apps/dashboard/src/app/users/page.tsx" code={pageSource} marked={[10, 11, 12, 13]}>
            <AskAnywhere />
          </CodePane>
        </Group>
        <Group
          grow={false}
          className="flex-2"
          tabs={[
            { title: 'search-box.tsx', kind: 'file', active: true },
            { title: 'Git: 3 files', kind: 'git' },
          ]}
        >
          <CodePane path="apps/dashboard/src/app/users/search-box.tsx" code={searchBoxSource} />
        </Group>
      </div>
      <Group
        grow={false}
        className="h-44"
        tabs={[
          { title: 'pnpm dev:dashboard', kind: 'terminal', active: true },
          { title: 'zsh', kind: 'terminal' },
        ]}
      >
        <div className="min-h-0 flex-1 overflow-y-auto">
          <TerminalLines />
        </div>
      </Group>
    </div>
  );
}

/** The composer over the open file: it carries the selected lines, and the question goes to the thread picked under it. */
function AskAnywhere() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-background from-65% to-transparent px-6 pt-12 pb-3">
      <div className="pointer-events-auto mx-auto max-w-160">
        <Composer
          placeholder="Ask about the selection"
          attached={<FilePill name="page.tsx" lines="10–13" />}
          footer={
            <div className="flex min-w-0 items-center gap-1 px-1 text-muted">
              <span className="shrink-0 pl-2">Send to</span>
              <Choice>
                <Mark state="working" />
                <span className="truncate">Search on the users table</span>
              </Choice>
              <span className="shrink-0 text-faint">or</span>
              <button type="button" className="h-7 shrink-0 rounded-lg px-2 hover:bg-shade hover:text-ink">
                a new thread
              </button>
            </div>
          }
        />
      </div>
    </div>
  );
}
