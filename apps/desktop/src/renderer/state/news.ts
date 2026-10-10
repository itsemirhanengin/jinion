import type { ToolRun } from '@jinion/core/agent/tools';
import type { SessionSnapshot } from '@jinion/core/api/schemas';
import { changesOf } from './session.js';

/** A thread's latest news in one line, as the thread list and the cards say it: what it asks, what it does, or its last words. */
export function newsOf({ state, fields }: SessionSnapshot): string | undefined {
  const { dialog } = fields;

  if (dialog?.id === 'ask') return dialog.questions[0]?.prompt;
  if (dialog?.id === 'permission') return `Asks to run ${dialog.request.command ?? dialog.request.title}`;
  if (dialog?.id === 'plan') return 'A plan is ready for you';

  const last = state.entries.findLast((entry) => entry.kind === 'text' || entry.kind === 'tool' || entry.kind === 'notice');

  if (fields.working && last?.kind === 'tool') return doing(last.run);
  if (fields.working) return 'Thinking';
  if (last?.kind === 'text') return firstLine(last.text);
  if (last?.kind === 'notice') return last.text;

  return undefined;
}

/** What the agent said last, its markdown taken out, for a card to show a few lines of. */
export function lastWordsOf({ state }: SessionSnapshot) {
  const last = state.entries.findLast((entry) => entry.kind === 'text');

  return last?.kind === 'text' ? last.text.replace(/^#+\s*|[*_`>]/gm, '').trim() : undefined;
}

/** The lines the thread's own edits added and removed, over every file. */
export function countsOf(snapshot: SessionSnapshot) {
  const files = changesOf(snapshot);

  return { added: files.reduce((sum, file) => sum + file.added, 0), removed: files.reduce((sum, file) => sum + file.removed, 0) };
}

function doing(run: ToolRun) {
  switch (run.name) {
    case 'read':
      return `Reading ${nameOf(run.input.files[0]?.path ?? '')}`;
    case 'edit':
      return `${run.input.created ? 'Creating' : 'Editing'} ${nameOf(run.input.path)}`;
    case 'bash':
      return `Running ${run.input.command}`;
    case 'grep':
    case 'glob':
      return 'Searching the code';
    case 'search':
      return 'Searching the web';
    case 'fetch':
      return `Reading ${run.input.url}`;
    case 'agent':
      return run.input.description;
    case 'other':
      return run.input.title;
    default:
      return 'Working';
  }
}

const nameOf = (path: string) => path.slice(path.lastIndexOf('/') + 1);

/** The first line with words in it, without the markdown that marks it up. */
function firstLine(text: string) {
  const line = text.split('\n').find((each) => each.trim().length > 0) ?? '';

  return line.replace(/^#+\s*|[*_`]/g, '').trim();
}
