import Link from 'next/link';
import { MessageSquareText, Target, Ticket, UserRoundX } from 'lucide-react';
import { formatAgo } from '@/lib/format';
import type { GoalCard } from '@/lib/goal-cards';
import type { Overview } from '@/lib/overview';

/** What waits on the admin today: feedback no one has read, goals heading the wrong way, people who went quiet. */
export function NeedsALook({ attention, goals }: { attention: Overview['attention']; goals: GoalCard[] }) {
  const names = new Map(attention.people);
  const atRisk = goals.filter((card) => card.track.status === 'at-risk');

  const items = [
    ...attention.feedback.map((item) => ({
      key: item.id,
      icon: MessageSquareText,
      href: '/feedback',
      title: `${names.get(item.user)} · ${item.kind === 'disliked' ? 'disliked a reply' : item.kind === 'liked' ? 'liked a reply' : 'sent a note'}`,
      detail: item.note ?? '',
    })),
    ...atRisk.map(({ goal }) => ({ key: goal.id, icon: Target, href: `/goals/${goal.id}`, title: `${goal.name} is at risk`, detail: "At this pace it won't reach its target." })),
    ...attention.quiet.map((person) => ({
      key: person.id,
      icon: UserRoundX,
      href: `/users/${person.id}`,
      title: `${person.name} went quiet`,
      detail: person.lastSeenAt ? `Last turn ${formatAgo(person.lastSeenAt)}.` : 'Never ran a turn.',
    })),
    ...(attention.waitingInvites > 0
      ? [
          {
            key: 'invites',
            icon: Ticket,
            href: '/invites?view=active',
            title: `${attention.waitingInvites} ${attention.waitingInvites === 1 ? 'invite waits' : 'invites wait'} to be used`,
            detail: 'Sent, but no one has joined with them yet.',
          },
        ]
      : []),
  ];

  if (items.length === 0) return <p className="py-6 text-center text-neutral-500">Nothing needs a look right now.</p>;

  return (
    <ul role="list" className="-mx-2 flex flex-col">
      {items.map((item) => (
        <li key={item.key}>
          <Link href={item.href} className="flex gap-3 rounded-lg px-2 py-2 hover:bg-neutral-950/4">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-neutral-950/5">
              <item.icon className="size-4 shrink-0 stroke-neutral-600" />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-medium">{item.title}</span>
              <span className="block truncate text-neutral-500">{item.detail}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
