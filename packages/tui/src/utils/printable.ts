import { TEXT_ESCAPES } from './ansi.js';

const CONTROLS = /[\x00-\x08\x0b-\x1f\x7f-\x9f]/g;
const UNPRINTABLE = /[\x00-\x09\x0b-\x1f\x7f-\x9f]|\uFE0F/;
/** Asks for a two-column emoji: Ink counts two columns, but many terminals draw one. */
const EMOJI_PRESENTATION = /\uFE0F/g;

export const TAB_WIDTH = 4;

/**
 * Text as the terminal lays it out. Ink measures a tab as one column and `\r` or escapes as text, while the terminal
 * doesn't; once the two disagree, Ink redraws over the wrong cells. So tabs expand, a line rewritten with `\r` keeps
 * what it ended as, and escapes, control characters and the emoji selector go.
 */
export function printable(text: string, tabWidth = TAB_WIDTH) {
  if (!UNPRINTABLE.test(text)) return text;

  return text
    .replace(TEXT_ESCAPES, '')
    .replace(EMOJI_PRESENTATION, '')
    .split('\n')
    .map((line) => {
      const ended = line.replace(/\r+$/, '');

      return expandTabs(ended.slice(ended.lastIndexOf('\r') + 1), tabWidth).replace(CONTROLS, '');
    })
    .join('\n');
}

function expandTabs(line: string, width: number) {
  if (!line.includes('\t')) return line;

  let expanded = '';

  for (const char of line) expanded += char === '\t' ? ' '.repeat(width - (expanded.length % width)) : char;

  return expanded;
}
