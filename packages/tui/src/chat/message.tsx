import { Box, Text } from 'ink';
import { useTheme } from '../runtime/context.js';
import { Prose } from '../primitives/prose.js';
import { PASTED_TEXT } from './pasted-texts.js';

/** The user's prompt. Paste placeholders are highlighted as they were in the prompt. */
export function UserMessage({ text }: { text: string }) {
  const theme = useTheme();
  const parts = text.split(new RegExp(`(${PASTED_TEXT.source})`)).filter((part, index) => index % 3 !== 2);
  return (
    <Box backgroundColor={theme.surface.user} paddingX={1}>
      <Box flexShrink={0}>
        <Text bold color={theme.accent}>
          {'> '}
        </Text>
      </Box>
      <Box flexShrink={1}>
        <Prose>
          {parts.map((part, index) =>
            index % 2 === 1 ? (
              <Text key={index} color={theme.accent}>
                {part}
              </Text>
            ) : (
              part
            ),
          )}
        </Prose>
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
