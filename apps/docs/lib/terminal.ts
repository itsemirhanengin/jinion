import type { CSSProperties } from 'react';

// Screens mark spans with names from the TUI's theme (packages/tui/src/theme/themes.ts), whose colors global.css
// copies for light and dark: `{accent,bold|jinion}`, `{muted|v0.1.0}`, `{on-user|> fix the tests}`.
export const marks = /\{([a-z,-]+)\|([^}]*)\}/g;

const colors = new Set([
  'muted',
  'border',
  'accent',
  'success',
  'warning',
  'error',
  'heading',
  'code',
  'link',
  'thinking',
  'selection',
  'model',
  'directory',
  'cost',
  'added',
  'removed',
  'command',
  'string',
  'operator',
  'flag',
  'variable',
]);
const backgrounds = new Set(['surface', 'user', 'added-bg', 'removed-bg']);
const styles: Record<string, CSSProperties> = {
  bold: { fontWeight: 700 },
  italic: { fontStyle: 'italic' },
  dim: { opacity: 0.65 },
  underline: { textDecoration: 'underline' },
};

/** The style of a mark's names, or `undefined` when one isn't known, so the mark stays as written and shows. */
export function styleOf(names: string): CSSProperties | undefined {
  let style: CSSProperties = {};
  for (const name of names.split(',')) {
    if (colors.has(name)) style.color = `var(--t-${name})`;
    else if (name.startsWith('on-') && backgrounds.has(name.slice(3))) style.backgroundColor = `var(--t-${name.slice(3)})`;
    else if (styles[name]) style = { ...style, ...styles[name] };
    else return undefined;
  }
  return style;
}

/** The screen without its marks, as the Markdown versions of a page show it. */
export function plain(screen: string): string {
  return screen.replace(marks, (whole, names: string, text: string) => (styleOf(names) ? text : whole));
}
