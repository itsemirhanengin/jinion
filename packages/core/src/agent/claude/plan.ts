import { readFileSync } from 'node:fs';
import { type Input, text } from './input.js';
import { isPlanFile } from './paths.js';

/** The plan Claude Code wrote last in plan mode, which its `ExitPlanMode` call no longer carries. */
export class PlanFile {
  private path?: string;
  private text?: string;

  writes(input: Input) {
    const path = text(input.file_path);
    if (!path || !isPlanFile(path)) return false;

    this.path = path;

    if (typeof input.content === 'string') this.text = input.content;
    else if (this.text !== undefined) this.text = this.text.replace(text(input.old_string), text(input.new_string));

    return true;
  }

  /** Falls back to what the calls wrote when the file can't be read, e.g. in a replayed conversation. */
  read() {
    try {
      return this.path ? readFileSync(this.path, 'utf8') : '';
    } catch {
      return this.text ?? '';
    }
  }
}
