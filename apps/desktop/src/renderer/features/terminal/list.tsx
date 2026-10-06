import type { TerminalInfo } from '@jinion/core/api/protocol';
import { classNames, FadeText } from '@jinion/ui';
import { X } from 'lucide-react';
import type { Groups } from './groups.js';
import { TerminalMark, TerminalStatus } from './marks.js';

export interface TerminalListProps {
  terminals: TerminalInfo[];
  groups: Groups;
  focused: string | undefined;
  onFocus: (id: string) => void;
  onClose: (id: string) => void;
}

/** Every terminal of the project, a split group's joined by a line; the group in sight in the hover's shade. */
export function TerminalList({ terminals, groups, focused, onFocus, onClose }: TerminalListProps) {
  const byId = new Map(terminals.map((terminal) => [terminal.id, terminal]));

  return (
    <aside aria-label="Terminals" className="flex w-56 shrink-0 flex-col gap-0.5 overflow-y-auto border-l border-line px-1.5 pt-0.5 pb-2">
      {groups.map((group) => {
        const shown = focused !== undefined && group.includes(focused);

        return (
          <div key={group.join()} className={classNames('relative flex flex-col rounded-md', shown && 'bg-shade')}>
            {group.length > 1 && <span className="pointer-events-none absolute top-[24px] bottom-[24px] left-[15.5px] w-px bg-faint/50" />}
            {group.map((id) => {
              const terminal = byId.get(id);
              if (!terminal) return null;

              return (
                <div
                  key={id}
                  className={classNames(
                    'group menu-row relative',
                    shown ? (id === focused ? 'text-ink' : 'text-ink/75') : 'text-muted hover:bg-shade hover:text-ink',
                  )}
                >
                  <button type="button" onClick={() => onFocus(id)} className="flex min-w-0 flex-1 cursor-default items-center gap-2 self-stretch text-left">
                    <TerminalMark terminal={terminal} />
                    <FadeText>
                      {terminal.title} <span className="text-faint">{terminal.cwd.slice(terminal.cwd.lastIndexOf('/') + 1)}</span>
                    </FadeText>
                    <TerminalStatus terminal={terminal} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Close ${terminal.title}`}
                    title="Close"
                    onClick={() => onClose(id)}
                    className="hidden size-5 shrink-0 cursor-default items-center justify-center rounded-md text-muted group-hover:flex hover:bg-shade hover:text-ink focus-visible:flex"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        );
      })}
    </aside>
  );
}
