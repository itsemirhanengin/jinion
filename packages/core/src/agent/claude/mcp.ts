import type { McpServerConfig, McpServerStatus, query } from '@anthropic-ai/claude-agent-sdk';
import type { McpConfig, McpSource, McpTransport } from '../../mcp/config.js';
import type { AgentMcp, McpServerInfo } from '../mcp.js';
import { MEMORY_SERVER } from './memory.js';

const SOURCES: Record<McpSource, string> = { jinion: 'jinion', claude: 'claude code', project: 'project' };

/** Servers Claude Code finds itself: claude.ai connectors (`claude.ai Linear`) and plugins' (`plugin:vercel:vercel`). */
const CONNECTOR = /^claude\.ai (.+)$/;
const PLUGIN_SERVER = /^plugin:([^:]+):(.+)$/;

export function toClaudeServer(transport: McpTransport): McpServerConfig {
  if ('command' in transport) return { type: 'stdio', command: transport.command, args: transport.args, env: transport.env };

  return { type: transport.type, url: transport.url, headers: transport.headers };
}

export function claudeMcp(config: McpConfig, running: () => ReturnType<typeof query>, onChange: () => void): AgentMcp {
  return {
    servers: async () => serverInfos(await running().mcpServerStatus(), config),
    setEnabled: async (changes) => {
      const servers = config.servers();

      for (const [name, enabled] of Object.entries(changes)) {
        config.setEnabled(servers.find((server) => server.name === name) ?? { name }, enabled);
      }

      if (Object.keys(changes).length > 0) onChange();
    },
  };
}

/** Adds the servers that don't run, also found ones the user turned off, which Claude Code no longer lists. */
export function serverInfos(statuses: McpServerStatus[], config: McpConfig): McpServerInfo[] {
  const configured = new Map(config.servers().map((server) => [server.name, server]));
  const disabled = new Set(config.disabled());

  const enabled = (name: string) => {
    const server = configured.get(name);

    return server ? config.isEnabled(server) : !disabled.has(name);
  };

  const infos = new Map<string, McpServerInfo>();

  for (const status of statuses) {
    if (status.name === MEMORY_SERVER) continue;

    const server = configured.get(status.name);
    const on = enabled(status.name) && status.status !== 'disabled';

    infos.set(status.name, {
      name: status.name,
      label: labelOf(status.name),
      source: server ? SOURCES[server.source] : sourceOf(status.name),
      enabled: on,
      status: on ? (status.status as McpServerInfo['status']) : 'off',
      target: targetOf(status.config),
      error: status.error,
      tools: (status.tools ?? []).map((tool) => tool.name),
    });
  }

  for (const server of configured.values()) {
    if (infos.has(server.name)) continue;

    const on = config.isEnabled(server);

    infos.set(server.name, {
      name: server.name,
      label: server.name,
      source: SOURCES[server.source],
      enabled: on,
      // Turned on since Claude Code started; it connects from the next turn on.
      status: on ? 'pending' : 'off',
      target: targetOf(server.transport),
      tools: [],
    });
  }

  for (const name of disabled) {
    if (!infos.has(name)) infos.set(name, { name, label: labelOf(name), source: sourceOf(name), enabled: false, status: 'off', tools: [] });
  }

  const rank = (info: McpServerInfo) => (info.source === 'claude.ai' ? 2 : info.source.startsWith('plugin') ? 1 : 0);

  return [...infos.values()].sort((a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label));
}

export const labelOf = (name: string) => CONNECTOR.exec(name)?.[1] ?? PLUGIN_SERVER.exec(name)?.[2] ?? name;

function sourceOf(name: string) {
  if (CONNECTOR.test(name)) return 'claude.ai';

  const plugin = PLUGIN_SERVER.exec(name);

  return plugin ? `plugin ${plugin[1]}` : 'claude code';
}

function targetOf(config: unknown) {
  if (typeof config !== 'object' || config === null) return undefined;

  const { url, command, args } = config as { url?: unknown; command?: unknown; args?: unknown };
  if (typeof url === 'string') return url;
  if (typeof command === 'string') return [command, ...(Array.isArray(args) ? args : [])].join(' ');

  return undefined;
}
