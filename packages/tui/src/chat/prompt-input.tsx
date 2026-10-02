import { useEffect, useRef, useState } from 'react';
import { Box, measureElement, Text, useInput, usePaste, type DOMElement, type Key } from 'ink';
import stringWidth from 'string-width';
import { useContentWidth, useTheme } from '../runtime/context.js';

export interface PromptInputProps {
  value: string;
  onChange(value: string): void;
  onSubmit(value: string): void;
  placeholder?: string;
  /** Previous submissions, oldest first, browsed with up/down. */
  history?: string[];
  isActive?: boolean;
  paddingX?: number;
  /** Sees every key first; return `true` to consume it, e.g. while a completion list is open. */
  onKeyDown?(input: string, key: Key): boolean | void;
  onCursorChange?(cursor: number): void;
  /** Rows the editor grows to before it scrolls inside, keeping the cursor in view. */
  maxRows?: number;
  /** Rows out of view above and below, while the text is taller than `maxRows`. */
  onScroll?(hidden: HiddenRows): void;
  /** What to insert for pasted text, e.g. a placeholder for a long paste. */
  onPaste?(text: string): string;
  /**
   * Spans that act as one character, such as paste placeholders: the cursor steps over them, backspace and delete
   * remove them whole, and they are drawn highlighted. Needs the `g` flag.
   */
  atoms?: RegExp;
}

export interface HiddenRows {
  above: number;
  below: number;
}

interface Row {
  start: number;
  end: number;
}

interface Span {
  start: number;
  end: number;
}

const WORD_LEFT = /\S+\s*$/;
const WORD_RIGHT = /^\s*\S+/;

/**
 * Multiline prompt editor. Enter submits; shift+enter, alt+enter or a trailing backslash inserts a newline. Supports
 * the usual readline shortcuts. Long lines wrap, and past `maxRows` the editor scrolls instead of growing.
 */
