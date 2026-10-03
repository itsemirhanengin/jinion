import { useState } from 'react';
import { useInput } from 'ink';

export function stepIndex(index: number, delta: number, count: number, wrap = true) {
  if (count === 0) return 0;
  if (wrap) return (((index + delta) % count) + count) % count;
  return Math.min(count - 1, Math.max(0, index + delta));
}

export interface ListNavigationOptions {
  isActive?: boolean;
  wrap?: boolean;
  pageSize?: number;
}

export function useListNavigation(count: number, { isActive = true, wrap = true, pageSize }: ListNavigationOptions = {}) {
  const [index, setIndex] = useState(0);
  const current = count === 0 ? 0 : Math.min(index, count - 1);

  useInput(
    (_, key) => {
      if (key.upArrow) setIndex(stepIndex(current, -1, count, wrap));
      else if (key.downArrow) setIndex(stepIndex(current, 1, count, wrap));
      else if (pageSize && key.pageUp) setIndex(stepIndex(current, -pageSize, count, false));
      else if (pageSize && key.pageDown) setIndex(stepIndex(current, pageSize, count, false));
    },
    { isActive: isActive && count > 0 },
  );

  return [current, setIndex] as const;
}
