import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  BarList,
  Box,
  dayKey,
  Heatmap,
  Meter,
  Panel,
  parseDay,
  StatGrid,
  Tabs,
  Text,
  useDayCursor,
  useInput,
  usePanel,
  useTabs,
  useTheme,
  useWindowSize,
  type KeyHint,
} from '@jinion/tui';
import type { AgentUsage, ModelTokens, UsageDrivers, UsageHistory } from '../agent/types.js';
import { useJinion } from '../context.js';
import { compact, grouped, money, plural, resetTime, shortDate, span } from '../usage/format.js';
import { RANGES, totalOf, usageStats, type StatsRange } from '../usage/stats.js';

const TABS = ['Usage', 'Stats'] as const;
export type UsageTab = 'usage' | 'stats';

const LIMIT_BAR = 28;
const SHARE_BAR = 16;
/** Rows the stats tab takes besides its models: tabs, ranges, the heatmap, the figures and the panel's edges. */
const STATS_ROWS = 30;

const TRAITS: Record<UsageDrivers['traits'][number]['trait'], [label: string, why: string]> = {
  subagents: ['Subagent-heavy', 'each subagent makes requests of its own'],
  'long-context': ['Long context', 'requests past 150k tokens; /clear between tasks keeps them small'],
  'cache-misses': ['Cache misses', 'requests that missed the prompt cache, e.g. after an hour away'],
  parallel: ['Parallel', 'while four or more sessions ran at once'],
  scheduled: ['Scheduled', 'from scheduled or looping sessions'],
};

const SOURCE_KINDS = { skill: 'skill', agent: 'subagent', plugin: 'plugin', mcp: 'MCP' } as const;

/**
 * `/usage` and `/stats`: what the plan's limits stand at and what fills them, and every day of use on this machine as
 * a calendar, with its figures and models.
 */
export function UsagePanel({ tab = 'usage' }: { tab?: UsageTab }) {
  const app = useJinion();
  const { close } = usePanel();
  const [active] = useTabs(TABS.length, { initial: tab === 'stats' ? 1 : 0, arrows: false });
  const [usage, setUsage] = useState<AgentUsage>();
  const [usageError, setUsageError] = useState<string>();
  const [history, setHistory] = useState<UsageHistory>();
  const [progress, setProgress] = useState<[done: number, total: number]>();
  const [historyError, setHistoryError] = useState<string>();

  useEffect(() => {
    let open = true;
    const failed = (set: (message: string) => void) => (error: unknown) => open && set(error instanceof Error ? error.message : String(error));
    const { current, history: read } = app.usage;
    // The limits come quickly; what adds to them takes a look through the week's conversations.
    current?.({ drivers: false })
      .then((quick) => {
        if (!open) return;
        setUsage(quick);
        return current({ drivers: true }).then((full) => open && setUsage(full));
      })
      .catch(failed(setUsageError));
    read?.((done, total) => open && setProgress([done, total])).then((days) => open && setHistory(days), failed(setHistoryError));
    return () => {
      open = false;
    };
  }, []);

  useInput((_, key) => {
    if (key.escape) close();
  });

  const hints: KeyHint[] =
    active === 0
      ? [
          ['Tab', 'stats'],
          ['d/w', 'last day or week'],
          ['Esc', 'close'],
        ]
      : [
          ['Tab', 'usage'],
          ['Arrows', 'pick a day'],
          ['r', 'range'],
          ['Esc', 'close'],
        ];
  return (
    <Panel title="Usage" subtitle={app.model.agent} header={<Tabs tabs={[...TABS]} active={active} />} grow hints={hints}>
      {active === 0 ? (
        <UsageView usage={usage} error={usageError} available={app.usage.current !== undefined} />
      ) : (
        <StatsView history={history} progress={progress} error={historyError} available={app.usage.history !== undefined} />
      )}
    </Panel>
  );
}

