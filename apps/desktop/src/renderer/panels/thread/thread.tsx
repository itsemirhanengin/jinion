import { Conversation, PermissionPanel, Queued, TodoList, Working } from '@jinion/ui/chat';
import { useSetAtom } from 'jotai';
import { ArrowUpRight } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { suggestions } from '../../mock/scenarios.js';
import { draftsAtom, panelAtom, panelFileAtom } from '../../state/app.js';
import { useActiveSession, useJinion } from '../../state/session.js';
import { Composer } from './composer.js';
import { Entries } from './entries.js';

export function Thread() {
  const jinion = useJinion();
  const session = useActiveSession();
  const setDrafts = useSetAtom(draftsAtom);
  const setPanel = useSetAtom(panelAtom);
  const setPanelFile = useSetAtom(panelFileAtom);
  const end = useRef<HTMLDivElement>(null);
  const atEnd = useRef(true);

  useEffect(() => {
    const node = end.current;
    if (!node) return;

    const observer = new IntersectionObserver(([seen]) => {
      atEnd.current = seen?.isIntersecting ?? true;
    });

    observer.observe(node);
    end.current?.scrollIntoView({ block: 'end' });

    return () => observer.disconnect();
  }, [session?.id]);

  // Follows the conversation as it grows, as long as the user hasn't scrolled away from its end.
  useEffect(() => {
    if (atEnd.current) end.current?.scrollIntoView({ block: 'end' });
  }, [session?.seq, session?.fields.working]);

  if (!session) return <Empty onNew={() => jinion.open()} />;

  const { id, state, fields } = session;
  const started = state.entries.some((entry) => entry.kind === 'user');
  const dialog = fields.dialog?.id === 'permission' ? fields.dialog : undefined;

  const actions = {
    rewind: (entry: string) => {
      const text = jinion.rewind(id, entry);

      if (text !== undefined) setDrafts((all) => ({ ...all, [id]: text }));
    },
    openChange: (path: string) => {
      setPanelFile((files) => ({ ...files, [id]: path }));
      setPanel((panel) => ({ ...panel, open: true, tab: 'changes' }));
    },
  };

  return (
    <Conversation
      footer={
        <>
          {fields.working && state.todos.length > 0 && (
            <div className="mb-2 rounded-xl border border-line bg-sidebar/60 px-3.5 py-2.5">
              <TodoList groups={state.todos} />
            </div>
          )}
          <Queued messages={fields.queue.map((message) => message.text)} onRemove={(index) => jinion.unqueue(id, index)} />
          {dialog ? (
            <PermissionPanel request={dialog.request} onAnswer={(decision) => jinion.answer(id, decision)} />
          ) : (
            <Composer id={id} snapshot={session} />
          )}
        </>
      }
    >
      {started ? (
        <>
          <Entries state={state} actions={actions} />
          {fields.working && state.busySince && <Working since={state.busySince} />}
        </>
      ) : (
        <Start project={jinion.project.name} onPick={(text) => jinion.submit(id, text)} />
      )}
      <div ref={end} />
    </Conversation>
  );
}

function Start({ project, onPick }: { project: string; onPick: (text: string) => void }) {
  return (
    <div className="flex flex-col items-start gap-5 pt-[18vh]">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">What should we work on in {project}?</h1>
        <p className="text-muted">The agent reads the code, changes it and checks its work. You steer.</p>
      </div>
      <div className="flex flex-col gap-1">
        {suggestions.map((text) => (
          <button
            key={text}
            type="button"
            onClick={() => onPick(text)}
            className="group flex cursor-default items-center gap-2 rounded-lg px-2 py-1.5 -ml-2 text-ink/80 hover:bg-hover hover:text-ink"
          >
            {text}
            <ArrowUpRight className="size-3.5 text-faint opacity-0 group-hover:opacity-100" />
          </button>
        ))}
      </div>
    </div>
  );
}

function Empty({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted">
      No thread is open.
      <button type="button" onClick={onNew} className="cursor-default rounded-full bg-primary px-3 py-1 text-small text-on-primary">
        New thread
      </button>
    </div>
  );
}
