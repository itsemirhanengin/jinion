import { randomBytes } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { jinionHome } from '../lib/paths.js';

/** How to reach a running `jinion serve`. It holds the token, so only the user can read it. */
export interface ServerFile {
  url: string;
  token: string;
  /** The project it serves. */
  cwd: string;
  pid: number;
  version: string;
}

const folder = () => join(jinionHome(), 'servers');

export const newToken = () => randomBytes(32).toString('base64url');

/** One file per server process; the path, to remove it as the server stops. */
export function writeServerFile(server: ServerFile) {
  const path = join(folder(), `${server.pid}.json`);

  mkdirSync(folder(), { recursive: true, mode: 0o700 });
  writeFileSync(path, `${JSON.stringify(server, null, 2)}\n`, { mode: 0o600 });
  // The mode above only applies to a file it creates.
  chmodSync(path, 0o600);

  return path;
}

export const removeServerFile = (path: string) => rmSync(path, { force: true });

/** The server running for `cwd`, the one started last when there are several; files of servers gone are removed. */
export function findServer(cwd: string): ServerFile | undefined {
  if (!existsSync(folder())) return undefined;

  const servers = readdirSync(folder())
    .filter((name) => name.endsWith('.json'))
    .flatMap((name) => {
      const path = join(folder(), name);
      const server = read(path);

      if (server && running(server.pid)) return [server];

      removeServerFile(path);

      return [];
    });

  return servers.filter((server) => server.cwd === cwd).at(-1);
}

function read(path: string) {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as ServerFile;
  } catch {
    return undefined;
  }
}

function running(pid: number) {
  try {
    process.kill(pid, 0);

    return true;
  } catch (error) {
    // EPERM: it runs, as another user.
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}
