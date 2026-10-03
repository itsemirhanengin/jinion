import { Box, Text } from 'ink';
import { useTheme } from '../runtime/context.js';
import { Prose } from '../primitives/prose.js';
import { anyOf, MENTION } from './mentions.js';
import { PASTED_IMAGE } from './pasted-images.js';
import { PASTED_TEXT } from './pasted-texts.js';
import { printable } from '../utils/printable.js';

export interface UserMessageProps {
  text: string;
  /** Highlighted like @-mentions, e.g. skills. */
  mentions?: (RegExp | undefined)[];
  /** Muted, on the right, e.g. how the message was sent. */
  aside?: string;
}

/**
 * The user's prompt. Paste placeholders and @-mentions are highlighted as they were in the prompt, and so is what
 * `mentions` matches.
 */
export function UserMessage({ text: raw, mentions = [], aside }: UserMessageProps) {
  const theme = useTheme();
  const text = printable(raw);
  const marks = [
    ...[...text.matchAll(anyOf([PASTED_TEXT, PASTED_IMAGE])!)].map((match) => ({ index: match.index, text: match[0], color: theme.accent })),
    ...[...text.matchAll(anyOf([MENTION, ...mentions])!)].map((match) => ({ index: match.index, text: match[0], color: theme.code })),
  ].sort((a, b) => a.index - b.index);
  const parts: { text: string; color?: string }[] = [];
  let at = 0;
  for (const mark of marks) {
    if (mark.index < at) continue;
    parts.push({ text: text.slice(at, mark.index) }, { text: mark.text, color: mark.color });
    at = mark.index + mark.text.length;
  }
  parts.push({ text: text.slice(at) });
  return (
    <Box backgroundColor={theme.surface.user} paddingX={1}>
      <Box flexShrink={0}>
        <Text bold color={theme.accent}>
          {'> '}
        </Text>
      </Box>
      <Box flexShrink={1} flexGrow={1}>
        <Prose>
          {parts.map((part, index) =>
            part.color ? (
              <Text key={index} color={part.color}>
                {part.text}
              </Text>
            ) : (
              part.text
            ),
          )}
        </Prose>
      </Box>
      {aside && (
        <Box flexShrink={0} marginLeft={2}>
          <Text color={theme.muted}>{aside}</Text>
        </Box>
      )}
    </Box>
  );
}

export function Thinking({ text }: { text: string }) {
  const theme = useTheme();
  return (
    <Prose italic color={theme.thinking}>
      {printable(text).trim()}
    </Prose>
  );
}

export type NoticeTone = 'muted' | 'success' | 'warning' | 'error';

export function Notice({ text, tone = 'muted' }: { text: string; tone?: NoticeTone }) {
  const theme = useTheme();
  return <Prose color={theme[tone]}>{printable(text)}</Prose>;
}
