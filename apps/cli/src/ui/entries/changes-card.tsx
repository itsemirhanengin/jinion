import { Box, Clickable, ExpandHint, FRAME_INSET, Frame, Text, useContentWidth, useTheme } from '@jinion/tui';
import { useJinion } from '../../app/context.js';
import type { ChangedFile, EntryOf } from '@jinion/core/conversation/entries';
import { plural } from '@jinion/core/lib/format';

const CARD_FILES = 8;

/** As Cursor shows it. */
export function ChangesCard({ entry }: { entry: EntryOf<'changes'> }) {
  const jinion = useJinion();
  const theme = useTheme();
  const width = useContentWidth();

  const shown = entry.files.slice(0, CARD_FILES);
  const more = entry.files.length - shown.length;

  const total = {
    path: '',
    created: false,
    added: entry.files.reduce((sum, file) => sum + file.added, 0),
    removed: entry.files.reduce((sum, file) => sum + file.removed, 0),
  };

  const pathWidth = Math.min(Math.max(...shown.map((file) => file.path.length)) + 2, Math.max(10, width - FRAME_INSET - 16));

  const open = (file?: string) => jinion.screen.openView({ id: 'diff', turn: entry.turn, file });

  return (
    <Frame
      title={
        <Text>
          <Text bold>{plural(entry.files.length, 'file')} changed</Text> <LineCounts file={total} />
        </Text>
      }
    >
      {shown.map((file) => (
        <Clickable key={file.path} id={`${entry.id}:${file.path}`} fit onClick={() => open(file.path)}>
          <Box>
            <Box width={pathWidth} flexShrink={0}>
              <Text color={theme.code} wrap="truncate-start">
                {file.path}
              </Text>
            </Box>
            <LineCounts file={file} column={entry.files.some((other) => other.created)} />
          </Box>
        </Clickable>
      ))}
      {more > 0 && (
        <Clickable id={`${entry.id}:more`} fit onClick={() => open()}>
          <ExpandHint>{`+${plural(more, 'more file')}`}</ExpandHint>
        </Clickable>
      )}
    </Frame>
  );
}

function LineCounts({ file, column = false }: { file: ChangedFile; column?: boolean }) {
  const theme = useTheme();

  return (
    <Text>
      {(file.created || column) && <Text color={theme.muted}>{file.created ? 'new ' : '    '}</Text>}
      {file.added > 0 && <Text color={theme.diff.added}>+{file.added}</Text>}
      {file.added > 0 && file.removed > 0 && ' '}
      {file.removed > 0 && <Text color={theme.diff.removed}>-{file.removed}</Text>}
    </Text>
  );
}
