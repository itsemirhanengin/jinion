import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { jinionHome } from './paths.js';

export type DebugKind = 'start' | 'prompt' | 'message' | 'stderr' | 'error';

export interface DebugRecord {
  at: number;
  kind: DebugKind;
  data: unknown;
}

/** Written as it happens, so the log is complete up to a crash. */
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
