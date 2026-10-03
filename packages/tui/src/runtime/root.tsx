import { useState, type ReactNode } from 'react';
import { Box, useWindowSize } from 'ink';
import type { Theme } from '../theme/themes.js';
import type { MouseListener } from './input.js';
import { MouseContext } from './mouse.js';
import { PanelsProvider } from './panels.js';
import { NO_TERMINAL, TerminalContext, type TerminalControl } from './terminal.js';
import { ThemeContext } from './theme.js';
import { ToastProvider } from './toast.js';
import { ViewProvider } from './view.js';
import { WidthContext } from './width.js';

export interface RootProps {
  theme: Theme;
  mouse?: Set<MouseListener>;
  terminal?: TerminalControl;
  children: ReactNode;
}

export function Root({ theme, mouse, terminal, children }: RootProps) {
  const { columns, rows } = useWindowSize();
  // Without `mouse`, components still listen, but no events come.
  const [silent] = useState(() => new Set<MouseListener>());

  return (
    <ThemeContext.Provider value={theme}>
      <WidthContext.Provider value={columns}>
        <ViewProvider>
          <MouseContext.Provider value={mouse ?? silent}>
            <TerminalContext.Provider value={terminal ?? NO_TERMINAL}>
              <ToastProvider>
                <PanelsProvider>
                  <Box flexDirection="column" width={columns} height={rows}>
                    {children}
                  </Box>
                </PanelsProvider>
              </ToastProvider>
            </TerminalContext.Provider>
          </MouseContext.Provider>
        </ViewProvider>
      </WidthContext.Provider>
    </ThemeContext.Provider>
  );
}
