import { ChevronDown } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Button } from '../primitives/button.js';
import { ChoiceMenu } from '../primitives/choice-menu.js';
import type { PlanDecision, PlanOption } from './plan-panel.js';

export interface PlanAnswerProps {
  /** The ways to build, such as a permission mode each, the first the one Build takes. */
  options: PlanOption[];
  onDecide: (decision: PlanDecision) => void;
}

/**
 * What answers a plan, wherever it shows: Keep planning, which asks what should change, and Build in the first way, the
 * others in a menu beside it. Inside a container it shortens to fit, `Build in Auto` becoming `Build`.
 */
export function PlanAnswer({ options, onDecide }: PlanAnswerProps) {
  const [note, setNote] = useState<string>();

  const [first] = options;

  const keepPlanning = (event: FormEvent) => {
    event.preventDefault();
    onDecide({ approve: false, note: note?.trim() || undefined });
  };

  if (note !== undefined) {
    return (
      <form className="flex min-w-0 flex-1 items-center justify-end gap-2" onSubmit={keepPlanning}>
        <input
          ref={(field) => field?.focus()}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return;

            // Escape leaves the note, not the turn.
            event.stopPropagation();
            setNote(undefined);
          }}
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
    <span className="flex shrink-0 items-center gap-1">
      <Button size="small" onClick={() => setNote('')}>
        Keep planning
      </Button>
      {first && (
        <span className="inline-flex">
          <Button variant="primary" size="small" className="rounded-r-none" onClick={() => onDecide({ approve: true, option: first.id })}>
            <span>
              Build<span className="hidden @[22rem]:inline"> in {first.label}</span>
            </span>
          </Button>
          <ChoiceMenu
            value={first.id}
            onChange={(option) => onDecide({ approve: true, option })}
            groups={[{ label: 'Build in', choices: options.map((option) => ({ value: option.id, label: option.label, description: option.description })) }]}
            trigger={
              <Button variant="primary" size="icon" className="w-6 rounded-l-none border-l border-on-primary/20" aria-label="Build in another way">
                <ChevronDown />
              </Button>
            }
          />
        </span>
      )}
    </span>
  );
}
