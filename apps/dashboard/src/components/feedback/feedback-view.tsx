'use client';

import { useState } from 'react';
import { MessageSquareText } from 'lucide-react';
import { DetailTabs } from '@/components/detail/detail-tabs';
import { StatStrip } from '@/components/detail/stat-strip';
import { FeedbackList } from '@/components/feedback/feedback-list';
import { PageBody, PageHeader } from '@/components/page';
import { NOW } from '@/lib/clock';
import type { Feedback, FeedbackStatus } from '@/lib/data';
import { weekStart } from '@/lib/days';
import { formatCount } from '@/lib/format';

type View = 'review' | 'disliked' | 'liked' | 'note' | 'all';

const EMPTY: Record<View, string> = {
  review: 'Nothing waits for a review.',
  disliked: 'No one has disliked a reply.',
  liked: 'No one has liked a reply yet.',
  note: 'No one has sent a note.',
  all: 'No feedback yet.',
};

/** What people said, as an inbox: what waits for a look first, each item moved along once it has been read. */
export function FeedbackView({ items: initial, people }: { items: Feedback[]; people: [string, string][] }) {
  // A status set here stays on this page only, until the API keeps it.
  const [items, setItems] = useState(initial);
  const [view, setView] = useState<View>('review');

  const names = new Map(people);
  const thisWeek = items.filter((item) => Date.parse(item.at) >= weekStart(Date.parse(NOW)));
  const count = (test: (item: Feedback) => boolean) => items.filter(test).length;

  const shown = items.filter((item) => {
    if (view === 'review') return item.status === 'new';
    if (view === 'all') return true;

    return item.kind === view;
  });

  function setStatus(id: string, status: FeedbackStatus) {
    setItems((all) => all.map((item) => (item.id === id ? { ...item, status } : item)));
  }

  return (
    <>
      <PageHeader>
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <h1 className="flex items-center gap-1.5 self-center text-base/6 font-medium sm:text-sm/6">
            <MessageSquareText className="size-4 shrink-0 stroke-neutral-600" />
            Feedback
          </h1>
          <p className="truncate text-sm/6 text-neutral-500 tabular-nums sm:text-xs/6">
            {formatCount(items.length)} in all · {formatCount(count((item) => item.status === 'new'))} to review
          </p>
        </div>
      </PageHeader>

      <PageBody className="pb-24">
        <div className="mx-auto flex max-w-3xl flex-col gap-4 pt-4">
          <StatStrip
            stats={[
              { label: 'To review', value: count((item) => item.status === 'new'), hint: 'Feedback no one has read yet.' },
              { label: 'Disliked this week', value: thisWeek.filter((item) => item.kind === 'disliked').length, hint: 'Replies marked as bad in the last 7 days.' },
              { label: 'Liked this week', value: thisWeek.filter((item) => item.kind === 'liked').length, hint: 'Replies marked as good in the last 7 days.' },
              {
                label: 'Shared conversations',
                value: count((item) => item.shared !== undefined),
                hint: 'Feedback sent along with the conversation it is about, which is the only time we see what was said.',
              },
            ]}
          />
          <DetailTabs
            label="Feedback"
            value={view}
            onChange={setView}
            tabs={[
              { id: 'review', label: 'To review', count: count((item) => item.status === 'new') },
              { id: 'disliked', label: 'Disliked', count: count((item) => item.kind === 'disliked') },
              { id: 'liked', label: 'Liked', count: count((item) => item.kind === 'liked') },
              { id: 'note', label: 'Notes', count: count((item) => item.kind === 'note') },
              { id: 'all', label: 'All', count: items.length },
            ]}
          />
          <FeedbackList items={shown} people={names} emptyText={EMPTY[view]} onStatus={setStatus} />
        </div>
      </PageBody>
    </>
  );
}
