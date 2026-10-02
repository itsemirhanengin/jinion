import { Text } from 'ink';
import { useTheme } from '../runtime/context.js';

export interface HighlightProps {
  text: string;
  /** Character indexes to emphasize, e.g. from `fuzzyMatch`. */
  positions?: number[];
  color?: string;
}

/** Text with matched characters emphasized. */
export function Highlight({ text, positions = [], color }: HighlightProps) {
  const theme = useTheme();
  if (positions.length === 0) return <Text color={color}>{text}</Text>;

  const marked = new Set(positions);
  const runs: { text: string; marked: boolean }[] = [];
  for (let index = 0; index < text.length; index++) {
    const last = runs.at(-1);
    if (last && last.marked === marked.has(index)) last.text += text[index];
    else runs.push({ text: text[index]!, marked: marked.has(index) });
  }

  return (
    <Text color={color}>
      {runs.map((run, index) =>
        run.marked ? (
          <Text key={index} bold color={theme.accent}>
            {run.text}
          </Text>
        ) : (
          run.text
        ),
      )}
    </Text>
  );
}
