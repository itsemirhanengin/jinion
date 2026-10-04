import type { AgentMcp, McpServerInfo } from '../mcp.js';
import type { CodexConnection } from './connection.js';
import type { McpServerStatus } from './protocol.js';

const STATUS: Record<NonNullable<McpServerStatus['runtimeStatus']>, McpServerInfo['status']> = {
  connected: 'connected',
  starting: 'pending',
  notStarted: 'pending',
  authenticationRequired: 'needs-auth',
  failed: 'failed',
  cancelled: 'failed',
  disabled: 'off',
};

/**
 * The servers in Codex's own config, and those its plugins bring. Turning one off writes `enabled = false` to Codex's
 * config.toml, as `codex mcp` would leave it.
 */
export function codexMcp(connect: () => CodexConnection, liveThread: () => string | undefined): AgentMcp {
  return {
    async servers() {
      const connection = connect();
      const threadId = liveThread();

      const [{ data }, configured] = await Promise.all([
        connection.request<{ data: McpServerStatus[] }>('mcpServerStatus/list', { detail: 'toolsAndAuthOnly', threadId }),
        configuredServers(connection),
      ]);

      return data.map((server): McpServerInfo => {
        const enabled = configured[server.name]?.enabled !== false;
        // Only the connection says a login is missing: Codex calls a server with a key in its headers not logged in.
        const status = !enabled ? 'off' : server.runtimeStatus ? STATUS[server.runtimeStatus] : 'pending';

        return {
          name: server.name,
          label: server.name,
          source: server.pluginId ? `plugin ${server.pluginId.split('@')[0]}` : 'Codex config',
          enabled,
          status,
          tools: Object.keys(server.tools),
        };
      });
    },

    async setEnabled(changes) {
      const connection = connect();

      for (const [name, enabled] of Object.entries(changes)) {
        await connection.request('config/value/write', { keyPath: `mcp_servers.${name}.enabled`, value: enabled, mergeStrategy: 'upsert' });
      }

      await connection.request('config/mcpServer/reload', {});
    },
  };
}

/** Only whether each is on is read; the rest of the config, keys included, isn't kept. */
async function configuredServers(connection: CodexConnection) {
  const { config } = await connection.request<{ config: { mcp_servers?: Record<string, { enabled?: boolean }> } }>('config/read', {});

  return config.mcp_servers ?? {};
}
