import { spawn } from 'node:child_process';

export type ClipboardMethod = 'system' | 'osc52';

/** OSC 52: the terminal sets the clipboard of the machine it runs on, so it works over SSH too. */
export const osc52 = (text: string) => `\x1b]52;c;${Buffer.from(text).toString('base64')}\x07`;

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
 * As Claude Code does: the system's tool locally, the terminal (`write`) over SSH or where no tool works, and
 * tmux's paste buffer inside tmux.
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
