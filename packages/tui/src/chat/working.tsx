import { Box, Text, useAnimation } from 'ink';
import { useTheme } from '../runtime/theme.js';
import { StatusMark } from '../primitives/spinner.js';

export interface WorkingProps {
  label: string;
  since: number;
  hint?: string;
}

export function Working({ label, since, hint = 'esc to interrupt' }: WorkingProps) {
  const theme = useTheme();

  const seconds = Math.floor((Date.now() - since) / 1000);
  const elapsed = seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;

  useAnimation({ interval: 250 });

  return (
    <Box paddingX={1}>
      <Text>
        <StatusMark status="running" /> <Text color={theme.accent}>{label}…</Text>{' '}
        <Text color={theme.muted}>
          {elapsed} · {hint}
        </Text>
      </Text>
    </Box>
  );
}
