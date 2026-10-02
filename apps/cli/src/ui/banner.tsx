import type { ReactNode } from 'react';
import { Box, Frame, Text, useTheme } from '@jinion/tui';
import { modelLabel, useJinion } from '../context.js';

/**
 * As wide as its content:
 *
 *     +- jinion v0.1.0 ---------------------------+
 *     | model  Opus 5.5 · xhigh   /model to change |
 *     | cwd    ~/projects/experiments/coding-agent |
 *     +-------------------------------------------+
 */
export function Banner() {
  const theme = useTheme();
  const app = useJinion();
  const { version, cwd, examples = [] } = app.info;

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
        <Text color={theme.status.model}>{modelLabel(app.model)}</Text>
      </Row>
      <Row label="cwd">
        <Text color={theme.status.directory}>{cwd}</Text>
      </Row>
      {examples.length > 0 && (
        <Row label="try">
          <Text color={theme.code}>{examples.join(', ')}</Text>
        </Row>
      )}
    </Frame>
  );
}

/** A long value wraps under itself, not under the label. */
function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <Box>
      <Box flexShrink={0} width={7}>
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
