import type { ContextUsage as Usage } from '@jinion/core/agent/usage';
import { classNames, Popover, Spinner } from '@jinion/ui';
import { useEffect, useState } from 'react';
import { compact } from '../../lib/numbers.js';
import { useCore } from '../../state/session.js';

const AROUND = 2 * Math.PI * 6;

/** Under the composer, how full the context is; open, what fills it, as `/context` shows it. */
export function ContextUsage({ id, full, open, onOpenChange }: { id: string; full: number; open: boolean; onOpenChange: (open: boolean) => void }) {
  const core = useCore();

  const [usage, setUsage] = useState<Usage>();
  const [failed, setFailed] = useState<string>();

  useEffect(() => {
    if (!open) return;

    setFailed(undefined);
    core.context(id).then(setUsage, (error: Error) => setFailed(error.message));
  }, [open, id]);

  return (
    <Popover
      open={open}
      onOpenChange={onOpenChange}
      side="top"
      align="end"
      trigger={
        <button
          type="button"
          aria-label={`${full}% of context`}
          title={`${full}% of context`}
          className="flex h-6 shrink-0 cursor-default items-center gap-1.5 tabular-nums hover:text-ink data-popup-open:text-ink"
        >
          <Ring full={full} />
          {full}%
        </button>
      }
    >
      <div className="flex flex-col gap-0.5 p-1">
        {failed && <p className="px-2 py-1.5 text-pretty text-muted">{failed}</p>}
        {!usage && !failed && (
          <div className="flex items-center gap-2 px-2 py-1.5 text-muted">
            <Spinner />
            Reading the context
          </div>
        )}
        {usage && (
          <>
            <div className="flex items-baseline justify-between px-2 pt-1.5 pb-1">
              <span className="text-muted">Context</span>
              <span className="text-faint tabular-nums">
                {compact(usage.used)} of {compact(usage.window)} tokens
              </span>
            </div>
            {usage.categories
              .filter((category) => category.tokens > 0)
              .map((category) => (
                <div key={category.name} className="flex items-center gap-2 rounded-lg px-2 py-1">
                  <span className={classNames('min-w-0 flex-1 truncate', category.kind !== 'used' && 'text-muted')}>{category.name}</span>
                  <span className="shrink-0 text-faint tabular-nums">{compact(category.tokens)}</span>
                </div>
              ))}
            {usage.compactAt !== undefined && <p className="px-2 pt-1 pb-1.5 text-small text-muted">Compacts on its own at {compact(usage.compactAt)} tokens.</p>}
          </>
        )}
      </div>
    </Popover>
  );
}

/** How full the context is, as a ring filled that far. */
function Ring({ full }: { full: number }) {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5 shrink-0" aria-hidden>
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray={`${(Math.min(full, 100) / 100) * AROUND} ${AROUND}`} transform="rotate(-90 8 8)" />
    </svg>
  );
}
