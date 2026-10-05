import { useAtom } from 'jotai';
import { CircleAlert, X } from 'lucide-react';
import { useCore } from '../state/session.js';

/** Why the last thing the user did failed, above the window's middle until dismissed. */
export function Problem() {
  const core = useCore();
  const [problem, setProblem] = useAtom(core.problemAtom);

  if (!problem) return null;

  return (
    <div className="mx-auto mt-2 flex w-full max-w-170 items-start gap-2 rounded-xl border border-removed/30 bg-removed-soft px-3.5 py-2.5 text-ink">
      <CircleAlert className="mt-0.5 size-4 shrink-0 text-removed" />
      <span className="min-w-0 flex-1">{problem}</span>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => setProblem(undefined)}
        className="flex size-5 shrink-0 cursor-default items-center justify-center rounded-md text-muted hover:bg-removed/10 hover:text-ink"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
