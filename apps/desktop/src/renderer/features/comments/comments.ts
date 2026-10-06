import type { DiffComment, DiffLine } from '@jinion/ui/chat';
import type { Submission } from '../../core/core.js';
import { counted } from '../../lib/numbers.js';
import type { DraftComment } from '../../state/comments.js';

/**
 * The comments as the diff draws them now: each on the lines it was left on, found again by their text where the file
 * has moved them, or outdated once they are gone.
 */
export function placeComments(comments: DraftComment[], lines: DiffLine[]): DiffComment[] {
  return comments.map(({ id, text, lines: commented }) => {
    const from = lines.findIndex((_, start) => commented.every((line, offset) => sameLine(lines[start + offset], line)));

    return from === -1 ? { id, text } : { id, text, from, to: from + commented.length - 1 };
  });
}

/**
 * The message with the comments: the conversation shows how many there are, and the agent gets each with the lines it
 * is on, as the diff showed them.
 */
export function withComments(submission: Submission, comments: DraftComment[]): Submission {
  if (comments.length === 0) return submission;

  const files = new Set(comments.map((comment) => comment.path)).size;
  const summary = `${counted(comments.length, 'comment')} on the diff of ${counted(files, 'file')}`;
  const typed = submission.prompt?.text ?? submission.text;

  const review = [
    'I left comments on the diff. Each names the file and the lines it is on, quoted from the diff, then what I ask there.',
    ...comments.map((comment) => `${comment.path}, ${whereOf(comment.lines)}:\n\`\`\`diff\n${comment.lines.map(asDiff).join('\n')}\n\`\`\`\n${comment.text}`),
  ].join('\n\n');

  return {
    text: submission.text ? `${submission.text}\n\n${summary}` : summary,
    prompt: { ...submission.prompt, text: typed ? `${typed}\n\n${review}` : review },
  };
}

/** `line 12`, `lines 12-15`, by the new file's numbers; by the old file's when only removed lines are commented on. */
function whereOf(lines: DiffLine[]) {
  const kept = lines.filter((line) => line.kind !== 'removed' && line.number !== undefined);
  const numbers = (kept.length > 0 ? kept : lines).map((line) => line.number).filter((number) => number !== undefined);
  const first = numbers[0];
  const last = numbers.at(-1);
  const span = first === last ? `line ${first}` : `lines ${first}-${last}`;

  return kept.length > 0 ? span : `the removed ${span}`;
}

const SIGNS = { context: ' ', added: '+', removed: '-' } as const;

const asDiff = (line: DiffLine) => `${SIGNS[line.kind]}${line.text}`;

const sameLine = (line: DiffLine | undefined, other: DiffLine) => line !== undefined && line.kind === other.kind && line.text === other.text;
