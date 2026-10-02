import { Box, Text } from 'ink';
import { useTheme } from '../runtime/context.js';
import { Prose } from '../primitives/prose.js';

export function UserMessage({ text }: { text: string }) {
  const theme = useTheme();
  return (
    <Box backgroundColor={theme.surface.user} paddingX={1}>
      <Box flexShrink={0}>
        <Text bold color={theme.accent}>
          {'> '}
        </Text>
      </Box>
      <Box flexShrink={1}>
        <Prose>{text}</Prose>
      </Box>
    </Box>
  );
}

export function Thinking({ text }: { text: string }) {
  const theme = useTheme();
  return (
    <Prose italic color={theme.thinking}>
      {text.trim()}
    </Prose>
  );
}

export type NoticeTone = 'muted' | 'success' | 'warning' | 'error';

export function Notice({ text, tone = 'muted' }: { text: string; tone?: NoticeTone }) {
  const theme = useTheme();
  return <Prose color={theme[tone]}>{text}</Prose>;
}
