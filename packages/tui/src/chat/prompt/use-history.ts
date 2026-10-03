import { useRef, useState } from 'react';

export function useHistory(history: string[]) {
  const [index, setIndex] = useState<number>();
  const draft = useRef('');

  const browse = (direction: -1 | 1, value: string) => {
    if (history.length === 0) return undefined;

    const current = index ?? history.length;
    const next = Math.min(history.length, Math.max(0, current + direction));
    if (next === current) return undefined;

    if (index === undefined) draft.current = value;
    setIndex(next === history.length ? undefined : next);

    return next === history.length ? draft.current : history[next]!;
  };

  const leave = () => setIndex(undefined);

  return { browse, leave };
}
