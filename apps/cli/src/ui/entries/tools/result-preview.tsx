import { Box, ExpandHint, printable, Text, useView, type TreeNode } from '@jinion/tui';
import { plural } from '@jinion/core/lib/format';

const PREVIEW_LINES = 3;

// Past this a line may not fit the screen, and is cut until the result is opened.
const LONG_LINE = 100;

export const opensFurther = (lines: string[]) =>
  lines.length > PREVIEW_LINES || lines.slice(0, PREVIEW_LINES).some((line) => line.length > LONG_LINE);

export function previewTree(lines: string[]): TreeNode[] {
  if (lines.length === 0) return [];

  return [{ label: <ResultPreview lines={lines} /> }];
}

function ResultPreview({ lines }: { lines: string[] }) {
  const { expanded } = useView();

  const shown = expanded ? lines : lines.slice(0, PREVIEW_LINES);
  const hidden = lines.length - shown.length;

  return (
    <Box flexDirection="column">
      {shown.map((line, index) => (
        <Text key={index} wrap={expanded ? 'wrap' : 'truncate-end'}>
          {printable(line) || ' '}
        </Text>
      ))}
      {hidden > 0 && <ExpandHint>{`+${plural(hidden, 'line')}`}</ExpandHint>}
    </Box>
  );
}
