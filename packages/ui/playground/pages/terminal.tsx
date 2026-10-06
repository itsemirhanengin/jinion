import { classNames, FadeText, Spinner } from '@jinion/ui';
import { Bot, Columns2, Plus, SquareTerminal, X } from 'lucide-react';
import type { ReactNode } from 'react';

type Tone = 'muted' | 'faint' | 'added' | 'removed' | 'accent';

interface Line {
  parts: [string, Tone?][];
}

interface Term {
  id: string;
  title: string;
  folder: string;
  agent?: boolean;
  state?: 'running' | 'failed' | 'done';
  code?: number;
  lines: Line[];
}

const prompt = (folder: string, command = ''): Line => ({ parts: [[`~/projects/${folder}`, 'accent'], [' $ ', 'faint'], [command]] });

const SHELL: Term = {
  id: 'shell',
  title: 'zsh',
  folder: 'jinion',
  lines: [
    { parts: [['Last login: Tue Oct  6 16:31:30 on ttys009', 'faint']] },
    prompt('jinion', 'git status --short'),
    { parts: [[' M apps/desktop/src/renderer/features/tasks.tsx', 'removed']] },
    { parts: [['?? apps/desktop/src/renderer/features/terminal/', 'removed']] },
    prompt('jinion'),
  ],
};

const DESKTOP: Term = {
  id: 'desktop',
  title: 'zsh',
  folder: 'jinion/apps/desktop',
  lines: [prompt('jinion/apps/desktop', 'pnpm typecheck'), { parts: [['$ tsc', 'faint']] }, prompt('jinion/apps/desktop')],
};

const DEV: Term = {
  id: 'dev',
  title: 'pnpm dev',
  folder: 'jinion/apps/website',
  agent: true,
  state: 'running',
  lines: [
    prompt('jinion/apps/website', 'pnpm dev'),
    { parts: [['> next dev --turbopack', 'faint']] },
    { parts: [['   ▲ Next.js 16.1.0 (Turbopack)']] },
    { parts: [['   - Local:        ', 'muted'], ['http://localhost:3000', 'accent']] },
    { parts: [[' ✓ ', 'added'], ['Ready in 812ms']] },
    { parts: [[' GET / 200 in 143ms', 'faint']] },
  ],
};

const TEST: Term = {
  id: 'test',
  title: 'pnpm test',
  folder: 'jinion/apps/api',
  agent: true,
  state: 'failed',
  code: 1,
  lines: [
    prompt('jinion/apps/api', 'pnpm test limits'),
    { parts: [[' ✓ ', 'added'], ['tests/limits.test.ts > counts each key apart']] },
    { parts: [[' × ', 'removed'], ['tests/limits.test.ts > resets after a minute']] },
    { parts: [['   expected 429 to be 200', 'removed']] },
    { parts: [[' Tests  1 failed | 1 passed (2)', 'muted']] },
  ],
};

const GROUPS: Term[][] = [[SHELL, DESKTOP], [DEV], [TEST]];

const SHOWN = 0;

const FOCUSED = 'desktop';

const tones: Record<Tone, string> = {
  muted: 'text-muted',
  faint: 'text-faint',
  added: 'text-added',
  removed: 'text-removed',
  accent: 'text-accent',
};

/** The bottom panel's terminals as picked: the project's terminals listed on the right, the shown group's panes titled. */
export function Terminal() {
  return (
    <div className="flex h-[calc(100dvh-2rem)] min-h-160 flex-col overflow-hidden rounded-xl bg-chrome ring-1 ring-black/10">
      <div className="m-2 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-background shadow-xs ring-1 ring-black/5">
        <Above />
        <div className="h-px shrink-0 bg-line" />
        <Panel>
          <Panes group={GROUPS[SHOWN]!} />
          <List />
        </Panel>
      </div>
    </div>
  );
}

/** What sits over the panel, faint, so the panel is seen where it lives. */
function Above() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-11 shrink-0 items-center gap-1 px-3">
        <div className="flex h-7 w-44 items-center gap-2 rounded-lg bg-shade px-2.5">
          <Spinner className="text-primary" />
          <FadeText>Rate limiting for the API</FadeText>
        </div>
        <div className="flex h-7 w-44 items-center gap-2 rounded-lg px-2.5 text-muted">
          <span className="size-1.5 shrink-0 rounded-full bg-faint" />
          <FadeText>Fix the flaky login test</FadeText>
        </div>
      </div>
      <div className="mx-auto w-full max-w-176 flex-1 px-8 pt-4 text-muted">
        <p className="text-pretty">
          I started the website's dev server in a terminal of the project, so you can watch it; it is ready on port 3000. The
          limits test fails after a minute; reading its output now.
        </p>
      </div>
    </div>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return (
    <section className="flex h-80 shrink-0 flex-col">
      <header className="flex h-10 shrink-0 items-center gap-1 px-3">
        <ViewButton>Tasks</ViewButton>
        <ViewButton active>Terminal</ViewButton>
        <div className="flex-1" />
        <Icon label="New terminal">
          <Plus />
        </Icon>
        <Icon label="Split the terminal (⌘\)">
          <Columns2 />
        </Icon>
        <Icon label="Close the panel">
          <X />
        </Icon>
      </header>
      <div className="flex min-h-0 flex-1">{children}</div>
    </section>
  );
}

