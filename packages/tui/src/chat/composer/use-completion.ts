import { useEffect, useMemo, useState } from 'react';
import type { Key } from 'ink';
import { stepIndex } from '../../primitives/list-navigation.js';

export interface CompletionItem {
  key: string;
  label: string;
  positions?: number[];
  hint?: string;
  description?: string;
  tag?: string;
  group?: string;
  insert: string;
  submit?: boolean;
}

export interface Completion {
  from: number;
  to: number;
  items: CompletionItem[];
  submit?: boolean;
}

export type CompletionSource = (value: string, cursor: number) => Completion | undefined;

interface CompletionOptions {
  sources: CompletionSource[];
  value: string;
  cursor: number;
  onChange(value: string): void;
  onSubmit(value: string): void;
}

export function useCompletion({ sources, value, cursor, onChange, onSubmit }: CompletionOptions) {
  const [index, setIndex] = useState(0);
  const [dismissedAt, setDismissedAt] = useState<string>();

  const completion = useMemo(() => {
    for (const source of sources) {
      const result = source(value, cursor);
      if (result && result.items.length > 0) return result;
    }

    return undefined;
  }, [sources, value, cursor]);

  const open = completion !== undefined && dismissedAt !== value;
  const selected = completion ? Math.min(index, completion.items.length - 1) : 0;
  const submits = completion ? (completion.items[selected]?.submit ?? Boolean(completion.submit)) : false;

  useEffect(() => setIndex(0), [value]);

  const accept = (completion: Completion, submit: boolean) => {
    const item = completion.items[selected]!;
    const next = value.slice(0, completion.from) + item.insert + value.slice(completion.to);

    if (submit) onSubmit(next.trim());
    else onChange(next);
  };

  const onKey = (key: Key) => {
    if (!open || !completion) return false;

    const count = completion.items.length;

    if (key.upArrow) setIndex(stepIndex(selected, -1, count));
    else if (key.downArrow) setIndex(stepIndex(selected, 1, count));
    else if (key.tab) accept(completion, false);
    else if (key.return && !key.shift && !key.meta) accept(completion, submits);
    else if (key.escape) setDismissedAt(value);
    else return false;

    return true;
  };

  return { completion: open ? completion : undefined, selected, submits, onKey };
}
