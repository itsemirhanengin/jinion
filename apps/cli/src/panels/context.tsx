import { Box, Panel, Text, useInput, usePanel, useTheme, Waffle, type Theme } from '@jinion/tui';
import { useAtomValue } from 'jotai';
import type { ContextUsage } from '@jinion/core/agent/usage';
import { useJinion } from '../app/context.js';
import { compact, percent } from '@jinion/core/lib/format';
import { modelNameAtom } from '@jinion/core/state/agent';
import { useAsync } from '../ui/use-async.js';

export function ContextPanel() {
  const { agent } = useJinion();
  const theme = useTheme();
  const { close } = usePanel();
  const modelName = useAtomValue(modelNameAtom);

  const read = agent.context?.bind(agent);
  const usage = useAsync(() => read?.(), []);
  const loaded = usage.state === 'done' ? usage.value : undefined;

  useInput((_, key) => {
    if (key.escape || key.return) close();
  });

  return (
    <Panel
      title="Context"
      subtitle={
        loaded && `${modelName} · ${compact(loaded.used)} of ${compact(loaded.window)} tokens · ${percent(loaded.used, loaded.window)}`
      }
      hints={[['Esc', 'close']]}
    >
      {!read ? (
        <Text color={theme.muted}>{agent.name} doesn't say what fills its context.</Text>
      ) : usage.state === 'failed' ? (
        <Text color={theme.error}>
          Couldn't ask {agent.name} about its context: {usage.error}
        </Text>
      ) : !loaded ? (
        <Text color={theme.muted}>Asking {agent.name} what fills its context…</Text>
      ) : (
        <ContextChart usage={loaded} />
      )}
    </Panel>
  );
}

function ContextChart({ usage }: { usage: ContextUsage }) {
  const theme = useTheme();

  const colorOf = colors(theme);
  const shown = usage.categories.filter((category) => category.kind !== 'deferred' && category.tokens > 0);
  const deferred = usage.categories.filter((category) => category.kind === 'deferred' && category.tokens > 0);

  return (
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
            : "It doesn't compact on its own; /compact does it, with a focus if you give one."}
        </Text>
        {deferred.length > 0 && (
          <Text color={theme.muted} wrap="truncate-end">
            Listed by name and loaded when used, so they take no room yet:{' '}
            {deferred.map((category) => `${category.name.replace(/ \(deferred\)$/, '')} ${compact(category.tokens)}`).join(' · ')}
          </Text>
        )}
      </Box>
    </Box>
  );
}

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
