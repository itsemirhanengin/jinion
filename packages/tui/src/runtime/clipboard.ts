import { spawn } from 'node:child_process';

/** How text gets to the clipboard: the system's own tool, or the terminal through OSC 52. */
export type ClipboardMethod = 'system' | 'osc52';

/** OSC 52: the terminal puts the text on the clipboard of the machine it runs on, over SSH too. */
export const osc52 = (text: string) => `\x1b]52;c;${Buffer.from(text).toString('base64')}\x07`;

/** The tools that put text on this machine's clipboard, first the ones most likely to be there. */
function systemTools(platform: NodeJS.Platform, env: NodeJS.ProcessEnv): [string, string[]][] {
  if (platform === 'darwin') return [['pbcopy', []]];
  if (platform === 'win32') return [['powershell', ['-NoProfile', '-Command', '$input | Set-Clipboard']]];
  const tools: [string, string[]][] = [
    ['xclip', ['-selection', 'clipboard']],
    ['xsel', ['--clipboard', '--input']],
  ];
  return env.WAYLAND_DISPLAY ? [['wl-copy', []], ...tools] : tools;
}

function pipe(command: string, args: string[], text: string) {
  return new Promise<boolean>((resolve) => {
    const child = spawn(command, args, { stdio: ['pipe', 'ignore', 'ignore'] });
    child.on('error', () => resolve(false));
    child.on('close', (code) => resolve(code === 0));
    child.stdin.end(text);
  });
}

/**
 * Puts `text` on the clipboard, as Claude Code does: through the system's tool when Jinion runs on the machine in front
 * of the user, and through the terminal (`write`) over SSH or where no tool works. Inside tmux it also goes to tmux's
 * paste buffer. Whether it got anywhere.
 */
export async function copyToClipboard(
  text: string,
  write: (data: string) => void,
  { method = 'system', platform = process.platform, env = process.env }: { method?: ClipboardMethod; platform?: NodeJS.Platform; env?: NodeJS.ProcessEnv } = {},
) {
  if (env.TMUX) void pipe('tmux', ['load-buffer', '-'], text);
  const remote = Boolean(env.SSH_CONNECTION || env.SSH_TTY);
  if (method === 'system' && !remote) {
    for (const [command, args] of systemTools(platform, env)) {
      if (await pipe(command, args, text)) return true;
    }
  }
  write(osc52(text));
  return true;
}
