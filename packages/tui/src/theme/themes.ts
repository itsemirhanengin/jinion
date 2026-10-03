export type ColorScheme = 'dark' | 'light';

export type Tone = 'neutral' | 'pending' | 'success' | 'error';

export interface Theme {
  scheme: ColorScheme;
  muted: string;
  border: string;
  accent: string;
  success: string;
  warning: string;
  error: string;
  heading: string;
  code: string;
  link: string;
  thinking: string;
  /** Highlighted row in lists, menus and question options. */
  selection: string;
  /** Behind selected text, which keeps its own colors on it. */
  selectionBackground: string;
  /** The terminal's own background as `#rrggbb`, when it said what it is; shades such as hovering are worked out from it. */
  background?: string;
  surface: Record<Tone, string> & { user: string };
  diff: {
    added: string;
    removed: string;
    addedBg: string;
    removedBg: string;
    addedHighlight: string;
    removedHighlight: string;
  };
  syntax: {
    command: string;
    string: string;
    operator: string;
    flag: string;
    variable: string;
  };
  status: {
    model: string;
    directory: string;
    cost: string;
  };
  /** Heatmap shades: a day with nothing, then four levels from the least to the most. */
  heat: [string, string, string, string, string];
}

export const darkTheme: Theme = {
  scheme: 'dark',
  muted: '#7f8590',
  border: '#5a606b',
  accent: '#61afef',
  success: '#98c379',
  warning: '#e5c07b',
  error: '#e06c75',
  heading: '#e5c07b',
  code: '#56b6c2',
  link: '#61afef',
  thinking: '#8a909a',
  selection: '#56b6c2',
  selectionBackground: '#264f78',
  surface: {
    neutral: '#1f2228',
    pending: '#1d2230',
    success: '#1b261d',
    error: '#2c1c1f',
    user: '#262a33',
  },
  diff: {
    added: '#98c379',
    removed: '#e06c75',
    addedBg: '#1f3324',
    removedBg: '#3a2024',
    addedHighlight: '#2f5536',
    removedHighlight: '#6a2d35',
  },
  syntax: {
    command: '#e5c07b',
    string: '#ce9178',
    operator: '#61afef',
    flag: '#56b6c2',
    variable: '#c678dd',
  },
  status: {
    model: '#61afef',
    directory: '#56b6c2',
    cost: '#c678dd',
  },
  heat: ['#3a3f47', '#0e4429', '#006d32', '#26a641', '#39d353'],
};

export const lightTheme: Theme = {
  scheme: 'light',
  muted: '#8b8f98',
  border: '#a0a4ab',
  accent: '#3b7dd8',
  success: '#3f8f3f',
  warning: '#b7791f',
  error: '#c4413c',
  heading: '#b5891c',
  code: '#2b8a8a',
  link: '#3b7dd8',
  thinking: '#6e737c',
  selection: '#2b8a8a',
  selectionBackground: '#add6ff',
  surface: {
    neutral: '#e9e9ef',
    pending: '#e4e8f3',
    success: '#e1ecdc',
    error: '#f3e0e0',
    user: '#e3e5ee',
  },
  diff: {
    added: '#2e7d32',
    removed: '#b3372f',
    addedBg: '#d2e9cc',
    removedBg: '#f3d6d4',
    addedHighlight: '#a6d69c',
    removedHighlight: '#eba5a0',
  },
  syntax: {
    command: '#a8761a',
    string: '#b0503a',
    operator: '#3b7dd8',
    flag: '#2b8a8a',
    variable: '#8a4fc0',
  },
  status: {
    model: '#3b7dd8',
    directory: '#2b8a8a',
    cost: '#9a4fc4',
  },
  heat: ['#d8dbe0', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
};

export const themes: Record<ColorScheme, Theme> = {
  dark: darkTheme,
  light: lightTheme,
};

/** What a terminal's background most likely is when it doesn't say. */
const DEFAULT_BACKGROUND: Record<ColorScheme, string> = { dark: '#1e1e1e', light: '#ffffff' };

/** How far hovering moves a color: a plain background a little, a tinted surface only a touch, so it keeps its color. */
const HOVER_PLAIN = 0.04;
const HOVER_TINTED = 0.04;

/**
 * `color` (`#rrggbb`) moved `amount` of the way, from 0 to 1, to black on a light background or to white on a dark
 * one: a shade that stands out from it without changing its hue.
 */
export function shade(theme: Pick<Theme, 'scheme'>, color: string, amount: number) {
  const target = theme.scheme === 'light' ? 0 : 255;
  const channels = [1, 3, 5].map((at) => Number.parseInt(color.slice(at, at + 2), 16));
  return `#${channels.map((channel) => Math.round(channel + (target - channel) * amount).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * The background of something under the pointer that a click does something with: `background`, the color it has, a
 * touch darker or lighter, or, with none, the terminal's own a little.
 */
export function hoverColor(theme: Theme, background?: string) {
  if (background) return shade(theme, background, HOVER_TINTED);
  return shade(theme, theme.background ?? DEFAULT_BACKGROUND[theme.scheme], HOVER_PLAIN);
}
