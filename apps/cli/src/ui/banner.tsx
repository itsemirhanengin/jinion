import type { ReactNode } from 'react';
import { Box, Frame, Text, useTheme } from '@jinion/tui';
import { useAtomValue } from 'jotai';
import { accountLabel } from '../agent/accounts.js';
import { useJinion } from '../app/context.js';
import { tildify } from '../lib/paths.js';
import { identityAtom, modelLabelAtom } from '../state/agent.js';

export function Banner() {
  const theme = useTheme();
  const { agent, info } = useJinion();
  const model = useAtomValue(modelLabelAtom);
  const identity = useAtomValue(identityAtom);
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
        <Row label="account" hint={agent.accounts && '/account to change'}>
          <Text color={theme.accent}>{accountLabel(identity)}</Text>
          {identity.name !== 'default' && <Text color={theme.muted}> ({identity.name})</Text>}
        </Row>
      )}
      <Row label="cwd">
        <Text color={theme.status.directory}>{tildify(cwd)}</Text>
      </Row>
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