function UsageView({ usage, error, available }: { usage?: AgentUsage; error?: string; available: boolean }) {
  const app = useJinion();
  const theme = useTheme();
  const [window, setWindow] = useState<'day' | 'week'>('day');
  useInput((input) => {
    if (input === 'd') setWindow('day');
    if (input === 'w') setWindow('week');
  });

  if (!available) return <Text color={theme.muted}>{app.model.agent} doesn't report its usage.</Text>;
  if (error) return <Text color={theme.error}>Couldn't ask {app.model.agent} for its usage: {error}</Text>;
  if (!usage) return <Text color={theme.muted}>Asking {app.model.agent} for its usage…</Text>;

  const { session, limits, extra, drivers } = usage;
  const plan = app.accounts.identity?.plan;
  const labelWidth = Math.max(0, ...limits.map((limit) => limit.label.length)) + 2;
  const shown = drivers?.[window];
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
        {!drivers ? (
          <Text color={theme.muted}>Looking through this week's conversations on this machine…</Text>
        ) : !shown || shown.requests === 0 ? (
          <Text color={theme.muted}>Nothing in this time on this machine.</Text>
        ) : (
          <>
            <Text color={theme.muted}>
              {plural(shown.requests, 'request')} in {plural(shown.sessions, 'session')} on this machine, roughly. The traits
              overlap, so they don't add up.
            </Text>
            <Box marginTop={1}>
              <BarList
                width={SHARE_BAR}
                bars={shown.traits.map(({ trait, share }) => ({
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
            {shown.sources.length > 0 && (
              <Box marginTop={1}>
                <Text wrap="truncate-end">
                  <Text color={theme.muted}>Most used: </Text>
                  {shown.sources.slice(0, 5).map((source, index) => (
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
        )}
      </Section>
    </Box>
  );
}

function StatsView({
  history,
  progress,
  error,
  available,
}: {
  history?: UsageHistory;
  progress?: [number, number];
  error?: string;
  available: boolean;
}) {
  const app = useJinion();
  const theme = useTheme();
  const { rows } = useWindowSize();
  const today = new Date();
  const [range, setRange] = useState<StatsRange>('all');
  const [day] = useDayCursor(today, { earliest: history?.days[0]?.date });
  useInput((input) => {
    if (input === 'r') setRange((current) => RANGES[(RANGES.findIndex((candidate) => candidate.range === current) + 1) % RANGES.length]!.range);
  });
  const stats = useMemo(() => history && usageStats(history, range), [history, range]);
  const values = useMemo(() => Object.fromEntries((history?.days ?? []).map((item) => [item.date, item.messages])), [history]);

  if (!available) return <Text color={theme.muted}>{app.model.agent} keeps no history of its use.</Text>;
  if (error) return <Text color={theme.error}>Couldn't read the history: {error}</Text>;
  if (!history || !stats) {
    const [done = 0, total = 0] = progress ?? [];
    return (
      <Text color={theme.muted}>
        Reading {app.model.agent}'s conversations on this machine…{total > 0 && ` ${grouped(done)} of ${grouped(total)}`}
      </Text>
    );
  }

  const picked = history.days.find((item) => item.date === day);
  const models = stats.models.slice(0, Math.max(1, Math.floor((rows - STATS_ROWS) / 2)));
  return (
    <Box flexDirection="column">
      <Text>
        {RANGES.map((option, index) => (
          <Text key={option.range}>
            {index > 0 && <Text color={theme.muted}> · </Text>}
            {option.range === range ? (
              <Text color={theme.accent} bold>
                {option.label}
              </Text>
            ) : (
              <Text color={theme.muted}>{option.label}</Text>
            )}
          </Text>
        ))}
      </Text>
      <Box marginTop={1} flexDirection="column">
        <Heatmap values={values} end={today} selected={day} legend />
        <Text>
          {shortDate(parseDay(day))}
          {day === dayKey(today) && <Text color={theme.muted}> (today)</Text>}
          <Text color={theme.muted}>
            {' · '}
            {picked && picked.messages > 0
              ? `${plural(picked.messages, 'message')} · ${plural(picked.sessions, 'session')} · ${compact(
                  Object.values(picked.models).reduce((sum, tokens) => sum + totalOf(tokens), 0),
                )} tokens`
              : 'nothing'}
          </Text>
        </Text>
      </Box>

      {stats.activeDays === 0 ? (
        <Box marginTop={1}>
          <Text color={theme.muted}>Nothing in this range yet.</Text>
        </Box>
      ) : (
        <>
          <Box marginTop={1}>
            <StatGrid
              stats={[
                { label: 'Favorite model', value: <Text color={theme.accent}>{stats.models[0]?.name ?? '-'}</Text> },
                { label: 'Tokens', value: <Text color={theme.accent}>{compact(stats.tokens.total)}</Text> },
                { label: 'Sessions', value: grouped(stats.sessions) },
                { label: 'Longest session', value: stats.longestSession ? span(stats.longestSession.ms) : '-' },
                { label: 'Active days', value: grouped(stats.activeDays), detail: `of ${grouped(stats.spanDays)}` },
                { label: 'Longest streak', value: plural(stats.longestStreak, 'day') },
                { label: 'Most active day', value: stats.mostActive ? shortDate(parseDay(stats.mostActive.date)) : '-' },
                { label: 'Current streak', value: plural(stats.currentStreak, 'day') },
              ]}
            />
          </Box>
          <Text color={theme.muted}>{tokenLine(stats.tokens)}</Text>
          <Box marginTop={1} flexDirection="column">
            <BarList
              width={SHARE_BAR}
              bars={models.map((model) => ({
                label: model.name,
                value: model.share,
                text: (
                  <Text>
                    {`${(model.share * 100).toFixed(1)}%`.padStart(6)}
                    <Text color={theme.muted}> {compact(model.total)}</Text>
                  </Text>
                ),
                detail: tokenLine(model.tokens),
              }))}
            />
            {stats.models.length > models.length && (
              <Text color={theme.muted}>… {plural(stats.models.length - models.length, 'more model')}</Text>
            )}
          </Box>
        </>
      )}
    </Box>
  );
}

/** `12.2k in · 1.4M out · 470.3M cache read · 4.9M cache write`, and what is known only as a total. */
function tokenLine(tokens: ModelTokens) {
  const parts = [`${compact(tokens.input)} in`, `${compact(tokens.output)} out`, `${compact(tokens.cacheRead)} cache read`, `${compact(tokens.cacheWrite)} cache write`];
  const split = tokens.input + tokens.output + tokens.cacheRead + tokens.cacheWrite;
  if (!tokens.summarized) return parts.join(' · ');
  const summarized = `${compact(tokens.summarized)} from Claude Code's summary`;
  return split > 0 ? `${parts.join(' · ')} · ${summarized}` : summarized;
}

function Section({ title, aside, children }: { title: string; aside?: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text wrap="truncate-end">
        <Text bold>{title}</Text>
        {aside && <Text color={theme.muted}> {aside}</Text>}
      </Text>
      {children}
    </Box>
  );
}
