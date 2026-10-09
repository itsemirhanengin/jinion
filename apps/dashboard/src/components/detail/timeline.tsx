'use client';

import { useState } from 'react';
import { ghostButton } from '@/components/data-table/buttons';
import { formatDate, formatTime } from '@/lib/format';

export type TimelineItem = {
  key: string;
  at: string;
  content: React.ReactNode;
  /** Something a person did, drawn with a darker dot; what the system recorded gets a lighter one. */
  byPerson?: boolean;
  /** Quoted under the item, e.g. what someone wrote. */
  note?: string;
};

const PAGE = 30;

/** An activity feed grouped by day, newest first, a page at a time. */
export function Timeline({ items }: { items: TimelineItem[] }) {
  const [shown, setShown] = useState(PAGE);

  const days: { day: string; items: TimelineItem[] }[] = [];

  for (const item of items.slice(0, shown)) {
    const day = formatDate(item.at);
    const last = days.at(-1);

    if (last?.day === day) last.items.push(item);
    else days.push({ day, items: [item] });
  }

  if (items.length === 0) return <p className="py-12 text-center text-neutral-500">Nothing has happened yet.</p>;

  return (
    <div className="flex flex-col gap-4">
      <ol role="list" className="relative flex flex-col gap-4 before:absolute before:inset-y-1 before:left-1 before:w-px before:bg-neutral-950/10">
        {days.map(({ day, items: ofDay }) => (
          <li key={day} className="flex flex-col gap-3">
            <p className="pl-6 text-xs/5 text-neutral-500">{day}</p>
            <ol role="list" className="flex flex-col gap-3">
              {ofDay.map((item) => (
                <li key={item.key} className="relative flex gap-3 pl-6">
                  <span
                    aria-hidden="true"
                    className={`absolute top-1.5 left-0 size-2 rounded-full ring-4 ring-white ${item.byPerson ? 'bg-neutral-950' : 'bg-neutral-400'}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-neutral-800">{item.content}</div>
                    {item.note && <p className="mt-1.5 rounded-lg bg-neutral-950/4 px-3 py-2 whitespace-pre-line">{item.note}</p>}
                  </div>
                  <p className="whitespace-nowrap text-neutral-500 tabular-nums">{formatTime(item.at)}</p>
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ol>
      {items.length > shown && (
        <button type="button" onClick={() => setShown(shown + PAGE)} className={`${ghostButton} self-start text-neutral-700`}>
          Show older
        </button>
      )}
    </div>
  );
}
