import { Text, useAnimation } from 'ink';
import { useTheme } from '../runtime/context.js';

const FRAMES = ['|', '/', '-', '\\'];

export function Spinner({ color }: { color?: string }) {
  const { frame } = useAnimation({ interval: 120 });
  return <Text color={color}>{FRAMES[frame % FRAMES.length]}</Text>;
}

export type Status = 'pending' | 'running' | 'done' | 'error' | 'cancelled';

/** `[ ]` pending, `[/]` running (animated), `[x]` done, `[!]` error, `[-]` cancelled. */
export function StatusMark({ status }: { status: Status }) {
  const theme = useTheme();

  switch (status) {
    case 'running':
      return (
        <Text color={theme.accent}>
          [<Spinner />]
        </Text>
      );
    case 'done':
      return <Text color={theme.success}>[x]</Text>;
    case 'error':
      return <Text color={theme.error}>[!]</Text>;
    case 'cancelled':
      return <Text color={theme.muted}>[-]</Text>;
    case 'pending':
      return <Text color={theme.muted}>[ ]</Text>;
  }
}
