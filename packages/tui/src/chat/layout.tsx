import type { ReactNode } from 'react';
import { Box } from 'ink';
import { PanelOutlet, usePanels } from '../runtime/panels.js';

export interface ShellProps {
  content: ReactNode;
  aside?: ReactNode;
  prompt: ReactNode;
  status?: ReactNode;
}

export function Shell({ content, aside, prompt, status }: ShellProps) {
  const { top } = usePanels();

  if (top?.placement === 'fullscreen') {
    return (
      <Box flexDirection="column" flexGrow={1}>
        <PanelOutlet key={top.id} panel={top} />
      </Box>
    );
  }

  return (
    <>
      {content}
      <Box flexDirection="column" flexShrink={0}>
        {aside}
        <Box marginTop={1} flexDirection="column">
          {top ? <PanelOutlet key={top.id} panel={top} /> : prompt}
        </Box>
        {status}
      </Box>
    </>
  );
}
