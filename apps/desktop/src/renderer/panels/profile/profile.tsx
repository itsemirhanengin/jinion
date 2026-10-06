import type { UsageProfile } from '@jinion/core/agent/usage';
import { Spinner } from '@jinion/ui';
import { useAtomValue } from 'jotai';
import { useEffect, useState } from 'react';
import { compact, counted } from '../../lib/numbers.js';
import { useCore } from '../../state/session.js';
import { Accounts } from './accounts.js';
import { Activity } from './activity.js';

const dayLabel = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' });

/** The user as Jinion knows them: their name, what they have done with every backend over time, and their accounts. */
export function Profile() {
  const core = useCore();
  const app = useAtomValue(core.appAtom);

  const [profile, setProfile] = useState<{ name?: string; usage: UsageProfile }>();
  const [problem, setProblem] = useState<string>();

  useEffect(() => {
    core.client.request('profile/read', {}).then(setProfile, (error: Error) => setProblem(error.message));
  }, [core]);

  const email = Object.values(app?.identities ?? {}).find((identity) => identity.email)?.email;
  const name = profile?.name ?? email?.split('@')[0] ?? 'You';
  const usage = profile?.usage;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-176 flex-col gap-10 px-8 pt-14 pb-16">
        <header className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-20 items-center justify-center rounded-full bg-primary text-2xl font-medium text-on-primary">{initials(name)}</span>
          <div className="flex flex-col">
            <h1 className="text-title font-semibold">{name}</h1>
            {email && <span className="text-muted">{email}</span>}
          </div>
        </header>
        {!usage && !problem && (
          <p className="flex items-center justify-center gap-2 text-muted">
            <Spinner />
            Reading your history
          </p>
        )}
        {problem && <p className="text-center text-pretty text-muted">Your history couldn't be read: {problem}</p>}
        {usage && (
          <>
            <div className="grid grid-cols-5 divide-x divide-line rounded-xl ring-1 ring-edge">
              <Stat value={compact(usage.tokens)} label="Lifetime tokens" />
              <Stat value={usage.peak ? compact(usage.peak.tokens) : '0'} label="Peak day" title={usage.peak && dayLabel.format(dateOf(usage.peak.date))} />
              <Stat value={usage.activeDays.toLocaleString('en')} label="Active days" />
              <Stat value={counted(usage.longestStreak, 'day')} label="Longest streak" />
              <Stat value={counted(usage.currentStreak, 'day')} label="Current streak" />
            </div>
            <Activity days={usage.days} />
            {usage.models.length > 0 && (
              <section className="flex flex-col gap-3">
                <h2 className="font-medium">Top models</h2>
                <div className="flex flex-col gap-2.5">
                  {usage.models.slice(0, 5).map((model) => (
                    <div key={model.name} className="grid grid-cols-[minmax(0,12rem)_1fr_4rem] items-center gap-4">
                      <span className="truncate" title={model.name}>
                        {model.name}
                      </span>
                      <span className="h-1.5 overflow-hidden rounded-full bg-shade">
                        <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(1, model.share * 100)}%` }} />
                      </span>
                      <span className="text-right text-muted tabular-nums" title={`${compact(model.tokens)} tokens`}>
                        {Math.round(model.share * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
            <section className="flex flex-col gap-1">
              <h2 className="pb-2 font-medium">Insights</h2>
              <Insight label="Sessions" value={usage.sessions.toLocaleString('en')} />
              <Insight label="Messages" value={usage.messages.toLocaleString('en')} />
              <Insight label="Tool calls" value={usage.toolCalls.toLocaleString('en')} />
              {usage.mostActive && (
                <Insight label="Most active day" value={`${dayLabel.format(dateOf(usage.mostActive.date))} · ${counted(usage.mostActive.messages, 'message')}`} />
              )}
            </section>
          </>
        )}
        <Accounts />
      </div>
    </div>
  );
}

function Stat({ value, label, title }: { value: string; label: string; title?: string }) {
  return (
    <div title={title} className="flex min-w-0 flex-col items-center gap-0.5 px-2 py-3">
      <span className="font-medium tabular-nums">{value}</span>
      <span className="truncate text-small text-muted">{label}</span>
    </div>
  );
}

function Insight({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex h-7 items-center justify-between gap-4">
      <span className="text-muted">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function initials(name: string) {
  const words = name.trim().split(/\s+/);

  return ((words[0]?.[0] ?? '') + (words.length > 1 ? (words.at(-1)?.[0] ?? '') : '')).toUpperCase() || '?';
}

/** A day's key as a date at its own midnight, so it formats as that day wherever the user is. */
function dateOf(day: string) {
  const [year, month, date] = day.split('-').map(Number);

  return new Date(year!, month! - 1, date);
}
