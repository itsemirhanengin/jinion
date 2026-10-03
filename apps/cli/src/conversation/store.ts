import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { readJson, writeJson } from '../lib/json-file.js';
import { projectDir } from '../lib/paths.js';
import type { SavedSession } from './session.js';

export interface SessionStore {
  /** Most recently updated first. */
  list(): SavedSession[];
  save(session: SavedSession): void;
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
}

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
}
