import { copyToClipboard, type ClipboardMethod } from './clipboard.js';

/** How a terminal shows a desktop notification: one of three escape sequences, or only its bell. */
export type NotificationMethod = 'osc777' | 'osc9' | 'osc99' | 'bell';

/** The app's line to the terminal window: whether it has focus, and notifications. */
export interface TerminalControl {
  /** Whether the window has focus, as the terminal reports it; `true` until it says otherwise. */
  focused(): boolean;
  method: NotificationMethod;
  /** Shows a desktop notification, or rings the bell in a terminal without them. */
  notify(title: string, body: string): void;
  /**
   * The mouse pointer's shape over the window: a hand over something to click. Terminals that can't change it, or don't
   * know the sequence, leave it as it is.
   */
  pointer(shape: PointerShape): void;
  /** Puts text on the clipboard; whether it got there. */
  copy(text: string): Promise<boolean>;
}

export type PointerShape = 'default' | 'pointer';

/** OSC 22, as xterm, kitty, foot and Ghostty read it. */
export const pointerSequence = (shape: PointerShape) => `\x1b]22;${shape}\x07`;

/** The terminal's own escape sequence where it has one, from what it says it is. */
export function notificationMethod(env: NodeJS.ProcessEnv = process.env): NotificationMethod {
  // A multiplexer keeps escape sequences from the terminal around it, but passes the bell on.
  if (env.TMUX || env.STY) return 'bell';
  const program = env.TERM_PROGRAM ?? '';
  if (program === 'iTerm.app') return 'osc9';
  if (env.KITTY_WINDOW_ID || env.TERM === 'xterm-kitty') return 'osc99';
  if (['ghostty', 'WezTerm', 'WarpTerminal'].includes(program) || /^(foot|rxvt)/.test(env.TERM ?? '')) return 'osc777';
  return 'bell';
}

/** Control characters would end the sequence early. */
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

/** A control that writes with `write` and learns about focus through `setFocused`. */
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
