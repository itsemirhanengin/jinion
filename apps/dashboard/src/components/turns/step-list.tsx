import type { TurnStep } from '@/lib/data';
import { formatDuration } from '@/lib/format';
import { SIGNALS } from '@/lib/labels';

/** What happened in a turn, in order, on the same line and dots as a timeline; times count from the message. */
export function StepList({ steps }: { steps: TurnStep[] }) {
  return (
    <ol role="list" className="relative flex flex-col gap-3 before:absolute before:inset-y-1 before:left-1 before:w-px before:bg-neutral-950/10">
      {steps.map((step, index) => (
        <li key={index} className="relative flex gap-3 pl-6">
          <span aria-hidden="true" className={`absolute top-1.5 left-0 size-2 rounded-full ring-4 ring-white ${dot(step)}`} />
          <div className="min-w-0 flex-1">
            <p className={step.ok === false ? 'text-red-700' : 'text-neutral-800'}>
              {step.kind === 'signal' ? (
                <>
                  <span className="font-medium">{SIGNALS[step.label as keyof typeof SIGNALS]?.label ?? step.label}</span>
                  <span className="text-neutral-500"> · {SIGNALS[step.label as keyof typeof SIGNALS]?.description}</span>
                </>
              ) : (
                <>
                  <span className="font-medium">{step.label}</span>
                  {step.detail && <span className={step.kind === 'tool' ? 'font-mono text-xs/5 text-neutral-600' : 'text-neutral-600'}> {step.detail}</span>}
                  {step.ok === false && <span> · failed</span>}
                </>
              )}
            </p>
            {step.durationMs !== undefined && <p className="text-xs/5 text-neutral-500 tabular-nums">took {formatDuration(step.durationMs)}</p>}
          </div>
          <p className="whitespace-nowrap text-neutral-500 tabular-nums">+{formatDuration(step.offsetMs)}</p>
        </li>
      ))}
    </ol>
  );
}

function dot(step: TurnStep) {
  if (step.ok === false) return 'bg-red-600';
  if (step.kind === 'prompt' || step.kind === 'steer') return 'bg-neutral-950';
  if (step.kind === 'signal') return 'bg-amber-500';

  return 'bg-neutral-400';
}
