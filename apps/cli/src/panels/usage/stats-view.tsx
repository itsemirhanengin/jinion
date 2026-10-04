import { useMemo, useState } from 'react';
import { BarList, Box, dayKey, Heatmap, parseDay, StatGrid, Text, useDayCursor, useInput, useTheme, useWindowSize } from '@jinion/tui';
import type { UsageHistory } from '@jinion/core/agent/usage';
import { useJinion } from '../../app/context.js';
import { compact, grouped, plural, shortDate, span } from '@jinion/core/lib/format';
import { RANGES, totalOf, usageStats, type StatsRange } from '@jinion/core/usage/stats';
import { tokenLine } from './section.js';

const SHARE_BAR = 16;
const STATS_ROWS = 30;

interface StatsViewProps {
  history?: UsageHistory;
  progress?: [number, number];
  error?: string;
  available: boolean;
}

export function StatsView({ history, progress, error, available }: StatsViewProps) {
  const { agent } = useJinion();
  const theme = useTheme();
  const { rows } = useWindowSize();

  const [range, setRange] = useState<StatsRange>('all');

  const today = new Date();
  const [day] = useDayCursor(today, { earliest: history?.days[0]?.date });
  const stats = useMemo(() => history && usageStats(history, range), [history, range]);
  const values = useMemo(() => Object.fromEntries((history?.days ?? []).map((item) => [item.date, item.messages])), [history]);

  useInput((input) => {
    if (input === 'r') setRange((current) => RANGES[(RANGES.findIndex((candidate) => candidate.range === current) + 1) % RANGES.length]!.range);
  });

  if (!available) return <Text color={theme.muted}>{agent.name} keeps no history of its use.</Text>;
  if (error) return <Text color={theme.error}>Couldn't read the history: {error}</Text>;

  if (!history || !stats) {
    const [done = 0, total = 0] = progress ?? [];

    return (
      <Text color={theme.muted}>
        Reading {agent.name}'s conversations on this machine…{total > 0 && ` ${grouped(done)} of ${grouped(total)}`}
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
            {stats.models.length > models.length && <Text color={theme.muted}>… {plural(stats.models.length - models.length, 'more model')}</Text>}
          </Box>
        </>
      )}
    </Box>
  );
}
