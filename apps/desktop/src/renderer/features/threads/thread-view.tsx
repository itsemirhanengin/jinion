import type { AgentMode } from '@jinion/core/agent/agent';
import { MODES } from '@jinion/core/agent/modes';
import { AskPanel, Conversation, PermissionPanel, PlanPanel, Queued, TodoList, Working } from '@jinion/ui/chat';
import { useWorkbench } from '@jinion/workbench';
import { useEffect, useRef } from 'react';
import { Problem } from '../../panels/problem.js';
import { useCore, useSession } from '../../state/session.js';
import { openChange } from '../changes/changes.js';
import { Composer } from './composer.js';
import { Entries } from './entries.js';

/** A thread's tab: its conversation, and the composer floating over its end. */
export function ThreadView({ id }: { id: string }) {
  const core = useCore();
  const workbench = useWorkbench();
  const session = useSession(core, id);
  const end = useRef<HTMLDivElement>(null);
  const atEnd = useRef(true);

  const started = session?.state.entries.some((entry) => entry.kind === 'user') ?? false;

  useEffect(() => {
    const node = end.current;
    if (!node) return;

    const observer = new IntersectionObserver(([seen]) => {
      atEnd.current = seen?.isIntersecting ?? true;
    });

    observer.observe(node);
    node.scrollIntoView({ block: 'end' });

    return () => observer.disconnect();
  }, [id, started]);

  // Follows the conversation as it grows, as long as the user hasn't scrolled away from its end.
  useEffect(() => {
    if (atEnd.current) end.current?.scrollIntoView({ block: 'end' });
  }, [session?.seq, session?.fields.working]);

  if (!session) return null;

  const { state, fields } = session;
  const { dialog } = fields;

  const actions = {
    rewind: (entry: string) => core.act(core.rewind(id, entry)),
    openChange: (path: string) => openChange(workbench, id, path),
  };

  // What takes the composer's place while the agent asks, the composer otherwise.
  const bottom = (
    <>
      {fields.working && state.todos.length > 0 && (
        <div className="mb-2 rounded-xl bg-floating px-4 py-3 shadow-xs ring-1 ring-edge">
          <TodoList groups={state.todos} />
        </div>
      )}
      <Queued messages={fields.queue.map((message) => message.text)} />
      {dialog?.id === 'permission' && <PermissionPanel request={dialog.request} onAnswer={(decision) => core.act(core.answerPermission(id, decision))} />}
      {dialog?.id === 'ask' && (
        <AskPanel
          key={dialog.questions.map((question) => question.id).join()}
          questions={dialog.questions}
          onAnswer={(answers) => core.act(core.answerQuestions(id, answers))}
        />
      )}
      {dialog?.id === 'plan' && (
        <PlanPanel
          options={dialog.modes.map((mode) => ({ id: mode, label: `Yes, in ${MODES[mode].name}` }))}
          onDecide={(decision) => core.act(core.answerPlan(id, decision.approve ? { approve: true, mode: decision.option as AgentMode } : decision))}
        />
      )}
      {!dialog && <Composer id={id} snapshot={session} large={!started} />}
    </>
  );

  // A thread that hasn't started is only its composer, larger, in the middle.
  if (!started) {
    return (
      <div className="flex h-full items-center justify-center overflow-y-auto px-8 pb-[8vh]">
        <div className="flex w-full max-w-176 flex-col gap-3">
          <Problem />
          {bottom}
        </div>
      </div>
    );
  }

  return (
    <Conversation footer={bottom}>
      <Problem />
      <Entries state={state} actions={actions} />
      {fields.working && state.busySince && <Working since={state.busySince} />}
      <div ref={end} />
    </Conversation>
  );
}
