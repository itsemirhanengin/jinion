import { classNames } from '@jinion/ui';
import { Code, Files, GitBranch, MessagesSquare, Search } from 'lucide-react';
import type { ReactNode } from 'react';
import { SELECTED } from './workbench.js';

export type Mode = 'agent' | 'code';

export type View = 'files' | 'search' | 'git';

const modes: { mode: Mode; label: string; icon: ReactNode; keys: string }[] = [
  { mode: 'agent', label: 'Agent', icon: <MessagesSquare />, keys: '⌘1' },
  { mode: 'code', label: 'Code', icon: <Code />, keys: '⌘2' },
];

/** Agent and Code as two words in the title bar, the shown one underlined. */
export function WordsSwitch({ mode, onMode }: { mode: Mode; onMode: (mode: Mode) => void }) {
  return (
    <nav className="ml-3 flex h-12 items-stretch gap-5">
      {modes.map((each) => (
        <button
          key={each.mode}
          type="button"
          title={`${each.label} ${each.keys}`}
          onClick={() => onMode(each.mode)}
          className={classNames('relative flex items-center', each.mode === mode ? 'font-medium text-ink' : 'text-muted hover:text-ink')}
        >
          {each.label}
          {each.mode === mode && <span className="absolute inset-x-0 bottom-2 h-0.5 rounded-full bg-primary" />}
        </button>
      ))}
    </nav>
  );
}

/** Agent and Code as two pills on the chrome, no track under them; the shown one is a white card, like a picked thread. */
export function PillSwitch({ mode, onMode }: { mode: Mode; onMode: (mode: Mode) => void }) {
  return (
    <nav className="ml-1 flex items-center gap-0.5">
      {modes.map((each) => (
        <button
          key={each.mode}
          type="button"
          title={`${each.label} ${each.keys}`}
          onClick={() => onMode(each.mode)}
          className={classNames(
            'flex h-7 items-center gap-1.5 rounded-full pr-3 pl-2.5 [&_svg]:size-3.5 [&_svg]:shrink-0',
            each.mode === mode ? classNames(SELECTED, 'text-ink') : 'text-muted hover:bg-shade hover:text-ink',
          )}
        >
          {each.icon}
          {each.label}
        </button>
      ))}
    </nav>
  );
}

/** The sidebar's views as icons in a row, as Cursor has them; the open one shows its name. With threads first, the row is the Agent and Code switch too. */
export function SideIcons({
  withThreads,
  mode,
  view,
  onThreads,
  onView,
}: {
  withThreads?: boolean;
  mode: Mode;
  view: View;
  onThreads: () => void;
  onView: (view: View) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 px-1">
      {withThreads && (
        <>
          <SideIcon label="Threads" icon={<MessagesSquare />} active={mode === 'agent'} onClick={onThreads} />
          <span className="mx-1.5 h-4 w-px bg-edge" />
        </>
      )}
      <SideIcon label="Files" icon={<Files />} active={mode === 'code' && view === 'files'} onClick={() => onView('files')} />
      <SideIcon label="Search" icon={<Search />} active={mode === 'code' && view === 'search'} onClick={() => onView('search')} />
      <SideIcon label="Git" icon={<GitBranch />} badge={3} active={mode === 'code' && view === 'git'} onClick={() => onView('git')} />
    </div>
  );
}

function SideIcon({ label, icon, badge, active, onClick }: { label: string; icon: ReactNode; badge?: number; active?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={classNames(
        'relative flex h-8 items-center gap-1.5 rounded-lg [&_svg]:size-4 [&_svg]:shrink-0',
        active ? classNames(SELECTED, 'pr-3 pl-2.5 text-ink') : 'w-8 justify-center text-muted hover:bg-shade hover:text-ink',
      )}
    >
      {icon}
      {active && label}
      {badge && (
        <span className="absolute -top-0.5 -right-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-1 text-[9px]/none font-medium text-on-primary tabular-nums">
          {badge}
        </span>
      )}
    </button>
  );
}
