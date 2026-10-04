import { Meter, Text } from '@jinion/tui';
import type { LimitWindow } from '@jinion/core/agent/usage';
import { minutes, thousands } from '@jinion/core/lib/format';
import { levelColor, type Segment } from '../segment.js';

export const context: Segment = {
  id: 'context',
  name: 'Context',
  description: 'How full the context window is',
  styles: [
    { id: 'tokens', name: 'tokens' },
    { id: 'percent', name: 'percent' },
    { id: 'bar', name: 'meter' },
  ],
  render: ({ session, theme }, style) => {
    const { contextTokens, contextWindow } = session.usage;
    const used = contextWindow > 0 ? contextTokens / contextWindow : 0;
    if (style === 'tokens') return <Text>ctx: {thousands(contextTokens)}/{thousands(contextWindow)}</Text>;

    const share = <Text color={levelColor(theme, used)}>{Math.round(used * 100)}%</Text>;
    if (style === 'percent') return <Text>ctx {share}</Text>;

    return (
      <Text>
        ctx <Meter value={used} /> {share}
      </Text>
    );
  },
};

export const limits: Segment = {
  id: 'limits',
  name: 'Plan limits',
  description: 'How much of your plan is used, per window; shows after the first request',
  styles: [
    { id: 'both', name: '5h and 7d' },
    { id: 'session', name: '5h with reset time' },
    { id: 'week', name: '7d' },
    { id: 'bar', name: '5h meter' },
  ],
  ticks: true,
  render: ({ limits, now, theme }, style) => {
    const usage = (window: LimitWindow) => (
      <Text>
        {window.label} <Text color={levelColor(theme, window.used)}>{Math.round(window.used * 100)}%</Text>
      </Text>
    );

    const five = limits?.find((window) => window.label === '5h');
    const week = limits?.find((window) => window.label === '7d');
    if (style === 'week') return week && usage(week);
    if (!five) return undefined;

    if (style === 'bar') {
      return (
        <Text>
          5h <Meter value={five.used} /> <Text color={levelColor(theme, five.used)}>{Math.round(five.used * 100)}%</Text>
        </Text>
      );
    }

    if (style === 'session') {
      return (
        <Text>
          {usage(five)}
          {five.resetsAt !== undefined && five.resetsAt > now && <Text color={theme.muted}> · resets in {minutes(five.resetsAt - now)}</Text>}
        </Text>
      );
    }

    return (
      <Text>
        {usage(five)}
        {week && (
          <>
            <Text color={theme.muted}> · </Text>
            {usage(week)}
          </>
        )}
      </Text>
    );
  },
};

export const cost: Segment = {
  id: 'cost',
  name: 'Cost',
  description: "What the conversation would cost at API prices; a subscription doesn't bill it",
  render: ({ session, theme }) => <Text color={theme.status.cost}>${session.usage.cost.toFixed(2)}</Text>,
};
