import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { jinionHome } from './paths.js';

/**
 * `start` is how a backend process was started, `prompt` what went to it, `message` what came back, `stderr` what it
 * printed, and `error` how a turn failed.
 */
export type DebugKind = 'start' | 'prompt' | 'message' | 'stderr' | 'error';

export interface DebugRecord {
  at: number;
  kind: DebugKind;
  data: unknown;
}

/**
 * `--debug`: one JSON line per record in `~/.jinion/logs/<time>.jsonl`, written as it happens, so the file is
 * complete up to a crash. `test/fixture.ts` turns a log into a fixture for the replay tests.
 */
export class DebugLog {
  readonly path: string;

  constructor(directory = join(jinionHome(), 'logs')) {
    mkdirSync(directory, { recursive: true });
    this.path = join(directory, `${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`);
  }

  write(kind: DebugKind, data: unknown) {
    const record: DebugRecord = { at: Date.now(), kind, data };
    appendFileSync(this.path, `${JSON.stringify(record)}\n`);
  }
}
