import { parseSync } from 'oxc-parser';
import { groups, type AstNode, type Comment, type Group } from './ast.js';
import { Lines } from './lines.js';
import { Rules, type Spacing } from './rules.js';

export interface Issue {
  line: number;
  message: string;
}

export interface Result {
  issues: Issue[];
  fixed: string;
  error?: string;
}

/** Only whitespace lies between the lines `after` and `before`, so the gap can be rewritten as a whole. */
interface Gap {
  after: number;
  before: number;
  blanks: number;
  wanted: number;
  message: string;
}

export function checkSpacing(source: string, filename: string): Result {
  const parsed = parseSync(filename, source);
  if (parsed.errors.length > 0) return { issues: [], fixed: source, error: parsed.errors[0]!.message };

  const lines = new Lines(source);
  const comments = parsed.comments as Comment[];
  const rules = new Rules((offset) => lines.of(offset));

  const all = groups(parsed.program as unknown as AstNode, source).flatMap((group) => groupGaps(group, lines, comments, rules));
  const gaps = [...new Map(all.map((gap) => [`${gap.after}:${gap.before}`, gap])).values()];

  const text = source.split('\n');

  for (const gap of [...gaps].sort((a, b) => b.after - a.after)) {
    text.splice(gap.after + 1, gap.blanks, ...Array<string>(gap.wanted).fill(''));
  }

  const issues = gaps.map((gap) => ({ line: gap.before + 1, message: gap.message })).sort((a, b) => a.line - b.line);

  return { issues, fixed: text.join('\n') };
}

function groupGaps(group: Group, lines: Lines, comments: Comment[], rules: Rules): Gap[] {
  const { items, open, close } = group;
  if (items.length === 0) return [];

  const gaps: Gap[] = [];

  const add = (after: number, before: number, spacing: Spacing, reason: string) => {
    const blanks = before - after - 1;
    if (blanks < 0) return;

    const wanted = spacing === 'blank' ? 1 : spacing === 'none' ? 0 : Math.min(blanks, 1);
    if (blanks === wanted) return;

    const message = wanted > blanks ? `expected a blank line ${reason}` : wanted === 0 ? `unexpected blank line ${reason}` : 'more than one blank line';

    gaps.push({ after, before, blanks, wanted, message });
  };

  if (open !== undefined) add(lines.of(open), leadLine(items[0]!, open, lines, comments), 'none', 'at the start of a block');

  for (let index = 1; index < items.length; index++) {
    const prev = items[index - 1]!;
    const next = items[index]!;
    const { spacing, reason } = rules.decide(group, prev, next);

    add(lines.of(prev.end - 1), leadLine(next, prev.end, lines, comments), spacing, reason);
  }

  if (close !== undefined) add(tailLine(items.at(-1)!, close, lines, comments), lines.of(close), 'none', 'at the end of a block');

  return gaps;
}

/** Where a statement begins once the comments on the lines above it count as part of it. */
function leadLine(node: AstNode, from: number, lines: Lines, comments: Comment[]) {
  const fromLine = lines.of(from);
  const own = comments.find((comment) => comment.start >= from && comment.end <= node.start && lines.of(comment.start) > fromLine);

  return lines.of(own ? own.start : node.start);
}

/** Where the last statement of a block ends, with the comments after it before the closing brace. */
function tailLine(node: AstNode, close: number, lines: Lines, comments: Comment[]) {
  const after = comments.filter((comment) => comment.start >= node.end && comment.end <= close);

  return Math.max(lines.of(node.end - 1), ...after.map((comment) => lines.of(comment.end - 1)));
}
