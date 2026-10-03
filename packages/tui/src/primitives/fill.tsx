import { Box } from 'ink';

export interface FillProps {
  char?: string;
  color?: string;
  backgroundColor?: string;
}

/** Drawn as an empty box's top border, so Yoga sizes it without measuring anything. */
export function Fill({ char = '-', color, backgroundColor }: FillProps) {
  return (
    <Box
      flexGrow={1}
      height={1}
      borderStyle={{
        top: char,
        topLeft: '',
        topRight: '',
        bottom: '',
        bottomLeft: '',
        bottomRight: '',
        left: '',
        right: '',
      }}
      borderBottom={false}
      borderLeft={false}
      borderRight={false}
      borderColor={color}
      borderBackgroundColor={backgroundColor}
    />
  );
}
