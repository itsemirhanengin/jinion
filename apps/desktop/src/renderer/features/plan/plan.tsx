import type { AgentMode } from '@jinion/core/agent/agent';

import { ChoiceMenu, classNames, MarkdownEditor, Waiting } from '@jinion/ui';
import { PlanAnswer, type PlanDecision } from '@jinion/ui/chat';
import { type Feature, useWorkbench } from '@jinion/workbench';
import { useAtom } from 'jotai';
import { ChevronDown, ClipboardList, X } from 'lucide-react';
import { useState } from 'react';
import { planEditsAtom } from '../../state/plans.js';
import { useCore, useSession } from '../../state/session.js';
import { openPlan, planOptions, plansOf, planTab, planTitle } from './plans.js';

/** A plan as a tab of its own: read and changed as a document, and answered from the bar over it. */
export function plan(): Feature {
  return { id: 'plan', tabs: [{ kind: 'plan', mode: 'agent', Title: PlanTitle, Mark: () => <ClipboardList className="size-4 shrink-0 text-faint" />, Content: PlanTab }] };
}

function PlanTitle({ id }: { id: string }) {
  const core = useCore();
  const { session, entry } = planTab(id);
  const snapshot = useSession(core, session);

  const shown = snapshot && plansOf(snapshot.state.entries).find((each) => each.id === entry);

  return `Plan: ${shown ? planTitle(shown.plan) : 'closed'}`;
}

function PlanTab({ id }: { id: string }) {
  const core = useCore();
  const workbench = useWorkbench();
  const { session, entry } = planTab(id);
  const snapshot = useSession(core, session);
  const [edits, setEdits] = useAtom(planEditsAtom);

  // A new editor once the changes are dropped, so it starts again from the agent's plan.
  const [round, setRound] = useState(0);

  if (!snapshot) return <Note>This thread is closed, and its plan with it.</Note>;

  const plans = plansOf(snapshot.state.entries);
  const index = plans.findIndex((each) => each.id === entry);
  const shown = plans[index];

  if (!shown) return <Note>This plan is no longer in the thread, as after going back to before it.</Note>;

  const { dialog } = snapshot.fields;
  const latest = index === plans.length - 1;
  const waiting = latest && dialog?.id === 'plan';
  const edited = edits[shown.id];

  const setEdited = (text: string | undefined) =>
    setEdits((all) => {
      const { [shown.id]: _, ...rest } = all;

      return text === undefined ? rest : { ...rest, [shown.id]: text };
    });

  const drop = () => {
    setEdited(undefined);
    setRound(round + 1);
  };

  // The changes stay once the plan is built, so the tab goes on showing what was built.
  const answer = (decision: PlanDecision) =>
    core.act(core.answerPlan(session, decision.approve ? { approve: true, mode: decision.option as AgentMode, plan: edited } : decision));

  return (
    <div className="flex h-full flex-col">
      <div className="@container flex h-12 shrink-0 items-center gap-2 border-b border-line px-4">
        {waiting ? <Waiting /> : <ClipboardList className="size-4 shrink-0 text-faint" />}
        <span className="min-w-0 truncate text-ink">{waiting ? 'Waiting for you' : latest ? 'Answered' : 'An earlier plan'}</span>
        {plans.length > 1 ? (
          <ChoiceMenu
            value={shown.id}
            onChange={(picked) => openPlan(workbench, session, picked)}
            groups={[{ choices: plans.map((each, at) => ({ value: each.id, label: `Plan ${at + 1}`, description: planTitle(each.plan) })) }]}
            trigger={
              <button type="button" className="hidden h-7 min-w-0 cursor-default items-center gap-1 rounded-lg px-1.5 text-faint hover:bg-shade hover:text-ink @[34rem]:flex">
                <span className="truncate">
                  Plan {index + 1} of {plans.length}
                </span>
                <ChevronDown className="size-3.5 shrink-0" />
              </button>
            }
          />
        ) : (
          <span className="hidden min-w-0 truncate text-faint @[34rem]:block">{snapshot.state.title}</span>
        )}
        {edited !== undefined && (
          <span className={classNames('flex shrink-0 items-center gap-0.5 rounded-[4px] bg-(--tint-blue) pl-1.5 text-small/5 text-(--tint-blue-ink)', !waiting && 'pr-1.5')}>
            Edited
            {waiting && (
              <button type="button" aria-label="Drop the changes" title="Drop the changes" onClick={drop} className="flex size-5 cursor-default items-center justify-center rounded-[4px] opacity-60 hover:opacity-100">
                <X className="size-3" />
              </button>
            )}
          </span>
        )}
        <div className="flex-1" />
        {waiting && <PlanAnswer options={planOptions(dialog.modes)} onDecide={answer} />}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-176 px-8 pt-6 pb-16">
          <MarkdownEditor key={`${shown.id}:${round}`} markdown={edited ?? shown.plan} editable={waiting} onChange={(text) => text !== undefined && setEdited(text)} />
        </div>
      </div>
    </div>
  );
}

function Note({ children }: { children: string }) {
  return <p className="mx-auto max-w-120 px-8 py-16 text-center text-pretty text-muted">{children}</p>;
}
