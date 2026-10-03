/** Escape sequences that color text or move the cursor: CSI (`\x1b[31m`), OSC (`\x1b]8;;url\x07`) and the short ones. */
const ESCAPES = /\x1b(?:\[[0-?]*[ -/]*[@-~]|\][^\x07\x1b]*(?:\x07|\x1b\\)?|[@-Z\\-_])/g;
/** Characters that move the cursor rather than take a column, `\n` aside. */
const CONTROLS = /[\x00-\x08\x0b-\x1f\x7f-\x9f]/g;
const UNPRINTABLE = /[\x00-\x09\x0b-\x1f\x7f-\x9f]|\uFE0F/;
/**
 * The selector that asks for a symbol such as ⚠ to be drawn as a two-column emoji. Ink counts the two columns, but
 * many terminals draw one, so the symbol goes as the one-column text it is everywhere.
 */
const EMOJI_PRESENTATION = /\uFE0F/g;

export const TAB_WIDTH = 4;

/**
 * Text as the terminal will lay it out, for anything that comes from outside: command output, file contents, what a
 * model wrote. Ink measures a tab as one column and a carriage return or an escape sequence as text, while the terminal
 * jumps to the next tab stop, goes back to the line's start or colors what follows; once the two disagree, Ink redraws
 * over the wrong cells and the screen falls apart. So tabs become spaces up to the next stop, a line rewritten with `\r`
 * keeps what it ended as (a progress bar's last state, a CRLF line without its `\r`), escape sequences and other
 * control characters go, and so does the selector some terminals draw a symbol a column narrower for.
 */
export function printable(text: string, tabWidth = TAB_WIDTH) {
  if (!UNPRINTABLE.test(text)) return text;
  return text
    .replace(ESCAPES, '')
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
