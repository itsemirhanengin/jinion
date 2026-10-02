import { useState, type ReactNode } from 'react';
import { useInput } from 'ink';
import { OptionRow, optionIndent } from './option-row.js';
import { SelectList } from './select-list.js';

/** `single` picks the focused option with Enter; `multiple` checks any number with Space, then Enter submits. */
export type ChoiceMode = 'single' | 'multiple';

export interface ChoiceListOptions {
  /** Stable keys in list order, so focus and checks stay with an option when the list changes. */
  keys: string[];
  mode: ChoiceMode;
  /** The first key when left out. It may arrive later, e.g. with options that load. */
  initialFocus?: string;
  initialChecked?: string[];
  /** Off while something else in the panel takes the keys, e.g. an editor. */
  isActive?: boolean;
  /** Enter: the focused key for `single`, the checked keys in list order for `multiple`. */
  onSubmit(keys: string[]): void;
  onCancel(): void;
  /** Space in `multiple`. Return `false` to handle it yourself, e.g. to ask for text first. */
  onToggle?(key: string): boolean | void;
}

export interface ChoiceListState {
  mode: ChoiceMode;
  keys: string[];
  focus: string;
  focusIndex: number;
  setFocus(key: string): void;
  isChecked(key: string): boolean;
  /** In list order. */
  checked: string[];
  setChecked(key: string, checked: boolean): void;
}

/**
 * The keys every choice list shares: up/down move, 1-9 jump, space checks (`multiple`), enter picks or submits,
 * esc cancels. Shift with up/down is left to the panel, e.g. for reordering.
 */
export function useChoiceList({
  keys,
  mode,
  initialFocus,
  initialChecked = [],
  isActive = true,
  onSubmit,
  onCancel,
  onToggle,
}: ChoiceListOptions): ChoiceListState {
  const [focusKey, setFocus] = useState(initialFocus ?? keys[0] ?? '');
  const [checkedKeys, setCheckedKeys] = useState(() => new Set(initialChecked));
  const focusIndex = Math.max(0, keys.indexOf(focusKey));
  const focus = keys[focusIndex] ?? '';

  const setChecked = (key: string, value: boolean) =>
    setCheckedKeys((current) => {
      const next = new Set(current);
      if (value) next.add(key);
      else next.delete(key);
      return next;
    });

  useInput(
    (input, key) => {
      if (key.escape) return onCancel();
      if (keys.length === 0 || ((key.upArrow || key.downArrow) && key.shift)) return;
      if (key.upArrow) setFocus(keys[Math.max(0, focusIndex - 1)]!);
      else if (key.downArrow) setFocus(keys[Math.min(keys.length - 1, focusIndex + 1)]!);
      else if (/^[1-9]$/.test(input) && Number(input) <= keys.length) setFocus(keys[Number(input) - 1]!);
      else if (input === ' ' && mode === 'multiple') {
        if (onToggle?.(focus) !== false) setChecked(focus, !checkedKeys.has(focus));
      } else if (key.return) onSubmit(mode === 'single' ? [focus] : keys.filter((candidate) => checkedKeys.has(candidate)));
    },
    { isActive },
  );

  return {
    mode,
    keys,
    focus,
    focusIndex,
    setFocus,
    isChecked: (key) => checkedKeys.has(key),
    checked: keys.filter((key) => checkedKeys.has(key)),
    setChecked,
  };
}

export interface Choice {
  /** One of the list's `keys`, in the same order. */
  key: string;
  label: ReactNode;
  description?: ReactNode;
  aside?: ReactNode;
  note?: string;
  /** Shown under the option while it is focused, in place of its note, e.g. an editor. */
  editor?: ReactNode;
}

export interface ChoiceListProps {
  list: ChoiceListState;
  choices: Choice[];
  /** Options shown at once; the window follows the focus. */
  limit?: number;
  empty?: string;
}

/** Numbered options, with `[x]` boxes in `multiple` mode. */
export function ChoiceList({ list, choices, limit = 8, empty }: ChoiceListProps) {
  return (
    <SelectList
      items={choices}
      selected={list.focusIndex}
      limit={limit}
      empty={empty}
      renderItem={(choice, state) => (
        <OptionRow
          number={state.index + 1}
          count={choices.length}
          label={choice.label}
          description={choice.description}
          focused={state.selected}
          checked={list.mode === 'multiple' ? list.isChecked(choice.key) : undefined}
          aside={choice.aside}
          note={choice.note}
        >
          {state.selected ? choice.editor : undefined}
        </OptionRow>
      )}
    />
  );
}

/** Where an editor under an option starts, to line up with its label. */
export const choiceIndent = (list: ChoiceListState) => optionIndent(list.keys.length, list.mode === 'multiple');
