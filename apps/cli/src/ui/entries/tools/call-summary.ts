import type { ToolRun } from '../../../agent/tools.js';
import { plural } from '../../../lib/format.js';
import { firstLine } from '../../../lib/text.js';

export const MEMORY_VERBS = { remember: 'Remember', recall: 'Recall', forget: 'Forget' } as const;

export function callSummary(run: ToolRun): [name: string, detail?: string] {
  switch (run.name) {
    case 'read':
      return ['Read', run.input.files.map((file) => file.path).join(', ')];
    case 'grep': {
      const found = run.result && (run.result.files ? plural(run.result.files.length, 'file') : plural(run.result.matches.length, 'match', 'matches'));
      return ['Grep', found ? `${run.input.pattern} · ${found}` : run.input.pattern];
    }
    case 'glob':
      return ['Glob', run.result ? `${run.input.pattern} · ${plural(run.result.files.length, 'file')}` : run.input.pattern];
    case 'bash': {
      const command = firstLine(run.input.command);
      return ['Bash', run.result?.exitCode ? `${command} · exit ${run.result.exitCode}` : command];
    }
    case 'edit':
      return [run.input.created ? 'Write' : 'Edit', run.input.path];
    case 'memory':
      return [MEMORY_VERBS[run.input.action], run.input.detail];
    case 'other':
      return [run.input.title, run.input.detail];
    case 'agent':
      return ['Agent', run.input.description];
    case 'todo':
      return ['Tasks'];
    case 'ask':
      return ['Ask'];
    case 'plan':
      return ['Plan'];
  }
}
