import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { Box, Text } from 'ink';
import { useTheme } from '../runtime/theme.js';
import { Inset } from '../runtime/width.js';
import { hoverColor, type Tone } from '../theme/themes.js';
import { useHovered } from './clickable.js';
import { Fill } from './fill.js';

const SIDES = {
  left: '|',
  right: '|',
  top: '',
  topLeft: '',
  topRight: '',
  bottom: '',
  bottomLeft: '',
  bottomRight: '',
};

/** Two borders plus a column of padding on each side. */
export const FRAME_INSET = 4;

export interface FrameProps {
  title?: ReactNode;
  tone?: Tone | 'plain';
  borderColor?: string;
  lead?: number;
  grow?: boolean;
  fit?: boolean;
  children?: ReactNode;
}

export function Frame({ title, tone = 'plain', borderColor, lead = 3, grow = false, fit = false, children }: FrameProps) {
  const theme = useTheme();
  const hovered = useHovered();

  const tint = tone === 'plain' ? undefined : theme.surface[tone];
  const background = hovered ? hoverColor(theme, tint) : tint;
  const color = borderColor ?? theme.border;

  const sections: { title?: ReactNode; body: ReactNode[]; grow: boolean }[] = [{ title, body: [], grow }];

  for (const child of Children.toArray(children)) {
    if (isValidElement(child) && child.type === FrameDivider) {
      const { title: sectionTitle, grow: sectionGrow = false } = (child as ReactElement<FrameDividerProps>).props;

      sections.push({ title: sectionTitle, body: [], grow: sectionGrow });
    } else {
      sections.at(-1)!.body.push(child);
    }
  }

  const fill = sections.some((section) => section.grow);

  return (
    <Box
      flexDirection="column"
      width={fit ? undefined : '100%'}
      maxWidth="100%"
      alignSelf={fit ? 'flex-start' : undefined}
      flexGrow={fill ? 1 : 0}
      backgroundColor={background}
    >
      {sections.map((section, index) => (
        <Box key={index} flexDirection="column" flexGrow={section.grow ? 1 : 0}>
          <Edge title={section.title} color={color} lead={lead} background={background} />
          {(section.body.length > 0 || section.grow) && (
            <Box
              flexDirection="column"
              flexGrow={section.grow ? 1 : 0}
              paddingX={1}
              borderStyle={SIDES}
              borderTop={false}
              borderBottom={false}
              borderColor={color}
              borderBackgroundColor={background}
            >
              <Inset by={FRAME_INSET}>{section.body}</Inset>
            </Box>
          )}
        </Box>
      ))}
      <Edge color={color} lead={lead} background={background} />
    </Box>
  );
}

export interface FrameDividerProps {
  title?: ReactNode;
  grow?: boolean;
}

/** Must be a direct child of `Frame`. */
export function FrameDivider(_props: FrameDividerProps) {
  return null;
}

interface EdgeProps {
  title?: ReactNode;
  color: string;
  lead: number;
  background?: string;
}

function Edge({ title, color, lead, background }: EdgeProps) {
  const hasTitle = title !== undefined && title !== null && title !== false;

  return (
    <Box>
      <Box flexShrink={0}>
        <Text color={color}>{hasTitle ? `+${'-'.repeat(lead)} ` : '+'}</Text>
      </Box>
      {hasTitle && (
        <Text wrap="truncate-end">
          {title}
          <Text> </Text>
        </Text>
      )}
      <Fill color={color} backgroundColor={background} />
      <Box flexShrink={0}>
        <Text color={color}>+</Text>
      </Box>
    </Box>
  );
}
