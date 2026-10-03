import { Box, Text } from 'ink';
import { useHovered } from '../primitives/clickable.js';
import { useTheme } from '../runtime/theme.js';
import { hoverColor } from '../theme/themes.js';
import { Prose } from '../primitives/prose.js';
import { printable } from '../utils/printable.js';
import { PLACEHOLDERS, useMentions } from './highlights.js';

export interface UserMessageProps {
  text: string;
  mentions?: (RegExp | undefined)[];
  aside?: string;
}

export function UserMessage({ text: raw, mentions = [], aside }: UserMessageProps) {
  const theme = useTheme();
  const hovered = useHovered();

  const highlight = useMentions(mentions);
  const text = printable(raw);

  const marks = [
    ...[...text.matchAll(PLACEHOLDERS)].map((match) => ({ index: match.index, text: match[0], color: theme.accent })),
    ...[...text.matchAll(highlight)].map((match) => ({ index: match.index, text: match[0], color: theme.code })),
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
    <Box backgroundColor={hovered ? hoverColor(theme, theme.surface.user) : theme.surface.user} paddingX={1}>
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

export interface ThinkingProps {
  text: string;
  folded?: boolean;
  took?: string;
}

export function Thinking({ text, folded, took }: ThinkingProps) {
  const theme = useTheme();
  const hovered = useHovered();

  if (folded) {
    return (
      <Text italic color={hovered ? undefined : theme.thinking}>
        {took ? `Thought for ${took}` : 'Thought'}
      </Text>
    );
  }

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
