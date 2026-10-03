import { useState, type ReactNode } from 'react';
import { Box, Text, type Key } from 'ink';
import { useTheme } from '../../runtime/theme.js';
import { useToast } from '../../runtime/toast.js';
import { Rule } from '../../primitives/rule.js';
import { plural } from '../../utils/plural.js';
import { PLACEHOLDERS, useMentions } from '../highlights.js';
import type { PastedTexts } from '../pasted-texts.js';
import { PromptInput, type HiddenRows, type PromptInputProps } from '../prompt/prompt-input.js';
import { CompletionList } from './completion-list.js';
import { useCompletion, type CompletionSource } from './use-completion.js';

export interface ComposerProps
  extends Omit<PromptInputProps, 'onKeyDown' | 'onCursorChange' | 'onScroll' | 'onPaste' | 'atoms' | 'highlight'> {
  completions?: CompletionSource[];
  limit?: number;
  pastes?: PastedTexts;
  footer?: ReactNode;
  mentions?: (RegExp | undefined)[];
  onPaste?(text: string): string | undefined;
  onPasteKey?(): Promise<string | undefined>;
}

export function Composer({
  completions = [],
  limit = 8,
  pastes,
  footer,
  mentions = [],
  onPaste,
  onPasteKey,
  ...input
}: ComposerProps) {
  const theme = useTheme();
  const toast = useToast();
  const { value, onChange, onSubmit } = input;
  const highlight = useMentions(mentions);
  const [hidden, setHidden] = useState<HiddenRows>({ above: 0, below: 0 });
  const [cursor, setCursor] = useState(value.length);
  const { completion, selected, submits, onKey } = useCompletion({ sources: completions, value, cursor, onChange, onSubmit });

  const onKeyDown = (input: string, key: Key) => {
    if (key.ctrl && input === 'v' && onPasteKey) {
      void onPasteKey().then((text) => {
        if (text) onChange(value.slice(0, cursor) + text + value.slice(cursor));
      });
      return true;
    }
    return onKey(key);
  };

  return (
    <Box flexDirection="column">
      <Rule
        title={hidden.above > 0 ? <Text color={theme.muted}>↑ {plural(hidden.above, 'line')} above</Text> : undefined}
        aside={toast.text && <Text color={theme.success}>{toast.text}</Text>}
      />
      <PromptInput
        {...input}
        onKeyDown={onKeyDown}
        onCursorChange={setCursor}
        onScroll={setHidden}
        onPaste={(text) => onPaste?.(text) ?? pastes?.add(text) ?? text}
        atoms={PLACEHOLDERS}
        highlight={highlight}
      />
      <Rule
        title={
          hidden.below > 0 || footer !== undefined ? (
            <Text>
              {hidden.below > 0 && <Text color={theme.muted}>↓ {plural(hidden.below, 'line')} below</Text>}
              {hidden.below > 0 && footer !== undefined && <Text color={theme.muted}> · </Text>}
              {footer}
            </Text>
          ) : undefined
        }
      />
      {completion && <CompletionList completion={completion} selected={selected} limit={limit} submits={submits} />}
    </Box>
  );
}
