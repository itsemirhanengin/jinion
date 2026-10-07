import { ClipboardList } from 'lucide-react';
import { PlanAnswer } from './plan-answer.js';

export interface PlanOption {
  id: string;
  label: string;
  description?: string;
}

export type PlanDecision = { approve: true; option: string } | { approve: false; note?: string };

export interface PlanPanelProps {
  /** The ways to go on and build, such as a permission mode each. */
  options: PlanOption[];
  onDecide: (decision: PlanDecision) => void;
  /** Shows the plan, open beside the conversation or opened again. */
  onShow?: () => void;
}

/** In the composer's place while a plan waits: where to read it, and the same answer its tab has. */
export function PlanPanel({ options, onDecide, onShow }: PlanPanelProps) {
  return (
    <div className="@container flex items-center gap-2 rounded-2xl bg-floating py-3 pr-3 pl-4 shadow-sm ring-1 ring-edge">
      <ClipboardList className="size-4 shrink-0 text-primary" />
      <span className="shrink-0 font-medium">The plan is ready</span>
      {onShow && (
        <button type="button" onClick={onShow} className="min-w-0 cursor-default truncate text-faint hover:text-ink">
          Open on the right
        </button>
      )}
      <div className="flex-1" />
      <PlanAnswer options={options} onDecide={onDecide} />
    </div>
  );
}
