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
};

export const themes: Record<ColorScheme, Theme> = {
  dark: darkTheme,
  light: lightTheme,
};
