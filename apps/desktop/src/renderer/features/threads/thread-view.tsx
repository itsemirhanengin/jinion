import type { AgentMode } from '@jinion/core/agent/agent';
import { AskPanel, Conversation, PermissionPanel, PlanPanel, Queued, TodoBar, Working } from '@jinion/ui/chat';
import { useWorkbench } from '@jinion/workbench';
import { useAtomValue, useStore } from 'jotai';
import { useEffect } from 'react';
import { fileReference } from '../../lib/references.js';
import { Problem } from '../../panels/problem.js';
import { draftImagesAtom, draftsAtom } from '../../state/app.js';
import { draftCommentsAtom } from '../../state/comments.js';
import { planEditsAtom } from '../../state/plans.js';
import { useCore, useSession } from '../../state/session.js';
import { openChanges } from '../changes/changes.js';
import { takeQueued } from '../comments/queued.js';
import { openFile } from '../files/files.js';
import { openPlan, planOptions, plansOf, showPlanBeside } from '../plan/plans.js';
import { Composer } from './composer.js';
import { draftOf } from './draft.js';
import { Entries } from './entries.js';

/** A thread's tab: its conversation, and the composer floating over its end. */
export function ThreadView({ id }: { id: string }) {
  const core = useCore();
  const workbench = useWorkbench();
  const store = useStore();
  const session = useSession(core, id);
  const files = useAtomValue(core.filesAtom);

  const started = session?.state.entries.some((entry) => entry.kind === 'user') ?? false;

  // The project's files tell which code in the agent's words names a file.
  useEffect(() => {
    if (files.length === 0) core.act(core.refreshFiles(id));
  }, [core, id]);

  // A plan waiting for the user opens beside the conversation, to be read and changed there.
  const waitingPlan = session?.fields.dialog?.id === 'plan' ? session && plansOf(session.state.entries).at(-1)?.id : undefined;

  useEffect(() => {
    if (waitingPlan) showPlanBeside(workbench, id, waitingPlan);
  }, [workbench, id, waitingPlan]);

  if (!session) return null;

  const { state, fields } = session;
  const { dialog } = fields;
  const latestPlan = plansOf(state.entries).at(-1);

  const actions = {
    rewind: (entry: string) => core.act(core.rewind(id, entry)),
    openPlan: (entry: string) => openPlan(workbench, id, entry),
    openChange: (path: string) => openChanges(core, workbench, id, path),
    openFile: (path: string, lines?: string) => openFile(core, workbench, id, path, lines),
    openCode: (code: string) => {
      const file = fileReference(code, files);

      return file && (() => openFile(core, workbench, id, file.path, file.lines));
    },
  };

  // What is typed already stays, after the message that comes back.
  const editQueued = async (index: number) => {
    const submission = await core.unqueue(id, fields.queue[index]!.text).catch((error: Error) => core.client.store.set(core.problemAtom, error.message));
    if (!submission) return;

    const queued = takeQueued(store, id, submission.text);

    const { text, images } = draftOf(
      queued ? { ...submission, text: queued.typed } : submission,
      (store.get(draftImagesAtom)[id] ?? []).map((image) => image.name),
    );

    const typed = store.get(draftsAtom)[id]?.trim();

    store.set(draftsAtom, (drafts) => ({ ...drafts, [id]: typed && text ? `${text}\n${typed}` : text || typed || '' }));
    store.set(draftImagesAtom, (all) => ({ ...all, [id]: [...(all[id] ?? []), ...images] }));
    if (queued) store.set(draftCommentsAtom, (all) => ({ ...all, [id]: [...(all[id] ?? []), ...queued.comments] }));
  };

  const removeQueued = (index: number) => {
    const { text } = fields.queue[index]!;

    takeQueued(store, id, text);
    core.act(core.unqueue(id, text));
  };

  // The running turn's todos are the first line inside whichever box is at the bottom.
  const todos = fields.working && state.todos.length > 0 ? <TodoBar groups={state.todos} /> : undefined;

  // What takes the composer's place while the agent asks, the composer otherwise.
  const bottom = (
    <>
      <Queued messages={fields.steering ?? []} label="not read yet" />
      <Queued messages={fields.queue.map((message) => message.text)} onEdit={editQueued} onRemove={removeQueued} />
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
          options={planOptions(dialog.modes)}
          onDecide={(decision) => {
            // Changes made in the plan's tab go with an answer given here too.
            const edited = latestPlan && store.get(planEditsAtom)[latestPlan.id];

            core.act(core.answerPlan(id, decision.approve ? { approve: true, mode: decision.option as AgentMode, plan: edited } : decision));
          }}
          onShow={latestPlan && (() => openPlan(workbench, id, latestPlan.id))}
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
      {/* While it asks the user, the agent waits rather than works. */}
      {fields.working && !dialog && state.busySince && <Working since={state.busySince} />}
    </Conversation>
  );
}
