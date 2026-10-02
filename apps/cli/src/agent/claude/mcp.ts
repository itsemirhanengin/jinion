import type { McpServerConfig, McpServerStatus, SlashCommand } from '@anthropic-ai/claude-agent-sdk';
import type { McpConfig, McpSource, McpTransport } from '../../mcp/config.js';
import type { AgentCommand, McpServerInfo } from '../types.js';
import { MEMORY_SERVER } from './memory.js';

export function toClaudeServer(transport: McpTransport): McpServerConfig {
  if ('command' in transport) return { type: 'stdio', command: transport.command, args: transport.args, env: transport.env };
  return { type: transport.type, url: transport.url, headers: transport.headers };
}

const SOURCES: Record<McpSource, string> = { jinion: 'jinion', claude: 'claude code', project: 'project' };

/** Servers Claude Code finds itself: claude.ai connectors (`claude.ai Linear`) and plugins' (`plugin:vercel:vercel`). */
const CONNECTOR = /^claude\.ai (.+)$/;
const PLUGIN_SERVER = /^plugin:([^:]+):(.+)$/;

const labelOf = (name: string) => CONNECTOR.exec(name)?.[1] ?? PLUGIN_SERVER.exec(name)?.[2] ?? name;

function sourceOf(name: string) {
  if (CONNECTOR.test(name)) return 'claude.ai';
  const plugin = PLUGIN_SERVER.exec(name);
  return plugin ? `plugin ${plugin[1]}` : 'claude code';
}

/**
 * What Claude Code reports, together with the servers that don't run: configured ones that are off, and found ones
 * the user turned off, which Claude Code no longer lists.
 */
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

function targetOf(config: unknown) {
  if (typeof config !== 'object' || config === null) return undefined;
  const { url, command, args } = config as { url?: unknown; command?: unknown; args?: unknown };
  if (typeof url === 'string') return url;
  if (typeof command === 'string') return [command, ...(Array.isArray(args) ? args : [])].join(' ');
  return undefined;
}

/** Claude Code lists an MCP prompt as `claude.ai Figma:create_rules (MCP)`, and runs it as `/mcp__claude_ai_Figma__create_rules`. */
const MCP_PROMPT = /^(.+):([^:]+) \(MCP\)$/;

/** The part of a tool or command name Claude Code makes from a server's name. */
const normalized = (server: string) => server.replace(/[^a-zA-Z0-9_-]/g, '_');

/** Which comes first when two want the same short name: the project's, the user's, plugins', then MCP prompts. */
const PRECEDENCE = ['project', 'user', 'plugin', 'mcp'] as const;

/**
 * Claude Code's commands as Jinion's, with what to send Claude Code for each. Each gets its short name, `design` for
 * `user:design` or `nextjs` for `vercel:nextjs`, unless one that comes first already has it.
 */
export function toAgentCommands(list: SlashCommand[]) {
  const entries = list
    .filter((command) => !command.builtin)
    .map((command) => {
      const prompt = MCP_PROMPT.exec(command.name);
      if (prompt) {
        const server = labelOf(prompt[1]!).replace(/\s+/g, '-');
        const kind = 'mcp' as const;
        return { command, kind, group: server, short: prompt[2]!, full: `${server}:${prompt[2]}`, target: `mcp__${normalized(prompt[1]!)}__${prompt[2]}` };
      }
      const colon = command.name.indexOf(':');
      const plugin = colon === -1 ? undefined : command.name.slice(0, colon);
      const kind: (typeof PRECEDENCE)[number] = plugin === 'project' || plugin === 'user' ? plugin : 'plugin';
      const short = colon === -1 ? command.name : command.name.slice(colon + 1);
      return { command, kind, group: plugin ?? 'plugin', short, full: command.name, target: command.name };
    })
    .sort((a, b) => PRECEDENCE.indexOf(a.kind) - PRECEDENCE.indexOf(b.kind));

  const invocations = new Map<string, string>();
  const commands: AgentCommand[] = [];
  for (const { command, kind, group, short, full, target } of entries) {
    const name = invocations.has(short) ? full : short;
    if (invocations.has(name) || /\s/.test(name)) continue;
    invocations.set(name, target);
    commands.push({
      name,
      // Claude Code puts a plugin's name before its skills' descriptions; the pickers show it as the group instead.
      description: command.description.replace(/^\([^)]+\) /, ''),
      source: kind === 'mcp' ? 'mcp' : 'skill',
      group,
      argumentHint: command.argumentHint || undefined,
    });
  }
  return { commands, invocations };
}
