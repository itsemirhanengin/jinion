import { Box, Panel, PromptInput, Text, useTheme } from '@jinion/tui';
import type { Signing } from './use-sign-in.js';

export function SignInView({ signing, onType, onSend }: { signing: Signing; onType(code: string): void; onSend(code: string): void }) {
  const theme = useTheme();
  const { prompt } = signing;
  return (
    <Panel title="Account" subtitle={signing.name} hints={prompt && !signing.sent ? [['Enter', 'send'], ['Esc', 'cancel']] : [['Esc', 'cancel']]}>
      <Text>
        Signing in to <Text bold>{signing.name}</Text>. Finish it in your browser.
      </Text>
      {signing.link && (
        <Text>
          <Text color={theme.muted}>If the browser didn't open: </Text>
          <Text color={theme.code}>{signing.link}</Text>
        </Text>
      )}
      {prompt && (
        <Box flexDirection="column" marginTop={1}>
          {prompt.problem && <Text color={theme.error}>{prompt.problem}</Text>}
          {signing.sent ? (
            <Text color={theme.muted}>Checking the code…</Text>
          ) : (
            <Box>
              <Text color={theme.muted}>{prompt.text}: </Text>
              <PromptInput value={signing.code} onChange={onType} onSubmit={onSend} placeholder="code" paddingX={0} />
            </Box>
          )}
        </Box>
      )}
    </Panel>
  );
}
