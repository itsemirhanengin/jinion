import { useEffect, useRef, useState } from 'react';
import { Box, measureElement, useInput, usePaste, type DOMElement, type Key } from 'ink';
import stringWidth from 'string-width';
import { useContentWidth } from '../../runtime/width.js';
import { layout, offsetAt, rowOf } from './layout.js';
import { Placeholder, RowText } from './row-text.js';
import { marksOf, spansOf } from './spans.js';
import { useHistory } from './use-history.js';

export interface PromptInputProps {
  value: string;
  onChange(value: string): void;
  onSubmit(value: string): void;
  placeholder?: string;
  history?: string[];
  isActive?: boolean;
  paddingX?: number;
  onKeyDown?(input: string, key: Key): boolean | void;
  onCursorChange?(cursor: number): void;
  maxRows?: number;
  onScroll?(hidden: HiddenRows): void;
  onPaste?(text: string): string;
  /** Spans the cursor steps over and deletes whole, e.g. paste placeholders. Needs the `g` flag. */
  atoms?: RegExp;
  /** Needs the `g` flag. */
  highlight?: RegExp;
}

export interface HiddenRows {
  above: number;
  below: number;
}

const WORD_LEFT = /\S+\s*$/;
const WORD_RIGHT = /^\s*\S+/;

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
  highlight,
}: PromptInputProps) {
  const contentWidth = useContentWidth();

  const box = useRef<DOMElement>(null);
  const [width, setWidth] = useState(Math.max(1, contentWidth - paddingX * 2));
  const [cursor, setCursor] = useState(value.length);
  const earlier = useHistory(history);
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

  const lineStart = value.lastIndexOf('\n', position - 1) + 1;
  const lineEnd = value.indexOf('\n', position) === -1 ? value.length : value.indexOf('\n', position);

  const spans = spansOf(value, atoms);
  const marks = marksOf(value, spans, highlight);
  const spanEnding = (at: number) => spans.find((span) => span.end === at);
  const spanStarting = (at: number) => spans.find((span) => span.start === at);
  const outside = (at: number, edge: 'start' | 'end') => spans.find((span) => span.start < at && at < span.end)?.[edge] ?? at;

  // One column stays free at the end of each row for the cursor.
  const rows = layout(value, Math.max(1, width - 1));
  const caretRow = rowOf(rows, position);

  if (caretRow < top.current) top.current = caretRow;
  if (caretRow >= top.current + maxRows) top.current = caretRow - maxRows + 1;
  top.current = Math.max(0, Math.min(top.current, rows.length - maxRows));

  const visible = rows.slice(top.current, top.current + maxRows);
  const above = top.current;
  const below = rows.length - above - visible.length;

  // Only layout knows the room the editor got, e.g. next to a label in a panel.
  useEffect(() => {
    if (!box.current) return;

    const measured = measureElement(box.current).width;

    if (measured > 0 && measured !== width) setWidth(measured);
  });

  useEffect(() => onCursorChange?.(position), [position, onCursorChange]);
  useEffect(() => latestOnScroll.current?.({ above, below }), [above, below]);

  const update = (next: string, nextCursor: number) => {
    emitted.current = next;
    setCursor(nextCursor);
    if (next !== value) onChange(next);
  };

  const insert = (text: string) => update(value.slice(0, position) + text + value.slice(position), position + text.length);

  const moveVertically = (direction: -1 | 1) => {
    const target = rows[caretRow + direction];

    if (!target) {
      const text = earlier.browse(direction, value);

      if (text !== undefined) update(text, text.length);

      return;
    }

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

        earlier.leave();

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
              marks={marks}
              caret={isActive && top.current + index === caretRow ? position : undefined}
              dim={!isActive}
            />
          ))
        )}
      </Box>
    </Box>
  );
}