function ViewButton({ active, children }: { active?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      className={classNames('flex h-7 cursor-default items-center gap-1.5 rounded-lg px-2.5', active ? 'bg-shade text-ink' : 'text-muted hover:bg-shade hover:text-ink')}
    >
      {children}
    </button>
  );
}

function Panes({ group }: { group: Term[] }) {
  return (
    <div className="flex min-w-0 flex-1">
      {group.map((term, index) => (
        <div key={term.id} className={classNames('flex min-w-0 flex-1 flex-col', index > 0 && 'border-l border-line')}>
          <PaneTitle term={term} focused={term.id === FOCUSED} split={group.length > 1} />
          <Screen term={term} focused={term.id === FOCUSED} />
        </div>
      ))}
    </div>
  );
}

function PaneTitle({ term, focused, split }: { term: Term; focused: boolean; split: boolean }) {
  return (
    <div className={classNames('group flex h-8 shrink-0 items-center gap-2 pr-1 pl-3', focused ? 'text-ink' : 'text-muted')}>
      <TermIcon term={term} />
      <span className="shrink-0">{term.title}</span>
      <FadeText className="text-faint">{term.folder}</FadeText>
      <Status term={term} />
      {split && (
        <span className="opacity-0 group-hover:opacity-100">
          <Icon label="Close">
            <X />
          </Icon>
        </span>
      )}
    </div>
  );
}

function Screen({ term, focused }: { term: Term; focused: boolean }) {
  return (
    <div className="min-h-0 flex-1 overflow-hidden px-3 pt-1 pb-2 font-mono text-mono whitespace-pre select-text">
      {term.lines.map((line, index) => (
        <div key={index}>
          {line.parts.map(([text, tone], part) => (
            <span key={part} className={tone && tones[tone]}>
              {text}
            </span>
          ))}
          {index === term.lines.length - 1 && !term.state && (
            <span className={classNames('ml-px inline-block h-4 w-[7px] translate-y-[3px]', focused ? 'bg-ink' : 'ring-1 ring-faint ring-inset')} />
          )}
        </div>
      ))}
    </div>
  );
}

/** Every terminal of the project, a split group's together; the shown group in the hover shade. */
function List() {
  return (
    <aside className="flex w-56 shrink-0 flex-col gap-0.5 border-l border-line px-1.5 pt-0.5">
      {GROUPS.map((group, index) => (
        <div key={group.map((term) => term.id).join()} className={classNames('relative flex flex-col rounded-md', index === SHOWN && 'bg-shade')}>
          {group.length > 1 && <span className="absolute top-[24px] bottom-[24px] left-[15.5px] w-px bg-faint/50" />}
          {group.map((term) => (
            <div
              key={term.id}
              className={classNames('group menu-row relative', index === SHOWN && term.id === FOCUSED ? 'text-ink' : index === SHOWN ? 'text-ink/75' : 'text-muted hover:bg-shade hover:text-ink')}
            >
              <TermIcon term={term} />
              <span className="shrink-0">{term.title}</span>
              <FadeText className="text-faint">{term.folder.split('/').at(-1)}</FadeText>
              <Status term={term} />
              <span className="hidden size-5 shrink-0 items-center justify-center rounded-md text-muted group-hover:flex hover:bg-shade hover:text-ink">
                <X className="size-3.5" />
              </span>
            </div>
          ))}
        </div>
      ))}
    </aside>
  );
}

function TermIcon({ term }: { term: Term }) {
  return term.agent ? <Bot className="size-4 shrink-0 text-faint" /> : <SquareTerminal className="size-4 shrink-0 text-faint" />;
}

/** Running, or how it ended when it did; nothing for a shell waiting on the user. */
function Status({ term }: { term: Term }) {
  if (term.state === 'running') return <Spinner className="ml-auto shrink-0 text-primary" />;
  if (term.state === 'failed') return <span className="ml-auto shrink-0 font-mono text-mono text-removed">exit {term.code}</span>;
  if (term.state === 'done') return <span className="ml-auto shrink-0 text-faint">done</span>;

  return <span className="ml-auto" />;
}

function Icon({ label, children }: { label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="flex size-7 shrink-0 cursor-default items-center justify-center rounded-lg text-muted hover:bg-shade hover:text-ink [&_svg]:size-4 [&_svg]:shrink-0"
    >
      {children}
    </button>
  );
}
