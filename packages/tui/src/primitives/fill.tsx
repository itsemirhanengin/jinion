import { Box } from 'ink';

export interface FillProps {
  char?: string;
  color?: string;
  backgroundColor?: string;
}

/**
 * Repeats a character across the remaining width of a row.
 *
 * Drawn as the top border of an empty box, so Yoga sizes it and it stays
 * correct inside nested layouts without measuring anything.
 */
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
