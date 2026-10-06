import { execFile } from 'node:child_process';

/** The user's name as git has it for the folder, their own global one unless the folder sets another; none without. */
export function gitUserName(cwd: string) {
  return new Promise<string | undefined>((resolve) => {
    execFile('git', ['config', 'user.name'], { cwd, timeout: 2000 }, (error, stdout) => resolve(error ? undefined : stdout.trim() || undefined));
  });
}
