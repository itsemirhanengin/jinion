import { ClipboardCheck } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Button } from '../primitives/button.js';

export interface PlanOption {
  id: string;
  label: string;
}

export type PlanDecision = { approve: true; option: string } | { approve: false; note?: string };

export interface PlanPanelProps {
  /** The ways to go on and build, such as a permission mode each. */
  options: PlanOption[];
  onDecide: (decision: PlanDecision) => void;
}

/** Whether to build from the plan the agent wrote above, in the composer's place. */
export function PlanPanel({ options, onDecide }: PlanPanelProps) {
  const [note, setNote] = useState<string>();

  const keepPlanning = (event: FormEvent) => {
    event.preventDefault();
    onDecide({ approve: false, note: note?.trim() || undefined });
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-accent/40 bg-raised p-4 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
      <div className="flex items-center gap-2 font-medium">
        <ClipboardCheck className="size-4 text-accent" />
        Build from this plan?
      </div>
      {note === undefined ? (
        <div className="flex flex-wrap items-center gap-2">
          {options.map((option, index) => (
            <Button key={option.id} variant={index === 0 ? 'primary' : 'outline'} size="small" onClick={() => onDecide({ approve: true, option: option.id })}>
              {option.label}
            </Button>
          ))}
          <Button size="small" onClick={() => setNote('')}>
            No, keep planning
          </Button>
        </div>
      ) : (
        <form className="flex items-center gap-2" onSubmit={keepPlanning}>
          <input
            ref={(field) => field?.focus()}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="What should change in the plan?"
            className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-canvas px-3 outline-none focus:border-ink/30"
          />
          <Button type="submit" variant="primary" size="small">
            Send
          </Button>
        </form>
      )}
    </div>
  );
}
