import { Box, Frame, Text, useTheme } from '@jinion/tui';
import { useJinion } from '../context.js';

export function Banner() {
  const theme = useTheme();
  const { version, model, cwd, examples = [] } = useJinion().info;

  return (
    <Frame
      title={
        <Text>
          <Text bold color={theme.accent}>
            jinion
          </Text>{' '}
          <Text color={theme.muted}>v{version}</Text>
        </Text>
      }
    >
      <Box justifyContent="space-between">
        <Text>A coding agent for your terminal.</Text>
        <Text color={theme.muted}>jinion.co</Text>
      </Box>
      <Text> </Text>
      <Text>
        <Text color={theme.muted}>model </Text>
        <Text color={theme.status.model}>{model}</Text>
      </Text>
      <Text>
        <Text color={theme.muted}>cwd   </Text>
        <Text color={theme.status.directory}>{cwd}</Text>
      </Text>
      <Text> </Text>
      <Text color={theme.muted}>
        {examples.length > 0 && (
          <>
            Try{' '}
            {examples.map((example, index) => (
              <Text key={example}>
                {index > 0 && <Text color={theme.muted}> or </Text>}
                <Text color={theme.code}>{example}</Text>
              </Text>
            ))}
            .{' '}
          </>
        )}
        Type <Text color={theme.code}>/</Text> for commands.
      </Text>
    </Frame>
  );
}
