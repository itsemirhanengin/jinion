'use client';

import Link from 'next/link';
import { Workflow } from 'lucide-react';
import { type DetailNav, DetailHeader } from '@/components/detail/detail-header';
import { CopyButton, DetailBody, DetailTitle, Facts, Reference, Section, SideSection } from '@/components/detail/parts';
import { StatStrip } from '@/components/detail/stat-strip';
import { FeedbackList } from '@/components/feedback/feedback-list';
import { StepList } from '@/components/turns/step-list';
import { SignalBadges } from '@/components/turns/turn-table';
import { StatusBadge } from '@/components/ui/status-badge';
import type { Feedback, Turn, TurnStep } from '@/lib/data';
import { formatCompact, formatCount, formatDuration, formatStamp, formatTime } from '@/lib/format';
import { CATEGORIES, CLIENTS, OUTCOMES } from '@/lib/labels';

export function TurnDetailView({
  turn,
  person,
  session,
  feedback,
  nav,
}: {
  turn: Turn & { steps: TurnStep[] };
  person: { id: string; name: string };
  session: Pick<Turn, 'id' | 'startedAt' | 'outcome'>[];
  feedback: Feedback[];
  nav: DetailNav;
}) {
  const outcome = OUTCOMES[turn.outcome];

  return (
    <>
      <DetailHeader section="Turns" icon={Workflow} nav={nav} itemNoun="turn" />

      <DetailBody
        aside={
          <>
            <SideSection title="Turn">
              <Facts
                rows={[
                  {
                    label: 'Person',
                    value: (
                      <Link href={`/users/${person.id}`} className="underline decoration-neutral-950/20 underline-offset-2 hover:decoration-neutral-950">
                        {person.name}
                      </Link>
                    ),
                  },
                  { label: 'Project', value: turn.project },
                  { label: 'Started', value: formatStamp(turn.startedAt) },
                  { label: 'Agent', value: turn.backend },
                  { label: 'Model', value: turn.model },
                  { label: 'Client', value: CLIENTS[turn.client] },
                  { label: 'Kind of work', value: CATEGORIES[turn.category] },
                  {
                    label: 'Id',
                    value: (
                      <span className="flex items-center justify-end gap-1">
                        <Reference>{turn.id}</Reference>
                        <CopyButton value={turn.id} label="Copy the turn's id" />
                      </span>
                    ),
                  },
                ]}
              />
            </SideSection>
            <SideSection title="This session" aside={<span className="text-neutral-500 tabular-nums">{formatCount(session.length)}</span>}>
              <ol role="list" className="flex flex-col gap-1">
                {session.map((other) => (
                  <li key={other.id} className="flex items-center justify-between gap-3">
                    {other.id === turn.id ? (
                      <span className="font-medium tabular-nums">{formatTime(other.startedAt)} · this turn</span>
                    ) : (
                      <Link href={`/turns/${other.id}`} className="tabular-nums hover:underline">
                        {formatTime(other.startedAt)}
                      </Link>
                    )}
                    <StatusBadge tone={OUTCOMES[other.outcome].tone}>{OUTCOMES[other.outcome].label}</StatusBadge>
                  </li>
                ))}
              </ol>
            </SideSection>
          </>
        }
      >
        <DetailTitle
          title={`Turn in ${turn.project}`}
          badges={
            <>
              <StatusBadge tone={outcome.tone}>{outcome.label}</StatusBadge>
              <SignalBadges signals={turn.signals} dashWhenNone={false} />
            </>
          }
          subtitle={`${person.name} · ${formatStamp(turn.startedAt)} · ${turn.model} · ${CLIENTS[turn.client]}`}
        />

        <StatStrip
          stats={[
            { label: 'Took', value: formatDuration(turn.durationMs) },
            { label: 'Tool calls', value: formatCount(turn.tools) },
            { label: 'Input', value: formatCompact(turn.tokens.input), hint: 'Tokens the model read, the conversation so far included.' },
            { label: 'Output', value: formatCompact(turn.tokens.output), hint: 'Tokens the model wrote.' },
            {
              label: 'From cache',
              value: formatCompact(turn.tokens.cached),
              hint: 'Input tokens read from the prompt cache, which cost much less.',
            },
          ]}
        />

        <Section title="Steps">
          <StepList steps={turn.steps} />
        </Section>

        {feedback.length > 0 && (
          <Section title="Feedback">
            <FeedbackList items={feedback} emptyText="" />
          </Section>
        )}
      </DetailBody>
    </>
  );
}
