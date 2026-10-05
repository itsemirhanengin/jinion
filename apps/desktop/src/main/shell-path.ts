import { execFileSync } from 'node:child_process';

const MARK = '__JINION_PATH__';

/**
 * The PATH the user's login shell sets up. An app opened from the Finder gets launchd's short one instead, where the
 * commands the agents run (git, pnpm, node) aren't found. `undefined` when the shell doesn't answer in time.
 */
export function shellPath() {
  try {
    // Interactive, so what .zshrc adds counts too; the mark finds the line among anything the shell prints itself.
    const output = execFileSync(process.env.SHELL || '/bin/zsh', ['-ilc', `printf '${MARK}%s${MARK}' "$PATH"`], {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    return output.split(MARK)[1] || undefined;
  } catch {
    return undefined;
  }
}
