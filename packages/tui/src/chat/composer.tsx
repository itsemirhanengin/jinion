import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Box, Text, type Key } from 'ink';
import { useTheme, useToast } from '../runtime/context.js';
import { Highlight } from '../primitives/highlight.js';
import { KeyHints } from '../primitives/panel.js';
import { Rule } from '../primitives/rule.js';
import { ListRow, SelectList, stepIndex } from '../primitives/select-list.js';
import { anyOf, MENTION } from './mentions.js';
import { PASTED_IMAGE } from './pasted-images.js';
import { PASTED_TEXT, type PastedTexts } from './pasted-texts.js';
import { PromptInput, type HiddenRows, type PromptInputProps } from './prompt-input.js';

export interface CompletionItem {
  key: string;
  label: string;
  /** Matched characters in `label`. */
  positions?: number[];
  /** Shown after the label, e.g. an argument hint. */
  hint?: string;
  description?: string;
  /** Right-aligned, e.g. where a command comes from. */
  tag?: string;
  /** Items next to each other with the same group show under one header, e.g. the plugin a skill comes from. */
  group?: string;
  /** Text that replaces the completed range. */
  insert: string;
  /** Overrides `Completion.submit` for this item. */
  submit?: boolean;
}

export interface Completion {
  /** The range of the prompt the completion replaces. */
  from: number;
  to: number;
  items: CompletionItem[];
  /** Enter accepts and submits, as for commands. Otherwise Enter only inserts. */
  submit?: boolean;
}

/** Offers completions for the prompt as it is typed; the first source with items wins. */
export type CompletionSource = (value: string, cursor: number) => Completion | undefined;

export interface ComposerProps
  extends Omit<PromptInputProps, 'onKeyDown' | 'onCursorChange' | 'onScroll' | 'onPaste' | 'atoms' | 'highlight'> {
  completions?: CompletionSource[];
  /** Completion rows shown at once. */
  limit?: number;
  /** Long pastes go in as placeholders; the same store expands them when the prompt is sent. */
  pastes?: PastedTexts;
  /** On the rule under the prompt, e.g. the agent's mode. */
  footer?: ReactNode;
  /** Highlighted like @-mentions, e.g. skills from `namedMention('$', names)`. */
  mentions?: (RegExp | undefined)[];
  /** Turns pasted text into something else first, e.g. a dropped image's path into its placeholder; `undefined` keeps it. */
  onPaste?(text: string): string | undefined;
  /** ctrl+v: what to insert at the cursor, e.g. a placeholder for the image on the clipboard. */
  onPasteKey?(): Promise<string | undefined>;
}

/** Long pastes and images, which the cursor steps over and backspace removes whole. */
const PLACEHOLDERS = anyOf([PASTED_TEXT, PASTED_IMAGE])!;

/**
 * The prompt between dashed rules, with a completion list under it while a
 * source has suggestions. Up/down move, Tab inserts, Enter accepts, Esc dismisses.
 * When the prompt scrolls, the rules say how many lines are out of view.
 */
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
  const patterns = mentions.map((pattern) => pattern?.source ?? '').join('\n');
  const highlight = useMemo(() => anyOf([MENTION, ...mentions]), [patterns]);
  const [hidden, setHidden] = useState<HiddenRows>({ above: 0, below: 0 });
  const [cursor, setCursor] = useState(value.length);
  const [index, setIndex] = useState(0);
  const [dismissedAt, setDismissedAt] = useState<string>();

  const completion = useMemo(() => {
    for (const source of completions) {
      const result = source(value, cursor);
      if (result && result.items.length > 0) return result;
    }
    return undefined;
  }, [completions, value, cursor]);

  useEffect(() => setIndex(0), [value]);

  const open = completion !== undefined && dismissedAt !== value;
  const selected = completion ? Math.min(index, completion.items.length - 1) : 0;

  const submits = (completion: Completion) => completion.items[selected]?.submit ?? Boolean(completion.submit);

  const accept = (completion: Completion, submit: boolean) => {
    const item = completion.items[selected]!;
    const next = value.slice(0, completion.from) + item.insert + value.slice(completion.to);
    if (submit) onSubmit(next.trim());
    else onChange(next);
  };

  const onKeyDown = (input: string, key: Key) => {
    if (key.ctrl && input === 'v' && onPasteKey) {
      void onPasteKey().then((text) => {
        if (text) onChange(value.slice(0, cursor) + text + value.slice(cursor));
      });
      return true;
    }
    if (!open || !completion) return false;
    const count = completion.items.length;
    if (key.upArrow) setIndex(stepIndex(selected, -1, count));
    else if (key.downArrow) setIndex(stepIndex(selected, 1, count));
    else if (key.tab) accept(completion, false);
    else if (key.return && !key.shift && !key.meta) accept(completion, submits(completion));
    else if (key.escape) setDismissedAt(value);
    else return false;
    return true;
  };

  return (
    <Box flexDirection="column">
      <Rule
        title={hidden.above > 0 ? <Text color={theme.muted}>↑ {lines(hidden.above)} above</Text> : undefined}
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
              {hidden.below > 0 && <Text color={theme.muted}>↓ {lines(hidden.below)} below</Text>}
              {hidden.below > 0 && footer !== undefined && <Text color={theme.muted}> · </Text>}
              {footer}
            </Text>
          ) : undefined
        }
      />
      {open && completion && (
        <CompletionList completion={completion} selected={selected} limit={limit} submits={submits(completion)} />
      )}
    </Box>
  );
}

const lines = (count: number) => (count === 1 ? '1 line' : `${count} lines`);

interface CompletionListProps {
  completion: Completion;
  selected: number;
  limit: number;
  submits: boolean;
}

/** Grouped items sit this far in, under their group's header. */
const GROUP_INDENT = 2;

function CompletionList({ completion, selected, limit, submits }: CompletionListProps) {
  const theme = useTheme();
  const { items } = completion;
  const indent = items.some((item) => item.group !== undefined) ? GROUP_INDENT : 0;
  const labelWidth = Math.min(
    32,
    Math.max(...items.map((item) => indent + item.label.length + (item.hint ? item.hint.length + 1 : 0))),
  );

  return (
    <Box flexDirection="column" paddingX={1}>
      <SelectList
        items={items}
        selected={selected}
        limit={limit}
        renderItem={(item, state) => (
          <>
            {/* The first item in view repeats its group's header, so a scrolled list still says where it is. */}
            {item.group !== undefined && (state.first || items[state.index - 1]?.group !== item.group) && (
              <Text color={theme.muted}>{`  ${item.group}`}</Text>
            )}
            <ListRow
              selected={state.selected}
              labelWidth={labelWidth}
              label={
                <Text>
                  {' '.repeat(indent)}
                  <Highlight text={item.label} positions={item.positions} />
                  {item.hint && <Text color={theme.muted}> {item.hint}</Text>}
                </Text>
              }
              description={item.description}
              aside={item.tag}
            />
          </>
        )}
      />
      <Box paddingLeft={2}>
        <KeyHints
          hints={[
            ['Tab', 'complete'],
            ['Enter', submits ? 'run' : 'insert'],
            ['Esc', 'dismiss'],
          ]}
        />
      </Box>
    </Box>
  );
}
