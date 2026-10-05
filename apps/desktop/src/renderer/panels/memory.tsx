import type { MemoryNote } from '@jinion/core/api/schemas';
import { Button, classNames, Empty, List, Page } from '@jinion/ui';
import { Prose } from '@jinion/ui/chat';
import { useAtomValue } from 'jotai';
import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useJinion } from '../state/session.js';

const SCOPES = [
  { scope: 'project', title: 'This project', note: 'Kept in the project, for everyone who works on it with Jinion' },
  { scope: 'user', title: 'You', note: 'Kept in your home folder, in every project' },
] as const;

/** What the agent remembers between conversations, and a way to forget a note that no longer holds. */
export function Memory() {
  const jinion = useJinion();
  const notes = useAtomValue(jinion.memoryAtom);

  return (
    <Page title="Memory" description="What the agent keeps for later conversations: your preferences, decisions made together, facts about the project.">
      {SCOPES.map(({ scope, title, note }) => {
        const shown = notes.filter((each) => each.scope === scope);

        return (
          <section key={scope} className="flex flex-col gap-2">
            <div className="flex items-baseline gap-2">
              <h2 className="text-small font-medium text-muted">{title}</h2>
              <span className="text-small text-faint">{note}</span>
            </div>
            {shown.length === 0 ? (
              <Empty>Nothing yet.</Empty>
            ) : (
              <List>
                {shown.map((each) => (
                  <Note key={each.id} note={each} onForget={() => jinion.forget(each)} />
                ))}
              </List>
            )}
          </section>
        );
      })}
    </Page>
  );
}

function Note({ note, onForget }: { note: MemoryNote; onForget: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col">
      <button type="button" onClick={() => setOpen(!open)} className="flex cursor-default items-center gap-3 px-4 py-3 text-left hover:bg-hover/50">
        <ChevronRight className={classNames('size-3.5 shrink-0 text-faint transition-transform', open && 'rotate-90')} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-medium">{note.title}</span>
          <span className="truncate text-muted">{note.description}</span>
        </span>
        <span className="shrink-0 rounded-full bg-hover px-2 py-0.5 text-small text-muted">{note.type}</span>
        <span className="shrink-0 text-right text-small whitespace-nowrap text-faint tabular-nums">{note.updated}</span>
      </button>
      {open && (
        <div className="flex flex-col gap-3 px-4 pb-4 pl-11">
          <Prose text={note.content} />
          <div className="flex items-center gap-2">
            <span className="flex-1 truncate font-mono text-code text-faint">{note.path}</span>
            <Button variant="outline" size="small" onClick={onForget}>
              Forget
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
