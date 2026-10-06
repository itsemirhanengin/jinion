import type { AgentMode } from '@jinion/core/agent/agent';
import { MODES } from '@jinion/core/agent/modes';
import { AskPanel, Conversation, PermissionPanel, PlanPanel, Queued, TodoBar, Working } from '@jinion/ui/chat';
import { useWorkbench } from '@jinion/workbench';
import { useAtomValue } from 'jotai';
import { useEffect } from 'react';
import { fileReference } from '../../lib/references.js';
import { Problem } from '../../panels/problem.js';
import { useCore, useSession } from '../../state/session.js';
import { openChanges } from '../changes/changes.js';
import { openFile } from '../files/files.js';
import { Composer } from './composer.js';
import { Entries } from './entries.js';

/** A thread's tab: its conversation, and the composer floating over its end. */
export function ThreadView({ id }: { id: string }) {
  const core = useCore();
  const workbench = useWorkbench();
  const session = useSession(core, id);
  const files = useAtomValue(core.filesAtom);

  const started = session?.state.entries.some((entry) => entry.kind === 'user') ?? false;

  // The project's files tell which code in the agent's words names a file.
  useEffect(() => {
    if (files.length === 0) core.act(core.refreshFiles(id));
  }, [core, id]);

  if (!session) return null;

  const { state, fields } = session;
  const { dialog } = fields;

  const actions = {
    rewind: (entry: string) => core.act(core.rewind(id, entry)),
    openChange: (path: string) => openChanges(core, workbench, id, path),
    openFile: (path: string, lines?: string) => openFile(core, workbench, id, path, lines),
    openCode: (code: string) => {
      const file = fileReference(code, files);

      return file && (() => openFile(core, workbench, id, file.path, file.lines));
    },
  };

  // The running turn's todos are the first line inside whichever box is at the bottom.
  const todos = fields.working && state.todos.length > 0 ? <TodoBar groups={state.todos} /> : undefined;

  // What takes the composer's place while the agent asks, the composer otherwise.
  const bottom = (
    <>
      <Queued messages={fields.queue.map((message) => message.text)} />
      {dialog?.id === 'permission' && <PermissionPanel request={dialog.request} onAnswer={(decision) => core.act(core.answerPermission(id, decision))} />}
      {dialog?.id === 'ask' && (
        <AskPanel
          key={dialog.questions.map((question) => question.id).join()}
          questions={dialog.questions}
          header={todos}
          onAnswer={(answers) => core.act(core.answerQuestions(id, answers))}
        />
      )}
      {dialog?.id === 'plan' && (
        <PlanPanel
          options={dialog.modes.map((mode) => ({ id: mode, label: `Yes, in ${MODES[mode].name}` }))}
          onDecide={(decision) => core.act(core.answerPlan(id, decision.approve ? { approve: true, mode: decision.option as AgentMode } : decision))}
        />
      )}
      {!dialog && <Composer id={id} snapshot={session} large={!started} header={todos} />}
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
      <Entries state={state} working={fields.working} actions={actions} />
      {fields.working && state.busySince && <Working since={state.busySince} />}
    </Conversation>
  );
}
