import { CircleCheck, FilePen, GitCommitHorizontal, SquareTerminal } from 'lucide-react';
import type { ReactNode } from 'react';
import { ActivityCard } from './activity-card.js';
import { greeting } from './greeting.js';
import { Browser, Composer, ComposerFooter, Counts, Mark } from './pieces.js';
import { Card, Running } from './workbench.js';

/** A new thread opens on where the project stands: what waits on the user, what runs, what changed since they were last here, and their year with Jinion. */
export function NewThread({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-176 flex-col gap-5 px-8 pt-8 pb-5">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl/7 font-medium tracking-tight">{greeting(new Date(), 'Emirhan')}</h1>
            <p className="text-pretty text-muted">One thread is waiting on you, one is at work, and the dev server is up.</p>
          </div>

          <Card title="Waiting on you" detail="1 thread">
            <div className="flex flex-col gap-3 px-4 py-3">
              <div className="flex items-center gap-2">
                <Mark state="waiting" />
                <span className="min-w-0 flex-1 truncate font-medium">Invite emails in Turkish</span>
                <span className="text-faint tabular-nums">4m</span>
              </div>
              <p className="text-pretty text-ink/85">Should the subject line stay in English? The body is in Turkish now, and the subject is what most people see first.</p>
              <div className="flex items-center gap-1">
                <button type="button" onClick={onOpen} className="h-7 rounded-full bg-primary px-3.5 font-medium text-on-primary">
                  Answer
                </button>
                <button type="button" onClick={onOpen} className="h-7 rounded-full px-3 text-muted hover:bg-shade hover:text-ink">
                  Open the thread
                </button>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <Card title="Running" detail="1 terminal" action="Open">
              <div className="flex h-9 items-center gap-2 px-4">
                <SquareTerminal className="size-4 shrink-0 text-muted" />
                <span className="min-w-0 flex-1 truncate font-mono text-mono">pnpm dev:dashboard</span>
                <span className="text-faint">
                  <Running label="localhost:3000" />
                </span>
              </div>
              <div className="h-32 overflow-hidden">
                <div className="h-[284px]" style={{ zoom: 0.45 }}>
                  <Browser bare />
                </div>
              </div>
            </Card>

            <Card title="Since last time" detail="Yesterday, 18:40">
              <ul className="flex flex-col py-1">
                <Since icon={<GitCommitHorizontal />} text="2 commits on feat/dashboard" detail="by Jinion" />
                <Since icon={<FilePen />} text="README.md" detail="edited by you" />
                <Since icon={<CircleCheck />} text="Move the tokens to CSS variables" detail={<Counts added={120} removed={88} />} />
                <Since icon={<CircleCheck />} text="Fix the flaky login test" detail={<Counts added={6} removed={2} />} />
              </ul>
            </Card>
          </div>

          <ActivityCard />
        </div>
      </div>
      <div className="mx-auto w-full max-w-176 px-8 pb-4">
        <Composer placeholder="Ask for a change. / for commands, @ for files" footer={<ComposerFooter />} rows={3} />
      </div>
    </div>
  );
}

function Since({ icon, text, detail }: { icon: ReactNode; text: string; detail: ReactNode }) {
  return (
    <li>
      <button type="button" className="flex h-8 w-full items-center gap-2 px-4 text-left hover:bg-shade [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted">
        {icon}
        <span className="min-w-0 flex-1 truncate">{text}</span>
        <span className="shrink-0 text-faint">{detail}</span>
      </button>
    </li>
  );
}
