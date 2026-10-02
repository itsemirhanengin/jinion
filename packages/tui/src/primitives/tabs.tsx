import { Fragment, useState } from 'react';
import { Text, useInput } from 'ink';
import { useTheme } from '../runtime/context.js';
import { stepIndex } from './select-list.js';

/** Left/right and tab/shift+tab switch between `count` tabs. */
export function useTabs(count: number, { isActive = true, initial = 0 }: { isActive?: boolean; initial?: number } = {}) {
  const [index, setIndex] = useState(initial);
  const current = Math.min(index, Math.max(0, count - 1));

  useInput(
    (_, key) => {
      if (key.rightArrow || (key.tab && !key.shift)) setIndex(stepIndex(current, 1, count));
      else if (key.leftArrow || (key.tab && key.shift)) setIndex(stepIndex(current, -1, count));
    },
    { isActive: isActive && count > 1 },
  );

  return [current, setIndex] as const;
}

/** ` General `  Commands   Skills — the active tab is drawn as a filled chip. */
export function Tabs({ tabs, active }: { tabs: string[]; active: number }) {
  const theme = useTheme();
  return (
    <Text>
      {tabs.map((tab, index) => (
        <Fragment key={tab}>
          {index > 0 && ' '}
          {index === active ? (
            <Text inverse bold color={theme.accent}>
              {` ${tab} `}
            </Text>
          ) : (
            <Text color={theme.muted}>{` ${tab} `}</Text>
          )}
        </Fragment>
      ))}
    </Text>
  );
}
