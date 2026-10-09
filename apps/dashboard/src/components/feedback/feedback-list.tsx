import Link from 'next/link';
import { card, ghostButton } from '@/components/data-table/buttons';
import { StatusBadge } from '@/components/ui/status-badge';
import type { Feedback, FeedbackStatus } from '@/lib/data';
import { formatStamp } from '@/lib/format';
import { FEEDBACK_KINDS, FEEDBACK_STATUSES } from '@/lib/labels';

/** Feedback as cards, newest first: what was said, and the conversation when the person shared it. */
export function FeedbackList({
  items,
  people,
  emptyText,
  onStatus,
}: {
  items: Feedback[];
  people?: Map<string, string>;
  emptyText: string;
  /** Shows the buttons that move an item along: reviewed, resolved, or back to new. */
  onStatus?: (id: string, status: FeedbackStatus) => void;
}) {
  if (items.length === 0) return <p className="py-12 text-center text-neutral-500">{emptyText}</p>;

  return (
    <ul role="list" className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.id} className={`${card} flex flex-col gap-2 p-4`}>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={FEEDBACK_KINDS[item.kind].tone}>{FEEDBACK_KINDS[item.kind].label}</StatusBadge>
            {people && (
              <Link href={`/users/${item.user}`} className="font-medium hover:underline">
                {people.get(item.user)}
              </Link>
            )}
            <span className="text-neutral-500 tabular-nums">{formatStamp(item.at)}</span>
            <span className="ml-auto">
              <StatusBadge tone={FEEDBACK_STATUSES[item.status].tone}>{FEEDBACK_STATUSES[item.status].label}</StatusBadge>
            </span>
          </div>
          {item.note && <p>{item.note}</p>}
          {item.shared && (
            <div className="flex flex-col gap-1.5 rounded-lg bg-neutral-950/4 px-3 py-2">
              <p>
                <span className="text-neutral-500">Asked: </span>
                {item.shared.prompt}
              </p>
              <p>
                <span className="text-neutral-500">Replied: </span>
                {item.shared.reply}
              </p>
            </div>
          )}
          {(item.turn || onStatus) && (
            <div className="-mx-2 -mb-1 flex flex-wrap items-center gap-1">
              {item.turn && (
                <Link transitionTypes={['nav-forward']} href={`/turns/${item.turn}`} className={`${ghostButton} text-neutral-600 hover:text-neutral-950`}>
                  Open the turn
                </Link>
              )}
              {onStatus && (
                <span className="ml-auto flex gap-1">
                  {item.status === 'new' && (
                    <button type="button" onClick={() => onStatus(item.id, 'reviewed')} className={`${ghostButton} text-neutral-700`}>
                      Mark reviewed
                    </button>
                  )}
                  {item.status !== 'resolved' ? (
                    <button type="button" onClick={() => onStatus(item.id, 'resolved')} className={`${ghostButton} text-neutral-700`}>
                      Resolve
                    </button>
                  ) : (
                    <button type="button" onClick={() => onStatus(item.id, 'new')} className={`${ghostButton} text-neutral-700`}>
                      Reopen
                    </button>
                  )}
                </span>
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
