import type { ITheme } from '@xterm/xterm';

// A prompt's icons sit in Nerd Fonts' private glyphs, which JetBrains Mono lacks; the first of these installed draws them.
// xterm parses colors itself and doesn't know `transparent`, which it would replace with its own gray.
const CLEAR = 'rgba(0, 0, 0, 0)';

export const TERMINAL_FONT =
  '"JetBrains Mono Variable", "Symbols Nerd Font Mono", "MesloLGS NF", "MesloLGL Nerd Font Mono", "MesloLGS Nerd Font Mono", "JetBrainsMono Nerd Font Mono", "Hack Nerd Font Mono", ui-monospace, Menlo, monospace';

// The sixteen colors programs print in, picked to sit with the app's own: the same reds and greens as a diff's.
const LIGHT: ITheme = {
  black: '#3f3f46',
  red: '#dc2626',
  green: '#059669',
  yellow: '#b45309',
  blue: '#2563eb',
  magenta: '#7c3aed',
  cyan: '#0e7490',
  white: '#a1a1aa',
  brightBlack: '#71717a',
  brightRed: '#ef4444',
  brightGreen: '#10b981',
  brightYellow: '#d97706',
  brightBlue: '#3b82f6',
  brightMagenta: '#8b5cf6',
  brightCyan: '#0891b2',
  brightWhite: '#d4d4d8',
};

const DARK: ITheme = {
  black: '#52525b',
  red: '#f87171',
  green: '#34d399',
  yellow: '#fbbf24',
  blue: '#60a5fa',
  magenta: '#c4b5fd',
  cyan: '#67e8f9',
  white: '#d4d4d8',
  brightBlack: '#71717a',
  brightRed: '#fca5a5',
  brightGreen: '#6ee7b7',
  brightYellow: '#fcd34d',
  brightBlue: '#93c5fd',
  brightMagenta: '#ddd6fe',
  brightCyan: '#a5f3fc',
  brightWhite: '#fafafa',
};

/** The terminal in the window's colors, light or dark as the window is now. */
export function terminalTheme(): ITheme {
  const root = document.documentElement;
  const style = getComputedStyle(root);
  const token = (name: string) => style.getPropertyValue(name).trim();

  const ink = token('--ink');

  return {
    ...(root.classList.contains('dark') ? DARK : LIGHT),
    background: token('--background'),
    foreground: ink,
    cursor: ink,
    cursorAccent: token('--background'),
    selectionBackground: token('--selection'),
    // The thumb is drawn in terminal.css, as the window's other scrollbars are.
    scrollbarSliderBackground: CLEAR,
    scrollbarSliderHoverBackground: CLEAR,
    scrollbarSliderActiveBackground: CLEAR,
  };
}
