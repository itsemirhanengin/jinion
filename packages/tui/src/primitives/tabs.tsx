import { Fragment, useState } from 'react';
import { Text, useInput } from 'ink';
import { useTheme } from '../runtime/context.js';
import { stepIndex } from './select-list.js';

export interface TabsOptions {
  isActive?: boolean;
  initial?: number;
  /** Off for tabs whose content takes left/right itself, e.g. to move a cursor; tab and shift+tab still switch. */
  arrows?: boolean;
}

/** Left/right and tab/shift+tab switch between `count` tabs. */
export function useTabs(count: number, { isActive = true, initial = 0, arrows = true }: TabsOptions = {}) {
  const [index, setIndex] = useState(initial);
  const current = Math.min(index, Math.max(0, count - 1));

  useInput(
    (_, key) => {
      if ((arrows && key.rightArrow) || (key.tab && !key.shift)) setIndex(stepIndex(current, 1, count));
      else if ((arrows && key.leftArrow) || (key.tab && key.shift)) setIndex(stepIndex(current, -1, count));
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
