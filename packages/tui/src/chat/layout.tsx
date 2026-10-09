import type { ReactNode } from 'react';
import { Box } from 'ink';
import { PanelOutlet, usePanels } from '../runtime/panels.js';
import { Inset } from '../runtime/width.js';

export interface ShellProps {
  /** Beside everything else, from the top to the status line, such as a list of conversations; a full-screen panel covers it. */
  sidebar?: { width: number; content: ReactNode };
  content: ReactNode;
  aside?: ReactNode;
  prompt: ReactNode;
  status?: ReactNode;
}

export function Shell({ sidebar, content, aside, prompt, status }: ShellProps) {
  const { top } = usePanels();

  if (top?.placement === 'fullscreen') {
    return (
      <Box flexDirection="column" flexGrow={1}>
        <PanelOutlet key={top.id} panel={top} />
      </Box>
    );
  }

  const main = (
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

  if (!sidebar) return main;

  return (
    <Box flexGrow={1} minHeight={0}>
      <Box width={sidebar.width} flexShrink={0} flexDirection="column">
        {sidebar.content}
      </Box>
      <Box flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0}>
        <Inset by={sidebar.width}>{main}</Inset>
      </Box>
    </Box>
  );
}
