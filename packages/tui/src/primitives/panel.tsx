import { Fragment, type ReactNode } from 'react';
import { Text } from 'ink';
import { useTheme } from '../runtime/theme.js';
import { Frame, FrameDivider } from './frame.js';

export type KeyHint = [key: string, action: string];

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
  header?: ReactNode;
  hints?: KeyHint[];
  grow?: boolean;
  children?: ReactNode;
}

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
