import { useState } from 'react';
import { useInput } from 'ink';
import { addDays, dayKey } from '../utils/dates.js';

export function useDayCursor(end: Date, { earliest, isActive = true }: { earliest?: string; isActive?: boolean } = {}) {
  const last = dayKey(end);
  const [day, setDay] = useState(last);
  useInput(
    (_, key) => {
      const step = key.leftArrow ? -7 : key.rightArrow ? 7 : key.upArrow ? -1 : key.downArrow ? 1 : 0;
      if (!step) return;
      setDay((current) => {
        const next = addDays(current, step);
        if (next > last) return last;
        if (earliest && next < earliest) return earliest;
        return next;
      });
    },
    { isActive },
  );
  return [day, setDay] as const;
}
