import type { ReactNode } from 'react';
import { Box, Text, useTheme } from '@jinion/tui';
import type { ModelTokens } from '../../agent/usage.js';
import { compact } from '../../lib/format.js';

export function Section({ title, aside, children }: { title: string; aside?: string; children: ReactNode }) {
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

export function tokenLine(tokens: ModelTokens) {
  const parts = [`${compact(tokens.input)} in`, `${compact(tokens.output)} out`, `${compact(tokens.cacheRead)} cache read`, `${compact(tokens.cacheWrite)} cache write`];
  const split = tokens.input + tokens.output + tokens.cacheRead + tokens.cacheWrite;
  if (!tokens.summarized) return parts.join(' · ');

  const summarized = `${compact(tokens.summarized)} from a summary of older days`;

  return split > 0 ? `${parts.join(' · ')} · ${summarized}` : summarized;
}
