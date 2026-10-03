import { createContext, useContext } from 'react';
import { copyToClipboard, type ClipboardMethod } from './clipboard.js';

export type NotificationMethod = 'osc777' | 'osc9' | 'osc99' | 'bell';

export interface TerminalControl {
  focused(): boolean;
  method: NotificationMethod;
  notify(title: string, body: string): void;
  pointer(shape: PointerShape): void;
  copy(text: string): Promise<boolean>;
}

export type PointerShape = 'default' | 'pointer';

/** OSC 22, as xterm, kitty, foot and Ghostty read it. */
export const pointerSequence = (shape: PointerShape) => `\x1b]22;${shape}\x07`;

export function notificationMethod(env: NodeJS.ProcessEnv = process.env): NotificationMethod {
  // A multiplexer keeps escape sequences from the terminal around it, but passes the bell on.
  if (env.TMUX || env.STY) return 'bell';
  const program = env.TERM_PROGRAM ?? '';
  if (program === 'iTerm.app') return 'osc9';
  if (env.KITTY_WINDOW_ID || env.TERM === 'xterm-kitty') return 'osc99';
  if (['ghostty', 'WezTerm', 'WarpTerminal'].includes(program) || /^(foot|rxvt)/.test(env.TERM ?? '')) return 'osc777';
  return 'bell';
}

// Control characters would end the sequence early.
const clean = (text: string) => text.replace(/[\x00-\x1f\x7f]/g, ' ');

export function notificationSequence(method: NotificationMethod, title: string, body: string) {
  switch (method) {
    case 'osc777':
      return `\x1b]777;notify;${clean(title).replaceAll(';', ',')};${clean(body)}\x07`;
    case 'osc9':
      return `\x1b]9;${clean(`${title}: ${body}`)}\x07`;
    case 'osc99':
      // The title in one part, the body in the last one.
      return `\x1b]99;i=1:d=0;${clean(title)}\x1b\\\x1b]99;i=1:p=body;${clean(body)}\x1b\\`;
    case 'bell':
      return '\x07';
  }
}

export function createTerminalControl(
  write: (data: string) => void,
  method = notificationMethod(),
  clipboard: ClipboardMethod = 'system',
) {
  let focused = true;
  let shape: PointerShape = 'default';
  const control: TerminalControl = {
    focused: () => focused,
    method,
    notify: (title, body) => write(notificationSequence(method, title, body)),
    pointer: (next) => {
      if (next === shape) return;
      shape = next;
      write(pointerSequence(next));
    },
    copy: (text) => copyToClipboard(text, write, { method: clipboard }),
  };
  return {
    control,
    setFocused: (value: boolean) => {
      focused = value;
    },
  };
}

export const NO_TERMINAL = createTerminalControl(() => {}, 'bell').control;
export const TerminalContext = createContext<TerminalControl>(NO_TERMINAL);

export const useTerminal = () => useContext(TerminalContext);
