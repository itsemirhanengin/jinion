import { Text } from 'ink';
import { useTheme } from '../../runtime/theme.js';
import type { Row } from './layout.js';
import type { Mark } from './spans.js';

interface RowTextProps {
  value: string;
  row: Row;
  marks: Mark[];
  caret?: number;
  dim: boolean;
}

export function RowText({ value, row, marks, caret, dim }: RowTextProps) {
  const theme = useTheme();
  const cuts = new Set([row.start, row.end]);
  for (const span of marks) {
    if (span.start > row.start && span.start < row.end) cuts.add(span.start);
    if (span.end > row.start && span.end < row.end) cuts.add(span.end);
  }
  if (caret !== undefined && caret < row.end) {
    cuts.add(caret);
    cuts.add(caret + String.fromCodePoint(value.codePointAt(caret)!).length);
  }
  const points = [...cuts].filter((point) => point <= row.end).sort((a, b) => a - b);

  return (
    <Text wrap="truncate" dimColor={dim}>
      {points.slice(0, -1).map((start, index) => {
        const end = points[index + 1]!;
        const text = value.slice(start, end);
        if (start === caret) return <Caret key={start} char={text} />;
        const mark = marks.find((span) => span.start <= start && end <= span.end);
        return mark ? (
          <Text key={start} color={mark.atom ? theme.accent : theme.code}>
            {text}
          </Text>
        ) : (
          text
        );
      })}
      {caret === row.end && <Caret />}
      {/* An empty line still takes its row. */}
      {row.start === row.end && caret === undefined && ' '}
    </Text>
  );
}

function Caret({ char }: { char?: string }) {
  const theme = useTheme();
  return (
    <Text inverse color={theme.accent}>
      {char === undefined || char === '\n' ? ' ' : char}
    </Text>
  );
}

export function Placeholder({ text, showCaret }: { text: string; showCaret: boolean }) {
  const theme = useTheme();
  if (!showCaret) return <Text color={theme.muted}>{text || ' '}</Text>;
  return (
    <Text>
      <Caret char={text[0]} />
      <Text color={theme.muted}>{text.slice(1)}</Text>
    </Text>
  );
}
