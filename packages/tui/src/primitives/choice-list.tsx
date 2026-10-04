import { useState, type ReactNode } from 'react';
import { Box, Text, useInput } from 'ink';
import { useTheme } from '../runtime/theme.js';
import { stepIndex } from './list-navigation.js';
import { OptionRow, optionIndent } from './option-row.js';
import { SelectList } from './select-list.js';

export type ChoiceMode = 'single' | 'multiple';

export interface ChoiceListOptions {
  keys: string[];
  mode: ChoiceMode;
  initialFocus?: string;
  initialChecked?: string[];
  isActive?: boolean;
  onSubmit(keys: string[]): void;
  onCancel(): void;
  /** Return `false` to handle it yourself. */
  onToggle?(key: string): boolean | void;
}

export interface ChoiceListState {
  mode: ChoiceMode;
  keys: string[];
  focus: string;
  focusIndex: number;
  setFocus(key: string): void;
  isChecked(key: string): boolean;
  checked: string[];
  setChecked(key: string, checked: boolean): void;
}

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

      if (key.upArrow) setFocus(keys[stepIndex(focusIndex, -1, keys.length, false)]!);
      else if (key.downArrow) setFocus(keys[stepIndex(focusIndex, 1, keys.length, false)]!);
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
  key: string;
  /** Choices of a group come one after another, under its name. */
  group?: string;
  label: ReactNode;
  description?: ReactNode;
  aside?: ReactNode;
  note?: string;
  editor?: ReactNode;
}

export interface ChoiceListProps {
  list: ChoiceListState;
  choices: Choice[];
  limit?: number;
  empty?: string;
}

export function ChoiceList({ list, choices, limit = 8, empty }: ChoiceListProps) {
  const theme = useTheme();

  return (
    <SelectList
      items={choices}
      selected={list.focusIndex}
      limit={limit}
      empty={empty}
      renderItem={(choice, state) => (
        <>
          {choice.group !== undefined && (state.first || choices[state.index - 1]?.group !== choice.group) && (
            <Box marginTop={state.first ? 0 : 1}>
              <Text color={theme.muted} bold>
                {choice.group}
              </Text>
            </Box>
          )}
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
        </>
      )}
    />
  );
}

export const choiceIndent = (list: ChoiceListState) => optionIndent(list.keys.length, list.mode === 'multiple');
