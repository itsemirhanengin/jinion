import { useEffect, useState } from 'react';
import { Box, Panel, Text, useInput, usePanel, useTheme, Waffle, type Theme } from '@jinion/tui';
import type { ContextUsage } from '../agent/types.js';
import { useJinion } from '../context.js';
import { compact } from '../usage/format.js';

/** Claude Code's categories in the colors they keep here; any other takes the next of the rest. */
function colors(theme: Theme) {
  const known: Record<string, string> = {
    'System prompt': theme.accent,
    'System tools': theme.code,
    'MCP server instructions': theme.syntax.variable,
    'MCP tools': theme.syntax.variable,
    'Custom agents': theme.status.cost,
    'Memory files': theme.success,
    Skills: theme.heading,
    Messages: theme.syntax.string,
    'Free space': theme.heat[0],
    'Autocompact buffer': theme.border,
  };
  const rest = [theme.warning, theme.link, theme.diff.added, theme.error];
  let next = 0;
  return (name: string) => known[name] ?? rest[next++ % rest.length]!;
}

const percent = (part: number, whole: number) => {
  const share = whole > 0 ? (part / whole) * 100 : 0;
  return share > 0 && share < 1 ? `${share.toFixed(1)}%` : `${Math.round(share)}%`;
};

/** `/context`: what fills the context window, a square per percent, and where the agent compacts on its own. */
export function ContextPanel() {
  const app = useJinion();
  const theme = useTheme();
  const { close } = usePanel();
  const [usage, setUsage] = useState<ContextUsage>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    let open = true;
    app.usage.context?.().then(
      (found) => open && setUsage(found),
      (failure: unknown) => open && setError(failure instanceof Error ? failure.message : String(failure)),
    );
    return () => {
      open = false;
    };
  }, []);
  useInput((_, key) => {
    if (key.escape || key.return) close();
  });

  const colorOf = colors(theme);
  const shown = usage?.categories.filter((category) => category.kind !== 'deferred' && category.tokens > 0) ?? [];
  const deferred = usage?.categories.filter((category) => category.kind === 'deferred' && category.tokens > 0) ?? [];
  return (
    <Panel
      title="Context"
      subtitle={usage ? `${app.model.name} · ${compact(usage.used)} of ${compact(usage.window)} tokens · ${percent(usage.used, usage.window)}` : undefined}
      hints={[['Esc', 'close']]}
    >
      {!app.usage.context ? (
        <Text color={theme.muted}>{app.model.agent} doesn't say what fills its context.</Text>
      ) : error ? (
        <Text color={theme.error}>Couldn't ask {app.model.agent} about its context: {error}</Text>
      ) : !usage ? (
        <Text color={theme.muted}>Asking {app.model.agent} what fills its context…</Text>
      ) : (
        <Box flexDirection="column">
          <Waffle
            legend
            parts={shown.map((category) => ({
              label: category.name,
              value: category.tokens,
              color: colorOf(category.name),
              text: (
                <Text color={theme.muted}>
                  {compact(category.tokens)} tokens · {percent(category.tokens, usage.window)}
                </Text>
              ),
            }))}
          />
          <Box marginTop={1} flexDirection="column">
            <Text color={theme.muted} wrap="truncate-end">
              {usage.compactAt
                ? `Compacts on its own at ${compact(usage.compactAt)} tokens (${percent(usage.compactAt, usage.window)}); /compact does it now, with a focus if you give one.`
                : 'It doesn\'t compact on its own; /compact does it, with a focus if you give one.'}
            </Text>
            {deferred.length > 0 && (
              <Text color={theme.muted} wrap="truncate-end">
                Listed by name and loaded when used, so they take no room yet:{' '}
                {deferred.map((category) => `${category.name.replace(/ \(deferred\)$/, '')} ${compact(category.tokens)}`).join(' · ')}
              </Text>
            )}
          </Box>
        </Box>
      )}
    </Panel>
  );
}