export function PromptInput({
  value,
  onChange,
  onSubmit,
  placeholder,
  history = [],
  isActive = true,
  paddingX = 1,
  onKeyDown,
  onCursorChange,
  maxRows = 20,
  onScroll,
  onPaste,
  atoms,
}: PromptInputProps) {
  const contentWidth = useContentWidth();
  const box = useRef<DOMElement>(null);
  const [width, setWidth] = useState(Math.max(1, contentWidth - paddingX * 2));
  const [cursor, setCursor] = useState(value.length);
  const [historyIndex, setHistoryIndex] = useState<number>();
  const draft = useRef('');
  const emitted = useRef(value);
  const top = useRef(0);
  const latestOnScroll = useRef(onScroll);
  latestOnScroll.current = onScroll;

  // The parent replaced the value (cleared it, picked from history): put the cursor at the end.
  let position = Math.min(cursor, value.length);
  if (value !== emitted.current) {
    emitted.current = value;
    position = value.length;
    if (cursor !== position) setCursor(position);
  }

  // Only layout knows the room the editor got, e.g. next to a label in a panel.
  useEffect(() => {
    if (!box.current) return;
    const measured = measureElement(box.current).width;
    if (measured > 0 && measured !== width) setWidth(measured);
  });

  useEffect(() => onCursorChange?.(position), [position, onCursorChange]);

  const spans: Span[] = atoms
    ? [...value.matchAll(atoms)].map((match) => ({ start: match.index, end: match.index + match[0].length }))
    : [];
  const spanEnding = (at: number) => spans.find((span) => span.end === at);
  const spanStarting = (at: number) => spans.find((span) => span.start === at);
  /** A position inside a span moves to the span's `edge`. */
  const outside = (at: number, edge: 'start' | 'end') => spans.find((span) => span.start < at && at < span.end)?.[edge] ?? at;

  // One column stays free at the end of each row for the cursor.
  const rows = layout(value, Math.max(1, width - 1));
  const caretRow = rowOf(rows, position);
  // Scrolls just enough to keep the cursor in view.
  if (caretRow < top.current) top.current = caretRow;
  if (caretRow >= top.current + maxRows) top.current = caretRow - maxRows + 1;
  top.current = Math.max(0, Math.min(top.current, rows.length - maxRows));
  const visible = rows.slice(top.current, top.current + maxRows);
  const above = top.current;
  const below = rows.length - above - visible.length;

  useEffect(() => latestOnScroll.current?.({ above, below }), [above, below]);

  const update = (next: string, nextCursor: number) => {
    emitted.current = next;
    setCursor(nextCursor);
    if (next !== value) onChange(next);
  };

  const insert = (text: string) => update(value.slice(0, position) + text + value.slice(position), position + text.length);
  const lineStart = value.lastIndexOf('\n', position - 1) + 1;
  const lineEnd = value.indexOf('\n', position) === -1 ? value.length : value.indexOf('\n', position);

  const browseHistory = (direction: -1 | 1) => {
    if (history.length === 0) return;
    const current = historyIndex ?? history.length;
    const next = Math.min(history.length, Math.max(0, current + direction));
    if (next === current) return;
    if (historyIndex === undefined) draft.current = value;
    setHistoryIndex(next === history.length ? undefined : next);
    const text = next === history.length ? draft.current : history[next]!;
    update(text, text.length);
  };

  /** Up and down move by rows as they are drawn, keeping the column; past the first or last row they browse history. */
  const moveVertically = (direction: -1 | 1) => {
    const target = rows[caretRow + direction];
    if (!target) return browseHistory(direction);
    const row = rows[caretRow]!;
    setCursor(outside(offsetAt(value, target, stringWidth(value.slice(row.start, position))), 'end'));
  };

  useInput(
    (input, key) => {
      if (onKeyDown?.(input, key)) return;
      if (key.return) {
        if (key.shift || key.meta) return insert('\n');
        if (value[position - 1] === '\\') {
          return update(`${value.slice(0, position - 1)}\n${value.slice(position)}`, position);
        }
        setHistoryIndex(undefined);
        return onSubmit(value);
      }

      const wordLeft = outside(position - (WORD_LEFT.exec(value.slice(0, position))?.[0].length ?? position), 'start');
      const wordRight = outside(position + (WORD_RIGHT.exec(value.slice(position))?.[0].length ?? 0), 'end');
      const left = spanEnding(position)?.start ?? Math.max(0, position - 1);
      const right = spanStarting(position)?.end ?? Math.min(value.length, position + 1);

      if (key.leftArrow) return setCursor(key.meta || key.ctrl ? wordLeft : left);
      if (key.rightArrow) return setCursor(key.meta || key.ctrl ? wordRight : right);
      if (key.upArrow) return moveVertically(-1);
      if (key.downArrow) return moveVertically(1);
      if (key.home || (key.ctrl && input === 'a')) return setCursor(lineStart);
      if (key.end || (key.ctrl && input === 'e')) return setCursor(lineEnd);
      if (key.meta && input === 'b') return setCursor(wordLeft);
      if (key.meta && input === 'f') return setCursor(wordRight);

      if (key.backspace) {
        const from = key.meta ? wordLeft : left;
        return update(value.slice(0, from) + value.slice(position), from);
      }
      if (key.delete) return update(value.slice(0, position) + value.slice(right), position);
      if (key.ctrl && input === 'w') return update(value.slice(0, wordLeft) + value.slice(position), wordLeft);
      if (key.ctrl && input === 'u') return update(value.slice(0, lineStart) + value.slice(position), lineStart);
      if (key.ctrl && input === 'k') return update(value.slice(0, position) + value.slice(lineEnd), position);

      if (key.ctrl || key.meta || key.escape || key.tab || !input) return;
      insert(input);
    },
    { isActive },
  );

  usePaste(
    (text) => {
      const clean = text.replace(/\r\n?/g, '\n');
      insert(onPaste ? onPaste(clean) : clean);
    },
    { isActive },
  );

  return (
    <Box paddingX={paddingX} flexGrow={1} flexShrink={1}>
      <Box ref={box} flexDirection="column" flexGrow={1}>
        {value === '' ? (
          <Placeholder text={placeholder ?? ''} showCaret={isActive} />
        ) : (
          visible.map((row, index) => (
            <RowText
              key={row.start}
              value={value}
              row={row}
              spans={spans}
              caret={isActive && top.current + index === caretRow ? position : undefined}
              dim={!isActive}
            />
          ))
        )}
      </Box>
    </Box>
  );
}

