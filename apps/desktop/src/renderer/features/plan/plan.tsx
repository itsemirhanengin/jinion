import type { AgentMode } from '@jinion/core/agent/agent';
import { MODES } from '@jinion/core/agent/modes';
import { Button, ChoiceMenu, classNames, MarkdownEditor, Waiting } from '@jinion/ui';
import { type Feature, useWorkbench } from '@jinion/workbench';
import { useAtom } from 'jotai';
import { ChevronDown, ClipboardList, X } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { planEditsAtom } from '../../state/plans.js';
import { useCore, useSession } from '../../state/session.js';
import { openPlan, plansOf, planTab, planTitle } from './plans.js';

/** A plan as a tab of its own: read and changed as a document, and answered from the bar over it. */
export function plan(): Feature {
  return { id: 'plan', tabs: [{ kind: 'plan', Title: PlanTitle, Mark: () => <ClipboardList className="size-4 shrink-0 text-faint" />, Content: PlanTab }] };
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
  const answer = (decision: { approve: true; mode: AgentMode } | { approve: false; note?: string }) =>
    core.act(core.answerPlan(session, decision.approve ? { ...decision, plan: edited } : decision));

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-line px-5">
        {waiting ? <Waiting /> : <ClipboardList className="size-4 shrink-0 text-faint" />}
        <span className="shrink-0 text-ink">{waiting ? 'Waiting for you' : latest ? 'Answered' : 'An earlier plan'}</span>
        {plans.length > 1 ? (
          <ChoiceMenu
            value={shown.id}
            onChange={(picked) => openPlan(workbench, session, picked)}
            groups={[{ choices: plans.map((each, at) => ({ value: each.id, label: `Plan ${at + 1}`, description: planTitle(each.plan) })) }]}
            trigger={
              <button type="button" className="flex h-7 min-w-0 cursor-default items-center gap-1 rounded-lg px-1.5 text-faint hover:bg-shade hover:text-ink">
                <span className="truncate">
                  Plan {index + 1} of {plans.length}
                </span>
                <ChevronDown className="size-3.5 shrink-0" />
              </button>
            }
          />
        ) : (
          <span className="min-w-0 truncate text-faint">{snapshot.state.title}</span>
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
        {waiting && <Answer modes={dialog.modes} onAnswer={answer} />}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-176 px-8 pt-6 pb-16">
          <MarkdownEditor key={`${shown.id}:${round}`} markdown={edited ?? shown.plan} editable={waiting} onChange={(text) => text !== undefined && setEdited(text)} />
        </div>
      </div>
    </div>
  );
}

/** Keep planning, with what should change, or build in the first mode offered, or another from the menu beside it. */
function Answer({ modes, onAnswer }: { modes: AgentMode[]; onAnswer: (decision: { approve: true; mode: AgentMode } | { approve: false; note?: string }) => void }) {
  const [note, setNote] = useState<string>();

  const [first] = modes;

  const keepPlanning = (event: FormEvent) => {
    event.preventDefault();
    onAnswer({ approve: false, note: note?.trim() || undefined });
  };

  if (note !== undefined) {
    return (
      <form className="flex min-w-0 flex-1 items-center justify-end gap-2" onSubmit={keepPlanning}>
        <input
          ref={(field) => field?.focus()}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          onKeyDown={(event) => event.key === 'Escape' && setNote(undefined)}
          placeholder="What should change in the plan?"
          className="h-8 w-full max-w-96 min-w-0 rounded-lg bg-background px-3 ring-1 ring-edge outline-none placeholder:text-faint focus:ring-primary/40"
        />
        <Button type="submit" variant="primary" size="small">
          Send
        </Button>
      </form>
    );
  }

  return (
    <>
      <Button size="small" onClick={() => setNote('')}>
        Keep planning
      </Button>
      {first && (
        <span className="inline-flex">
          <Button variant="primary" size="small" className="rounded-r-none" onClick={() => onAnswer({ approve: true, mode: first })}>
            Build in {MODES[first].name}
          </Button>
          <ChoiceMenu
            value={first}
            onChange={(mode) => onAnswer({ approve: true, mode: mode as AgentMode })}
            groups={[{ label: 'Build in', choices: modes.map((mode) => ({ value: mode, label: MODES[mode].name, description: MODES[mode].description })) }]}
            trigger={
              <Button variant="primary" size="icon" className="w-6 rounded-l-none border-l border-on-primary/20" aria-label="Build in another mode">
                <ChevronDown />
              </Button>
            }
          />
        </span>
      )}
    </>
  );
}

function Note({ children }: { children: string }) {
  return <p className="mx-auto max-w-120 px-8 py-16 text-center text-pretty text-muted">{children}</p>;
}
