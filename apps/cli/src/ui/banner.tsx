import type { ReactNode } from 'react';
import { Box, Frame, Text, useTheme } from '@jinion/tui';
import { useAtomValue } from 'jotai';
import { modelLabelAtom, worktreeAtom } from '@jinion/core/state/active';
import { accountLabel } from '@jinion/core/agent/accounts';
import { useJinion } from '../app/context.js';
import { tildify } from '@jinion/core/lib/paths';
import { identityAtom } from '@jinion/core/state/agent';

export function Banner() {
  const theme = useTheme();
  const { backend, info } = useJinion();
  const model = useAtomValue(modelLabelAtom);
  const identity = useAtomValue(identityAtom);
  const worktree = useAtomValue(worktreeAtom);

  const { version, cwd, examples = [] } = info;

  return (
    <Frame
      fit
      lead={1}
      title={
        <Text>
          <Text bold color={theme.accent}>
            jinion
          </Text>{' '}
          <Text color={theme.muted}>v{version}</Text>
        </Text>
      }
    >
      <Row label="model" hint="/model to change">
        <Text color={theme.status.model}>{model}</Text>
      </Row>
      {identity && (
        <Row label="account" hint={backend.accounts && '/account to change'}>
          <Text color={theme.accent}>{accountLabel(identity)}</Text>
          {identity.name !== 'default' && <Text color={theme.muted}> ({identity.name})</Text>}
        </Row>
      )}
      <Row label="cwd">
        <Text color={theme.status.directory}>{tildify(cwd)}</Text>
      </Row>
      {worktree && (
        <Row label="worktree">
          <Text color={theme.code}>{worktree.name}</Text>
          <Text color={theme.muted}> on {worktree.branch}</Text>
        </Row>
      )}
      {examples.length > 0 && (
        <Row label="try">
          <Text color={theme.code}>{examples.join(', ')}</Text>
        </Row>
      )}
    </Frame>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string | false; children: ReactNode }) {
  const theme = useTheme();

  return (
    <Box>
      <Box flexShrink={0} width={9}>
        <Text color={theme.muted}>{label}</Text>
      </Box>
      <Box flexShrink={1}>{children}</Box>
      {hint && (
        <Box flexShrink={0} marginLeft={3}>
          <Text color={theme.muted}>{hint}</Text>
        </Box>
      )}
    </Box>
  );
}
