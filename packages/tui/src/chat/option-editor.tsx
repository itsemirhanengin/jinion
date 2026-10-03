import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useTheme } from '../runtime/theme.js';
import type { KeyHint } from '../primitives/panel.js';
import { PromptInput } from './prompt/prompt-input.js';

export const EDITOR_HINTS: KeyHint[] = [
  ['Enter', 'save'],
  ['Esc', 'back'],
];

export function useOptionEditor<T>(start: () => T | undefined) {
  const [editing, setEditing] = useState<T>();

  useInput(
    (input) => {
      if (input !== 'n') return;

      const value = start();

      if (value !== undefined) setEditing(value);
    },
    { isActive: editing === undefined },
  );

  useInput(
    (_, key) => {
      if (key.escape) setEditing(undefined);
    },
    { isActive: editing !== undefined },
  );

  return [editing, setEditing] as const;
}

export interface OptionEditorProps {
  indent: number;
  note?: boolean;
  value: string;
  onChange(value: string): void;
  onSubmit(value: string): void;
  placeholder: string;
}

export function OptionEditor({ indent, note = false, value, onChange, onSubmit, placeholder }: OptionEditorProps) {
  const theme = useTheme();

  return (
    <Box paddingLeft={indent}>
      {note && <Text color={theme.muted}>note: </Text>}
      <PromptInput value={value} onChange={onChange} onSubmit={onSubmit} placeholder={placeholder} paddingX={0} />
    </Box>
  );
}
