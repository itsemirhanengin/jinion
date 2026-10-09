'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Users } from 'lucide-react';
import { type DetailNav, DetailHeader } from '@/components/detail/detail-header';
import { DetailTabs } from '@/components/detail/detail-tabs';
import { CopyButton, DetailBody, DetailTitle, Facts, Reference, SideSection } from '@/components/detail/parts';
import { type Stat, StatStrip } from '@/components/detail/stat-strip';
import { Timeline, type TimelineItem } from '@/components/detail/timeline';
import { FeedbackList } from '@/components/feedback/feedback-list';
import { TurnTable } from '@/components/turns/turn-table';
import { StatusBadge } from '@/components/ui/status-badge';
import type { DayActivity } from '@/lib/activity';
import type { Feedback, Turn, UserSummary } from '@/lib/data';
import { formatAgo, formatCompact, formatCount, formatDate } from '@/lib/format';
import { CLIENTS, SIGNALS } from '@/lib/labels';

type Tab = 'activity' | 'turns' | 'feedback';

export function UserDetailView({
  user,
  days,
  recent,
  turnCount,
  projects,
  tokens,
  feedback,
  figures,
  nav,
  quiet,
}: {
  user: UserSummary;
  quiet: boolean;
  days: DayActivity[];
  recent: Turn[];
  turnCount: number;
  projects: [string, number][];
  tokens: { input: number; output: number; cached: number };
  feedback: Feedback[];
  figures: Stat[];
  nav: DetailNav;
}) {
  const [tab, setTab] = useState<Tab>('activity');

  return (
    <>
      <DetailHeader section="Users" icon={Users} nav={nav} itemNoun="person" />

      <DetailBody
        aside={
          <>
            <SideSection title="Account">
              <Facts
                rows={[
                  {
                    label: 'Email',
                    value: (
                      <span className="flex items-center justify-end gap-1">
                        <a href={`mailto:${user.email}`} className="truncate underline decoration-neutral-950/20 underline-offset-2 hover:decoration-neutral-950">
                          {user.email}
                        </a>
                        <CopyButton value={user.email} label="Copy the email" />
                      </span>
                    ),
                  },
                  {
                    label: 'Invite',
                    value: (
                      <Link href={`/invites?q=${user.invite}`} className="hover:underline">
                        <Reference>{user.invite}</Reference>
                      </Link>
                    ),
                  },
                  { label: 'Joined', value: formatDate(user.joinedAt) },
                  { label: 'Last seen', value: user.lastSeenAt ? formatAgo(user.lastSeenAt) : 'Never' },
                ]}
              />
            </SideSection>
            <SideSection title="Setup">
              <Facts
                rows={[
                  { label: 'Version', value: user.version },
                  { label: 'Device', value: user.device },
                  { label: 'Client', value: user.clients.map((client) => CLIENTS[client]).join(' · ') || '—' },
                  { label: 'Agent', value: user.backends.join(' · ') || '—' },
                ]}
              />
            </SideSection>
            <SideSection title="Projects">
              <Facts rows={projects.map(([project, count]) => ({ label: project, value: <span className="tabular-nums">{formatCount(count)}</span> }))} />
            </SideSection>
            <SideSection title="Tokens this week">
              <Facts
                rows={[
                  { label: 'Input', value: formatCompact(tokens.input) },
                  { label: 'Output', value: formatCompact(tokens.output) },
                  { label: 'From cache', value: formatCompact(tokens.cached) },
                ]}
              />
            </SideSection>
          </>
        }
      >
        <DetailTitle
          title={user.name}
          badges={<StatusBadge tone={quiet ? 'amber' : 'green'}>{quiet ? 'Gone quiet' : 'Active'}</StatusBadge>}
          subtitle={`Joined ${formatDate(user.joinedAt)} · ${formatCount(turnCount)} turns in all`}
        />

        <StatStrip stats={figures} />

        <div className="flex flex-col gap-4">
          <DetailTabs
            label="Sections"
            value={tab}
            onChange={setTab}
            tabs={[
              { id: 'activity', label: 'Activity' },
              { id: 'turns', label: 'Turns', count: turnCount },
              { id: 'feedback', label: 'Feedback', count: feedback.length },
            ]}
          />
          {tab === 'activity' && <Timeline items={timelineOf(user, days, feedback)} />}
          {tab === 'turns' && <TurnTable turns={recent} emptyText={`${user.name} hasn't run a turn yet.`} />}
          {tab === 'feedback' && <FeedbackList items={feedback} emptyText={`${user.name} hasn't sent any feedback.`} />}
        </div>
      </DetailBody>
    </>
  );
}

function timelineOf(user: UserSummary, days: DayActivity[], feedback: Feedback[]): TimelineItem[] {
  const items: TimelineItem[] = [
    ...days.map((day) => ({
      key: day.day,
      at: day.lastAt,
      content: (
        <>
          Ran <span className="font-medium tabular-nums">{formatCount(day.turns)}</span> turns in {day.projects.join(', ')}
          {day.problems > 0 && (
            <span className="text-neutral-500">
              {' '}
              · {formatCount(day.problems)} with a problem (
              {day.signals
                .slice(0, 3)
                .map(([signal, count]) => `${count} ${SIGNALS[signal].label.toLocaleLowerCase('en')}`)
                .join(', ')}
              )
            </span>
          )}
        </>
      ),
    })),
    ...feedback.map((item) => ({
      key: item.id,
      at: item.at,
      byPerson: true,
      note: item.note,
      content: (
        <>
          <span className="font-medium">{user.name}</span>{' '}
          {item.kind === 'disliked' ? 'disliked a reply' : item.kind === 'liked' ? 'liked a reply' : 'sent a note'}
        </>
      ),
    })),
    {
      key: 'joined',
      at: user.joinedAt,
      byPerson: true,
      content: (
        <>
          <span className="font-medium">{user.name}</span> joined with the invite <Reference>{user.invite}</Reference>
        </>
      ),
    },
  ];

  return items.sort((a, b) => b.at.localeCompare(a.at));
}
