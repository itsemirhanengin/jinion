import { Fragment, useState } from 'react';
import { Text, useInput } from 'ink';
import { useTheme } from '../runtime/theme.js';
import { stepIndex } from './list-navigation.js';

export interface TabsOptions {
  isActive?: boolean;
  initial?: number;
  arrows?: boolean;
}

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
