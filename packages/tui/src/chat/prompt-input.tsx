import { useEffect, useRef, useState } from 'react';
import { Box, Text, useInput, usePaste, type Key } from 'ink';
import { useTheme } from '../runtime/context.js';

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
}

const WORD_LEFT = /\S+\s*$/;
const WORD_RIGHT = /^\s*\S+/;

/**
 * Multiline prompt editor. Enter submits; shift+enter, alt+enter or a trailing
 * backslash inserts a newline. Supports the usual readline shortcuts.
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
}: PromptInputProps) {
  const [cursor, setCursor] = useState(value.length);
  const [historyIndex, setHistoryIndex] = useState<number>();
  const draft = useRef('');
  const emitted = useRef(value);

  // The parent replaced the value (cleared it, picked from history): put the cursor at the end.
  let position = Math.min(cursor, value.length);
  if (value !== emitted.current) {
    emitted.current = value;
    position = value.length;
    if (cursor !== position) setCursor(position);
  }

  useEffect(() => onCursorChange?.(position), [position, onCursorChange]);

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

  const moveVertically = (direction: -1 | 1) => {
    const column = position - lineStart;
    if (direction === -1) {
      if (lineStart === 0) return browseHistory(-1);
      const previousStart = value.lastIndexOf('\n', lineStart - 2) + 1;
      setCursor(Math.min(previousStart + column, lineStart - 1));
    } else {
      if (lineEnd === value.length) return browseHistory(1);
      const nextEnd = value.indexOf('\n', lineEnd + 1) === -1 ? value.length : value.indexOf('\n', lineEnd + 1);
      setCursor(Math.min(lineEnd + 1 + column, nextEnd));
    }
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

      const wordLeft = position - (WORD_LEFT.exec(value.slice(0, position))?.[0].length ?? position);
      const wordRight = position + (WORD_RIGHT.exec(value.slice(position))?.[0].length ?? 0);

      if (key.leftArrow) return setCursor(key.meta || key.ctrl ? wordLeft : Math.max(0, position - 1));
      if (key.rightArrow) return setCursor(key.meta || key.ctrl ? wordRight : Math.min(value.length, position + 1));
      if (key.upArrow) return moveVertically(-1);
      if (key.downArrow) return moveVertically(1);
      if (key.home || (key.ctrl && input === 'a')) return setCursor(lineStart);
      if (key.end || (key.ctrl && input === 'e')) return setCursor(lineEnd);
      if (key.meta && input === 'b') return setCursor(wordLeft);
      if (key.meta && input === 'f') return setCursor(wordRight);

      if (key.backspace) {
        const from = key.meta ? wordLeft : Math.max(0, position - 1);
        return update(value.slice(0, from) + value.slice(position), from);
      }
      if (key.delete) return update(value.slice(0, position) + value.slice(position + 1), position);
      if (key.ctrl && input === 'w') return update(value.slice(0, wordLeft) + value.slice(position), wordLeft);
      if (key.ctrl && input === 'u') return update(value.slice(0, lineStart) + value.slice(position), lineStart);
      if (key.ctrl && input === 'k') return update(value.slice(0, position) + value.slice(lineEnd), position);

      if (key.ctrl || key.meta || key.escape || key.tab || !input) return;
      insert(input);
    },
    { isActive },
  );

  usePaste((text) => insert(text.replace(/\r\n?/g, '\n')), { isActive });

  return (
    <Box paddingX={paddingX} flexShrink={1}>
      {value === '' ? (
        <Placeholder text={placeholder ?? ''} showCaret={isActive} />
      ) : isActive ? (
        <Text>
          {value.slice(0, position)}
          <Caret char={value[position]} />
          {value[position] === '\n' ? '\n' : ''}
          {value.slice(position + 1)}
        </Text>
      ) : (
        <Text dimColor>{value}</Text>
      )}
    </Box>
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
