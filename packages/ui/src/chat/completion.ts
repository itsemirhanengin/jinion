import { useEffect, useMemo, useState } from 'react';

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

/** What replaces `from` to `to` of the text; `submit` sends the message once an item is picked with Enter. */
export interface Completion {
  from: number;
  to: number;
  items: CompletionItem[];
  submit?: boolean;
}

export type CompletionSource = (value: string, cursor: number) => Completion | undefined;

/** The first source with something to offer at the cursor, until Escape dismisses it for the text as it is. */
export function useCompletion(sources: CompletionSource[], value: string, cursor: number) {
  const [index, setIndex] = useState(0);
  const [dismissedAt, setDismissedAt] = useState<string>();

  const completion = useMemo(() => {
    for (const source of sources) {
      const result = source(value, cursor);
      if (result && result.items.length > 0) return result;
    }

    return undefined;
  }, [sources, value, cursor]);

  useEffect(() => setIndex(0), [value]);

  const open = completion !== undefined && dismissedAt !== value;
  const selected = completion ? Math.min(index, completion.items.length - 1) : 0;

  return { completion: open ? completion : undefined, selected, select: setIndex, dismiss: () => setDismissedAt(value) };
}
