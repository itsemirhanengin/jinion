import { useEffect, useRef, useState } from 'react';
import { Box, ChoiceList, choiceIndent, Panel, Text, useChoiceList, usePanel, useTheme, type Choice, type Theme } from '@jinion/tui';
import type { AgentMcp, McpServerInfo } from '../agent/mcp.js';
import { useJinion } from '../app/context.js';
import { errorMessage } from '../lib/errors.js';
import { plural } from '../lib/format.js';
import { truncate } from '../lib/text.js';

const VISIBLE = 10;
const LABEL_WIDTH = 18;
const TOOLS_SHOWN = 8;
const POLL_MS = 1_500;

/** Changes apply from the next turn, when the agent connects again. */
export function McpPanel({ mcp }: { mcp: AgentMcp }) {
  const jinion = useJinion();
  const theme = useTheme();
  const { close } = usePanel();
  const [servers, setServers] = useState<McpServerInfo[]>();
  const [failure, setFailure] = useState<string>();
  // Servers the user toggled keep their check when the list comes in again.
  const touched = useRef(new Set<string>());

  const list = useChoiceList({
    keys: (servers ?? []).map((server) => server.name),
    mode: 'multiple',
    onCancel: close,
    onToggle: (name) => void touched.current.add(name),
    onSubmit: (checked) => {
      close();
      const changed = (servers ?? []).filter((server) => checked.includes(server.name) !== server.enabled);
      if (changed.length === 0) return;
      const labels = (on: boolean) => changed.filter((server) => !server.enabled === on).map((server) => server.label);
      mcp.setEnabled(Object.fromEntries(changed.map((server) => [server.name, !server.enabled]))).then(
        () => {
          const parts = [labels(true).length > 0 && `turned on ${labels(true).join(', ')}`, labels(false).length > 0 && `turned off ${labels(false).join(', ')}`];
          const done = parts.filter(Boolean).join('; ');
          jinion.notice(`${done.charAt(0).toUpperCase()}${done.slice(1)}. This applies from the next turn.`, 'success');
          jinion.reloadSkills();
        },
        (error: unknown) => jinion.notice(`Couldn't change the MCP servers: ${errorMessage(error)}`, 'error'),
      );
    },
  });

  useEffect(() => {
    let timer: NodeJS.Timeout | undefined;
    let open = true;
    const load = () =>
      mcp.servers().then(
        (next) => {
          if (!open) return;
          setServers(next);
          for (const server of next) if (!touched.current.has(server.name)) list.setChecked(server.name, server.enabled);
          if (next.some((server) => server.status === 'pending')) timer = setTimeout(load, POLL_MS);
        },
        (error: unknown) => open && setFailure(errorMessage(error)),
      );
    void load();
    return () => {
      open = false;
      clearTimeout(timer);
    };
  }, []);

  const choices: Choice[] = (servers ?? []).map((server) => {
    const checked = list.isChecked(server.name);
    return {
      key: server.name,
      label: (
        <Text>
          {truncate(server.label, LABEL_WIDTH - 2).padEnd(LABEL_WIDTH)}
          {checked === server.enabled ? describe(server, theme) : <Text color={theme.muted}>{checked ? 'turns on' : 'turns off'} on save</Text>}
        </Text>
      ),
      aside: server.source,
      editor: <Details server={server} indent={choiceIndent(list)} />,
    };
  });

  const on = servers?.filter((server) => list.isChecked(server.name)).length ?? 0;
  return (
    <Panel
      title="MCP servers"
      subtitle={servers ? `${on} of ${servers.length} on` : undefined}
      header={
        <Text color={theme.muted}>
          Checked servers connect from the next turn. Their tools load when the agent needs them, so a server costs little context until it's used.
        </Text>
      }
      hints={[
        ['Space', 'on/off'],
        ['Enter', 'save'],
        ['Up/Down', 'move'],
        ['Esc', 'cancel'],
      ]}
    >
      {failure ? (
        <Text color={theme.error}>Couldn't list the servers: {failure}</Text>
      ) : servers ? (
        <ChoiceList
          list={list}
          choices={choices}
          limit={VISIBLE}
          empty="No MCP servers yet. Add them with `claude mcp add`, in ~/.jinion/mcp.json or in the project's .mcp.json."
        />
      ) : (
        <Text color={theme.muted}>Asking {jinion.agent.name} about its servers…</Text>
      )}
    </Panel>
  );
}

function describe(server: McpServerInfo, theme: Theme) {
  switch (server.status) {
    case 'connected':
      return (
        <Text>
          <Text color={theme.success}>connected</Text>
          <Text color={theme.muted}> · {plural(server.tools.length, 'tool')}</Text>
        </Text>
      );
    case 'pending':
      return <Text color={theme.muted}>connecting…</Text>;
    case 'needs-auth':
      return <Text color={theme.warning}>not signed in</Text>;
    case 'failed':
      return <Text color={theme.error}>failed to connect</Text>;
    case 'off':
      return <Text color={theme.muted}>{server.source === 'project' ? 'off until you turn it on (from .mcp.json)' : 'off'}</Text>;
  }
}

function Details({ server, indent }: { server: McpServerInfo; indent: number }) {
  const theme = useTheme();
  const tools = server.tools.slice(0, TOOLS_SHOWN).join(', ');
  const more = server.tools.length - TOOLS_SHOWN;
  return (
    <Box flexDirection="column" paddingLeft={indent} marginBottom={1}>
      {server.target && (
        <Text color={theme.muted} wrap="truncate-end">
          {server.target}
        </Text>
      )}
      {server.error && <Text color={theme.error}>{server.error}</Text>}
      {server.status === 'needs-auth' && (
        <Text color={theme.muted}>
          Ask the agent to authenticate {server.label}
          {server.source === 'claude.ai' ? ', or connect it in your claude.ai settings' : ''}.
        </Text>
      )}
      {tools && (
        <Text wrap="truncate-end">
          {tools}
          {more > 0 && <Text color={theme.muted}> … {more} more</Text>}
        </Text>
      )}
    </Box>
  );
}
