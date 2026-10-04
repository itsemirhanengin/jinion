import { relative } from 'node:path';
import { Box, Text, useTheme } from '@jinion/tui';
import type { FileChanges } from '@jinion/core/agent/agent';
import { plural } from '@jinion/core/lib/format';
import { useAsync } from '../../ui/use-async.js';
import { useWorkdir } from '../../ui/use-workdir.js';

const FILES_SHOWN = 3;

export function Changes({ changes, indent }: { changes: Promise<FileChanges | undefined>; indent: number }) {
  const cwd = useWorkdir();
  const theme = useTheme();

  const known = useAsync(() => changes, [changes]);

  if (known.state !== 'done' || !known.value) {
    return (
      <Box paddingLeft={indent}>
        <Text color={theme.muted}>{known.state === 'pending' ? 'Checking what would change…' : 'No file changes since then'}</Text>
      </Box>
    );
  }

  const { files, insertions, deletions } = known.value;
  const names = files.slice(0, FILES_SHOWN).map((file) => relative(cwd, file) || file);
  const more = files.length - names.length;

  return (
    <Box paddingLeft={indent} flexDirection="column">
      <Text>
        {files.length === 1 ? '1 file changes' : `${plural(files.length, 'file')} change`}
        <Text color={theme.diff.added}> +{insertions}</Text>
        <Text color={theme.diff.removed}> -{deletions}</Text>
      </Text>
      <Text color={theme.muted} wrap="truncate-end">
        {names.join(', ')}
        {more > 0 ? ` … ${more} more` : ''}
      </Text>
    </Box>
  );
}
