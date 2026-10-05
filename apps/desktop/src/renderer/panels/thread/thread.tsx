import type { AgentMode } from '@jinion/core/agent/agent';
import { MODES } from '@jinion/core/agent/modes';
import { AskPanel, Conversation, PermissionPanel, PlanPanel, Queued, TodoList, Working } from '@jinion/ui/chat';
import { useSetAtom } from 'jotai';
import { ArrowUpRight } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { panelAtom, panelFileAtom } from '../../state/app.js';
import { useActiveSession, useCore } from '../../state/session.js';
import { Composer } from './composer.js';
import { Entries } from './entries.js';

const SUGGESTIONS = ['Explain how this project is put together', 'Find a bug and fix it', 'Add tests for the code that has none'];

export function Thread() {
  const core = useCore();
  const session = useActiveSession();
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

  if (!session) return <Empty onNew={() => void core.open()} />;

  const { id, state, fields } = session;
  const started = state.entries.some((entry) => entry.kind === 'user');
  const { dialog } = fields;
  const suggestions = core.examples.length > 0 ? core.examples : SUGGESTIONS;

  const actions = {
    rewind: (entry: string) => void core.rewind(id, entry),
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
          <Queued messages={fields.queue.map((message) => message.text)} />
          {dialog?.id === 'permission' && <PermissionPanel request={dialog.request} onAnswer={(decision) => void core.answerPermission(id, decision)} />}
          {dialog?.id === 'ask' && (
            <AskPanel
              key={dialog.questions.map((question) => question.id).join()}
              questions={dialog.questions}
              onAnswer={(answers) => void core.answerQuestions(id, answers)}
            />
          )}
          {dialog?.id === 'plan' && (
            <PlanPanel
              options={dialog.modes.map((mode) => ({ id: mode, label: `Yes, in ${MODES[mode].name}` }))}
              onDecide={(decision) =>
                void core.answerPlan(id, decision.approve ? { approve: true, mode: decision.option as AgentMode } : decision)
              }
            />
          )}
          {!dialog && <Composer id={id} snapshot={session} />}
        </>
      }
    >
      {started ? (
        <>
          <Entries state={state} actions={actions} />
          {fields.working && state.busySince && <Working since={state.busySince} />}
        </>
      ) : (
        <Start project={core.project.name} suggestions={suggestions} onPick={(text) => void core.submit(id, text)} />
      )}
      <div ref={end} />
    </Conversation>
  );
}

function Start({ project, suggestions, onPick }: { project: string; suggestions: string[]; onPick: (text: string) => void }) {
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