/** Splits `value` into rows: at newlines, and where a line runs past `width` columns. */
function layout(value: string, width: number): Row[] {
  const rows: Row[] = [];
  let start = 0;
  let column = 0;
  for (let index = 0; index < value.length; ) {
    const char = String.fromCodePoint(value.codePointAt(index)!);
    if (char === '\n') {
      rows.push({ start, end: index });
      start = index + 1;
      column = 0;
      index += 1;
      continue;
    }
    const charWidth = stringWidth(char);
    if (column + charWidth > width && index > start) {
      rows.push({ start, end: index });
      start = index;
      column = 0;
    }
    column += charWidth;
    index += char.length;
  }
  rows.push({ start, end: value.length });
  return rows;
}

/** The row the cursor is drawn on. At a wrap, it goes to the start of the next row. */
function rowOf(rows: Row[], position: number) {
  const index = rows.findIndex(
    (row, at) => position < row.end || (position === row.end && rows[at + 1]?.start !== row.end),
  );
  return index === -1 ? rows.length - 1 : index;
}

/** The offset in `row` at `column`, or the row's end when it is shorter. */
function offsetAt(value: string, row: Row, column: number) {
  let width = 0;
  for (let index = row.start; index < row.end; ) {
    const char = String.fromCodePoint(value.codePointAt(index)!);
    const charWidth = stringWidth(char);
    if (width + charWidth > column) return index;
    width += charWidth;
    index += char.length;
  }
  return row.end;
}

interface RowTextProps {
  value: string;
  row: Row;
  spans: Span[];
  /** Where the cursor is, when it is on this row. */
  caret?: number;
  dim: boolean;
}

function RowText({ value, row, spans, caret, dim }: RowTextProps) {
  const theme = useTheme();
  const cuts = new Set([row.start, row.end]);
  for (const span of spans) {
    if (span.start > row.start && span.start < row.end) cuts.add(span.start);
    if (span.end > row.start && span.end < row.end) cuts.add(span.end);
  }
  if (caret !== undefined && caret < row.end) {
    cuts.add(caret);
    cuts.add(caret + String.fromCodePoint(value.codePointAt(caret)!).length);
  }
  const points = [...cuts].filter((point) => point <= row.end).sort((a, b) => a - b);

  return (
    <Text wrap="truncate" dimColor={dim}>
      {points.slice(0, -1).map((start, index) => {
        const end = points[index + 1]!;
        const text = value.slice(start, end);
        if (start === caret) return <Caret key={start} char={text} />;
        const atom = spans.some((span) => span.start <= start && end <= span.end);
        return atom ? (
          <Text key={start} color={theme.accent}>
            {text}
          </Text>
        ) : (
          text
        );
      })}
      {caret === row.end && <Caret />}
      {/* An empty line still takes its row. */}
      {row.start === row.end && caret === undefined && ' '}
    </Text>
  );
}

function Caret({ char }: { char?: string }) {
  const theme = useTheme();
  return (
    <Text inverse color={theme.accent}>
      {char === undefined || char === '\n' ? ' ' : char}
    </Text>
  );
}

function Placeholder({ text, showCaret }: { text: string; showCaret: boolean }) {
  const theme = useTheme();
  if (!showCaret) return <Text color={theme.muted}>{text || ' '}</Text>;
  return (
    <Text>
      <Caret char={text[0]} />
      <Text color={theme.muted}>{text.slice(1)}</Text>
    </Text>
  );
}
