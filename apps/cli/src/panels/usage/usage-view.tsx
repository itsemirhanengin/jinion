import { useState } from 'react';
import { BarList, Box, Meter, Text, useInput, useTheme } from '@jinion/tui';
import { useAtomValue } from 'jotai';
import type { AgentUsage, UsageDrivers } from '@jinion/core/agent/usage';
import { grouped, money, plural, resetTime, span } from '@jinion/core/lib/format';
import { agentAtom, identityAtom } from '../../state/session.js';
import { Section, tokenLine } from './section.js';

const LIMIT_BAR = 28;
const SHARE_BAR = 16;

const TRAITS: Record<UsageDrivers['traits'][number]['trait'], [label: string, why: string]> = {
  subagents: ['Subagent-heavy', 'each subagent makes requests of its own'],
  'long-context': ['Long context', 'requests past 150k tokens; /clear between tasks keeps them small'],
  'cache-misses': ['Cache misses', 'requests that missed the prompt cache, e.g. after an hour away'],
  parallel: ['Parallel', 'while four or more sessions ran at once'],
  scheduled: ['Scheduled', 'from scheduled or looping sessions'],
};

const SOURCE_KINDS = { skill: 'skill', agent: 'subagent', plugin: 'plugin', mcp: 'MCP' } as const;

export function UsageView({ usage, error, available }: { usage?: AgentUsage; error?: string; available: boolean }) {
  const backend = useAtomValue(agentAtom);
  const theme = useTheme();
  const plan = useAtomValue(identityAtom)?.plan;

  const [window, setWindow] = useState<'day' | 'week'>('day');

  useInput((input) => {
    if (input === 'd') setWindow('day');
    if (input === 'w') setWindow('week');
  });

  if (!available) return <Text color={theme.muted}>{backend.name} doesn't report its usage.</Text>;
  if (error) return <Text color={theme.error}>Couldn't ask {backend.name} for its usage: {error}</Text>;
  if (!usage) return <Text color={theme.muted}>Asking {backend.name} for its usage…</Text>;

  const { session, limits, extra, drivers } = usage;
  const labelWidth = Math.max(0, ...limits.map((limit) => limit.label.length)) + 2;

  return (
    <Box flexDirection="column">
      <Section title="Plan limits" aside={plan}>
        {limits.length === 0 ? (
          <Text color={theme.muted}>This login has no plan limits, e.g. an API key.</Text>
        ) : (
          limits.map((limit) => (
            <Text key={limit.label}>
              {limit.label.padEnd(labelWidth)}
              <Meter value={limit.used} width={LIMIT_BAR} /> {`${Math.round(limit.used * 100)}%`.padStart(4)}
              {limit.resetsAt !== undefined && <Text color={theme.muted}> resets {resetTime(limit.resetsAt)}</Text>}
            </Text>
          ))
        )}
        {extra && (
          <Text color={theme.muted}>
            Extra usage {money(extra.used, extra.currency)}
            {extra.limit !== undefined && ` of ${money(extra.limit, extra.currency)}`} this month
          </Text>
        )}
      </Section>

      {session && (
        <Section
          title="This session"
          aside={`${money(session.cost)} · ${span(session.apiMs)} waiting on the model · ${span(session.wallMs)} in all · +${grouped(session.linesAdded)} -${grouped(session.linesRemoved)} lines`}
        >
          {session.models.length === 0 ? (
            <Text color={theme.muted}>No requests yet.</Text>
          ) : (
            session.models.map((model, _, models) => (
              <Text key={model.name} wrap="truncate-end">
                {model.name.padEnd(Math.max(...models.map((other) => other.name.length)) + 2)}
                <Text color={theme.muted}>{tokenLine(model).padEnd(Math.max(...models.map((other) => tokenLine(other).length)) + 2)}</Text>
                {money(model.cost)}
              </Text>
            ))
          )}
        </Section>
      )}

      <Section title={`What adds to your limits · last ${window === 'day' ? '24 hours' : '7 days'}`}>
        <Drivers drivers={drivers?.[window]} loading={!drivers} />
      </Section>
    </Box>
  );
}

function Drivers({ drivers, loading }: { drivers?: UsageDrivers; loading: boolean }) {
  const theme = useTheme();

  if (loading) return <Text color={theme.muted}>Looking through this week's conversations on this machine…</Text>;
  if (!drivers || drivers.requests === 0) return <Text color={theme.muted}>Nothing in this time on this machine.</Text>;

  return (
    <>
      <Text color={theme.muted}>
        {plural(drivers.requests, 'request')} in {plural(drivers.sessions, 'session')} on this machine, roughly. The traits overlap, so
        they don't add up.
      </Text>
      <Box marginTop={1}>
        <BarList
          width={SHARE_BAR}
          bars={drivers.traits.map(({ trait, share }) => ({
            label: TRAITS[trait][0],
            value: share,
            text: (
              <Text>
                {`${Math.round(share * 100)}%`.padStart(4)}
                <Text color={theme.muted}> {TRAITS[trait][1]}</Text>
              </Text>
            ),
          }))}
        />
      </Box>
      {drivers.sources.length > 0 && (
        <Box marginTop={1}>
          <Text wrap="truncate-end">
            <Text color={theme.muted}>Most used: </Text>
            {drivers.sources.slice(0, 5).map((source, index) => (
              <Text key={`${source.kind}:${source.name}`}>
                {index > 0 && <Text color={theme.muted}> · </Text>}
                {source.name}
                <Text color={theme.muted}>
                  {' '}
                  {SOURCE_KINDS[source.kind]} {Math.round(source.share * 100)}%
                </Text>
              </Text>
            ))}
          </Text>
        </Box>
      )}
    </>
  );
}
