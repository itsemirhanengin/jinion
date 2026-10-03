import type { ReactNode } from 'react';
import { render, type RenderOptions } from 'ink';
import type { Theme } from '../theme/themes.js';
import { DRAWING } from './drawing.js';
import { createInput, type MouseListener } from './input.js';
import { Root } from './root.js';
import { tapStream } from './screen.js';
import { SelectionLayer } from './selection.js';
import type { createTerminalControl } from './terminal.js';

export interface MountOptions {
  theme: Theme;
  terminal: ReturnType<typeof createTerminalControl>;
  keyboard?: NodeJS.ReadStream;
  display?: NodeJS.WriteStream;
  ink?: RenderOptions;
}

export function mount(node: ReactNode, { theme, terminal, keyboard, display, ink }: MountOptions) {
  const mouse = new Set<MouseListener>();
  const screen = display && tapStream(display);

  const input =
    keyboard &&
    createInput(
      keyboard,
      (event) => {
        for (const listener of mouse) listener(event);
      },
      terminal.setFocused,
    );

  const instance = render(
    <Root theme={theme} mouse={mouse} terminal={terminal.control}>
      <SelectionLayer screen={screen}>{node}</SelectionLayer>
    </Root>,
    { stdin: input?.stdin, ...DRAWING, ...ink },
  );

  return { instance, close: () => input?.close() };
}
