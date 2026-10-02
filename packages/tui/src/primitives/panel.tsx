import { Fragment, type ReactNode } from 'react';
import { Text } from 'ink';
import { useTheme } from '../runtime/context.js';
import { Frame, FrameDivider } from './frame.js';

export type KeyHint = [key: string, action: string];

/** `Enter select · Esc close` */
export function KeyHints({ hints }: { hints: KeyHint[] }) {
  const theme = useTheme();
  return (
    <Text>
      {hints.map(([key, action], index) => (
        <Fragment key={key}>
          {index > 0 && <Text color={theme.muted}> · </Text>}
          {key}
          <Text color={theme.muted}> {action}</Text>
        </Fragment>
      ))}
    </Text>
  );
}

export interface PanelProps {
  title: string;
  subtitle?: string;
  /** Shown above the body and separated from it, e.g. tabs, a search field or a question. */
  header?: ReactNode;
  hints?: KeyHint[];
  /** Fill the available height; full screen panels use this. */
  grow?: boolean;
  children?: ReactNode;
}

/**
 * The chrome every panel shares:
 *
 *     +- Title subtitle --------------+
 *     | header                        |
 *     +-------------------------------+
 *     | body                          |
 *     +-------------------------------+
 *     | Enter select · Esc close      |
 *     +-------------------------------+
 */
export function Panel({ title, subtitle, header, hints, grow = false, children }: PanelProps) {
  const theme = useTheme();
  const hasHeader = header !== undefined;

  return (
    <Frame
      lead={1}
      borderColor={theme.accent}
      grow={grow && !hasHeader}
      title={
        <Text>
          <Text color={theme.accent}>{title}</Text>
          {subtitle && <Text color={theme.muted}> {subtitle}</Text>}
        </Text>
      }
    >
      {header}
      {hasHeader && <FrameDivider grow={grow} />}
      {children}
      {hints && <FrameDivider />}
      {hints && <KeyHints hints={hints} />}
    </Frame>
  );
}
