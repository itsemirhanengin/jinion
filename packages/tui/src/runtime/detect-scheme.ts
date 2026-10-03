import type { ColorScheme } from '../theme/themes.js';
import { hexColor } from '../utils/color.js';

interface DetectOptions {
  stdin?: NodeJS.ReadStream;
  stdout?: NodeJS.WriteStream;
  timeout?: number;
}

const BACKGROUND_QUERY = '\x1b]11;?\x1b\\';
const DEVICE_ATTRIBUTES_QUERY = '\x1b[c';
const BACKGROUND_REPLY = /\]11;rgba?:([0-9a-f]+)\/([0-9a-f]+)\/([0-9a-f]+)/i;
const DEVICE_ATTRIBUTES_REPLY = /\x1b\[\?[\d;]*c/;

export interface TerminalBackground {
  scheme: ColorScheme;
  color?: string;
}

/**
 * Asks for OSC 11 and then device attributes, which every terminal answers. Replies come in order, so the second
 * arriving first means OSC 11 is unsupported. Falls back to `COLORFGBG`, then to dark.
 */
export async function detectBackground(options: DetectOptions = {}): Promise<TerminalBackground> {
  const { stdin = process.stdin, stdout = process.stdout, timeout = 200 } = options;
  const fallback = { scheme: schemeFromColorFgBg(process.env.COLORFGBG) ?? 'dark' } as const;

  if (!stdin.isTTY || !stdout.isTTY) return fallback;

  const reply = await queryTerminal(stdin, stdout, timeout);
  const match = reply && BACKGROUND_REPLY.exec(reply);
  if (!match) return fallback;

  const [r, g, b] = match.slice(1, 4).map(normalizeChannel) as [number, number, number];
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return { scheme: luminance > 0.5 ? 'light' : 'dark', color: hexColor([r, g, b].map((channel) => channel * 255)) };
}

export async function detectColorScheme(options: DetectOptions = {}): Promise<ColorScheme> {
  return (await detectBackground(options)).scheme;
}

function queryTerminal(stdin: NodeJS.ReadStream, stdout: NodeJS.WriteStream, timeout: number) {
  return new Promise<string | undefined>((resolve) => {
    const wasRaw = stdin.isRaw;
    let buffer = '';

    const finish = (value: string | undefined) => {
      clearTimeout(timer);
      stdin.off('data', onData);
      stdin.setRawMode(wasRaw);
      stdin.pause();
      resolve(value);
    };

    const onData = (chunk: Buffer) => {
      buffer += chunk.toString('latin1');
      if (DEVICE_ATTRIBUTES_REPLY.test(buffer)) finish(buffer);
    };

    const timer = setTimeout(() => finish(buffer || undefined), timeout);
    stdin.setRawMode(true);
    stdin.on('data', onData);
    stdin.resume();
    stdout.write(BACKGROUND_QUERY + DEVICE_ATTRIBUTES_QUERY);
  });
}

function normalizeChannel(hex: string) {
  return Number.parseInt(hex, 16) / (16 ** hex.length - 1);
}

function schemeFromColorFgBg(value: string | undefined): ColorScheme | undefined {
  const background = Number(value?.split(';').at(-1));
  if (!Number.isInteger(background)) return undefined;
  return background === 7 || background === 15 ? 'light' : 'dark';
}
