import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { withFileLock } from '../lib/file-lock.js';
import { readJson, writeJson } from '../lib/json-file.js';
import { projectDir } from '../lib/paths.js';
import { isRunning } from '../lib/processes.js';
import type { SavedSession } from './session.js';

export interface SessionStore {
  /** Most recently updated first. */
  list(): SavedSession[];
  save(session: SavedSession): void;
  /** Marks the conversation as open in this process; the pid of another that has it open instead. */
  claim(id: string): number | undefined;
  release(id: string): void;
  /** The pid of another process that has the conversation open. */
  openElsewhere(id: string): number | undefined;
}

export class FileSessionStore implements SessionStore {
  private readonly dir: string;

  constructor(cwd: string) {
    this.dir = join(projectDir(cwd), 'sessions');
  }

  list() {
    if (!existsSync(this.dir)) return [];

    return readdirSync(this.dir)
      .filter((name) => name.endsWith('.json'))
      .flatMap((name) => {
        const session = readJson<SavedSession | undefined>(join(this.dir, name), undefined);

        return session ? [session] : [];
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  save(session: SavedSession) {
    writeJson(join(this.dir, `${session.id}.json`), session);
  }

  claim(id: string) {
    const path = this.claimPath(id);

    return withFileLock(path, () => {
      const owner = this.openElsewhere(id);

      if (owner === undefined) writeFileSync(path, `${process.pid}\n`);

      return owner;
    });
  }

  release(id: string) {
    if (this.owner(id) === process.pid) rmSync(this.claimPath(id), { force: true });
  }

  openElsewhere(id: string) {
    const owner = this.owner(id);

    return owner !== undefined && owner !== process.pid && isRunning(owner) ? owner : undefined;
  }

  private owner(id: string) {
    try {
      return Number(readFileSync(this.claimPath(id), 'utf8').trim()) || undefined;
    } catch {
      return undefined;
    }
  }

  private claimPath(id: string) {
    return join(this.dir, `${id}.open`);
  }
}

/** Holds conversations for the demo and tests, which no other process shares. */
export class MemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, SavedSession>();

  constructor(seed: SavedSession[] = []) {
    for (const session of seed) this.sessions.set(session.id, session);
  }

  list() {
    return [...this.sessions.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  save(session: SavedSession) {
    this.sessions.set(session.id, session);
  }

  claim() {
    return undefined;
  }

  release() {}

  openElsewhere() {
    return undefined;
  }
}
