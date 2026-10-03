import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useInput } from 'ink';
import { plural } from '../utils/plural.js';
import { orderRange, rangeText, type Cell, type Point, type Range } from './cells.js';
import { useMouse } from './mouse.js';
import type { Screen } from './screen.js';
import { useTerminal } from './terminal.js';
import { useTheme } from './theme.js';
import { useShowToast } from './toast.js';

interface SelectionControl {
  active: boolean;
  copy(): boolean;
}

const SelectionContext = createContext<SelectionControl>({ active: false, copy: () => false });

export const useSelection = () => useContext(SelectionContext);

const MULTI_CLICK_MS = 500;

// As iTerm2 has it, so a path selects as one word.
const WORD = /^[\p{L}\p{N}\p{M}_/\-+\\~.]+$/u;
const URL = /\b[a-z][a-z\d+.-]*:\/\/[^\s<>"'`|]+/gi;

export function wordAt(row: Cell[], x: number): { from: number; to: number } | undefined {
  const index = row.findIndex((cell) => x >= cell.x && x < cell.x + cell.width);
  if (index === -1) return undefined;
  const span = (first: number, last: number) => ({ from: row[first]!.x, to: row[last]!.x + row[last]!.width - 1 });

  const starts: number[] = [];
  let text = '';
  for (const cell of row) {
    starts.push(text.length);
    text += cell.text;
  }
  for (const match of text.matchAll(URL)) {
    const url = match[0].replace(/[.,:;!?)\]}]+$/, '');
    const first = starts.indexOf(match.index);
    const last = starts.findLastIndex((start) => start < match.index + url.length);
    if (index >= first && index <= last) return span(first, last);
  }

  if (!WORD.test(row[index]!.text)) return span(index, index);
  let first = index;
  let last = index;
  while (first > 0 && WORD.test(row[first - 1]!.text)) first--;
  while (last < row.length - 1 && WORD.test(row[last + 1]!.text)) last++;
  return span(first, last);
}

function lineSpan(row: Cell[]) {
  const shown = row.filter((cell) => cell.text.trim());
  const first = shown[0];
  const last = shown.at(-1);
  return first && last ? { from: first.x, to: last.x + last.width - 1 } : undefined;
}

/** Jinion takes the mouse from the terminal, so it selects and copies text itself, as Claude Code's fullscreen mode does. */
export function SelectionLayer({ screen, children }: { screen?: Screen; children: ReactNode }) {
  const theme = useTheme();
  const terminal = useTerminal();
  const showToast = useShowToast();
  const [range, setRange] = useState<Range>();
  const latest = useRef(range);
  const drag = useRef<{ anchor: Point; moved: boolean }>(undefined);
  const clicks = useRef({ count: 0, x: -1, y: -1, at: 0 });

  const show = (next: Range | undefined, text?: string) => {
    latest.current = next;
    setRange(next);
    screen?.select(next && { range: next, background: theme.selectionBackground, text });
  };

  useEffect(
    () =>
      screen?.onDrop(() => {
        latest.current = undefined;
        setRange(undefined);
      }),
    [screen],
  );

  const copy = (selected: Range) => {
    const text = screen ? rangeText(screen.cells(), selected) : '';
    if (!text.trim()) {
      show(undefined);
      return false;
    }
    show(selected, text);
    void terminal.copy(text).then((ok) => showToast(ok ? `copied ${plural([...text].length, 'char')} to clipboard` : "couldn't copy to the clipboard"));
    return true;
  };

  useMouse((event) => {
    if (!screen) return;
    if (event.type === 'wheel') {
      if (latest.current) show(undefined);
      return;
    }
    if (event.button !== 0) return;
    const at = { x: event.x, y: event.y };

    if (event.type === 'press') {
      const now = Date.now();
      const last = clicks.current;
      const count = last.x === at.x && last.y === at.y && now - last.at < MULTI_CLICK_MS ? Math.min(3, last.count + 1) : 1;
      clicks.current = { count, ...at, at: now };
      if (count === 1) {
        drag.current = { anchor: at, moved: false };
        if (latest.current) show(undefined);
        return;
      }
      drag.current = undefined;
      const row = screen.cells()[at.y] ?? [];
      const span = count === 2 ? wordAt(row, at.x) : lineSpan(row);
      if (span) copy({ from: { x: span.from, y: at.y }, to: { x: span.to, y: at.y } });
      return;
    }

    const held = drag.current;
    if (!held) return;
    if (event.type === 'move') {
      if (!held.moved && at.x === held.anchor.x && at.y === held.anchor.y) return;
      held.moved = true;
      show(orderRange(held.anchor, at));
    } else if (event.type === 'release') {
      drag.current = undefined;
      if (held.moved && latest.current) copy(latest.current);
    }
  });

  useInput(
    (input, key) => {
      if (key.escape || (key.ctrl && input === 'c')) return;
      show(undefined);
    },
    { isActive: range !== undefined },
  );

  const control = useMemo<SelectionControl>(
    () => ({
      active: range !== undefined,
      copy: () => {
        const selected = latest.current;
        if (!selected || !copy(selected)) return false;
        show(undefined);
        return true;
      },
    }),
    // `copy` and `show` read the latest selection through the ref.
    [range],
  );

  return <SelectionContext.Provider value={control}>{children}</SelectionContext.Provider>;
}
