import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach } from 'vitest';

const VARIABLES = ['HOME', 'JINION_HOME', 'CLAUDE_CONFIG_DIR'] as const;

export interface Sandbox {
  home: string;
  project: string;
  write(path: string, content: unknown): string;
  restore(): void;
}

/** Tests never touch the real `~/.claude` or `~/.jinion`: `homedir()` follows `HOME`, Jinion's paths follow `JINION_HOME`. */
export function sandbox(): Sandbox {
  const root = mkdtempSync(join(tmpdir(), 'jinion-test-'));
  const saved = Object.fromEntries(VARIABLES.map((name) => [name, process.env[name]]));
  const home = join(root, 'home');
  const project = join(root, 'project');
  mkdirSync(home, { recursive: true });
  mkdirSync(project, { recursive: true });
  process.env.HOME = home;
  process.env.JINION_HOME = join(home, '.jinion');
  delete process.env.CLAUDE_CONFIG_DIR;

  return {
    home,
    project,
    write(path, content) {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, typeof content === 'string' || Buffer.isBuffer(content) ? content : JSON.stringify(content));
      return path;
    },
    restore() {
      for (const name of VARIABLES) {
        if (saved[name] === undefined) delete process.env[name];
        else process.env[name] = saved[name];
      }
      rmSync(root, { recursive: true, force: true });
    },
  };
}

export function sandboxEach(): Sandbox {
  const box = {} as Sandbox;
  beforeEach(() => void Object.assign(box, sandbox()));
  afterEach(() => box.restore());
  return box;
}
