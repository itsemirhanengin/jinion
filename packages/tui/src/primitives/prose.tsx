import type { ReactNode } from 'react';
import { Text, Transform, type TextProps } from 'ink';

const LEADING_SPACE = /^((?:\x1b\[[\d;]*m)*) /;

const dropBreakSpace = (line: string, index: number) => (index === 0 ? line : line.replace(LEADING_SPACE, '$1'));

/**
 * Wrapping text for sentences. Ink wraps without trimming, so a line that
 * fills the width exactly pushes the following space onto the next line;
 * this removes it.
 */
export function Prose({ children, ...props }: TextProps & { children?: ReactNode }) {
  return (
    <Transform transform={dropBreakSpace}>
      <Text {...props}>{children}</Text>
    </Transform>
  );
}
