import { homedir } from 'node:os';
import { join } from 'node:path';

export const jinionHome = () => process.env.JINION_HOME ?? join(homedir(), '.jinion');

export const projectSlug = (cwd: string) => cwd.replace(/[^a-zA-Z0-9]/g, '-');

export const projectDir = (cwd: string) => join(jinionHome(), 'projects', projectSlug(cwd));

export function tildify(path: string) {
  const home = homedir();
  return path === home || path.startsWith(`${home}/`) ? `~${path.slice(home.length)}` : path;
}
