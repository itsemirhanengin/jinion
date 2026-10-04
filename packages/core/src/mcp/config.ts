import { homedir } from 'node:os';
import { join } from 'node:path';
import { readJson } from '../lib/json-file.js';
import { jinionHome } from '../lib/paths.js';
import { loadProjectSettings, updateProjectSettings } from '../settings/project.js';
import { loadSettings, updateSettings } from '../settings/user.js';

export type McpTransport =
  | { type?: 'stdio'; command: string; args?: string[]; env?: Record<string, string> }
  | { type: 'http' | 'sse'; url: string; headers?: Record<string, string> };

/** `project` is the project's `.mcp.json`, which anyone with commit access can change, so it runs only once the user turned it on. */
export type McpSource = 'jinion' | 'claude' | 'project';

export interface McpServerConfig {
  name: string;
  source: McpSource;
  transport: McpTransport;
}

type McpFile = { mcpServers?: Record<string, McpTransport> };

export class McpConfig {
  constructor(private readonly cwd: string) {}

  /** When two sources name the same server, the first in this order wins. */
  servers(): McpServerConfig[] {
    const claude = readJson<McpFile & { projects?: Record<string, McpFile> }>(claudeConfigFile(), {});

    const sources: [McpSource, McpFile | undefined][] = [
      ['jinion', readJson<McpFile>(join(jinionHome(), 'mcp.json'), {})],
      ['claude', claude.projects?.[this.cwd]],
      ['project', readJson<McpFile>(join(this.cwd, '.mcp.json'), {})],
      ['claude', claude],
    ];

    const servers = new Map<string, McpServerConfig>();

    for (const [source, file] of sources) {
      for (const [name, transport] of Object.entries(file?.mcpServers ?? {})) {
        if (!servers.has(name) && isTransport(transport)) servers.set(name, { name, source, transport: expand(transport) });
      }
    }

    return [...servers.values()];
  }

  isEnabled({ name, source }: Pick<McpServerConfig, 'name' | 'source'>) {
    if (this.disabled().includes(name)) return false;

    return source !== 'project' || (loadProjectSettings(this.cwd).mcp?.approved ?? []).includes(name);
  }

  /** Every server turned off by name, also ones the agent finds itself, such as claude.ai connectors. */
  disabled() {
    return loadSettings().mcp?.disabled ?? [];
  }

  setEnabled(server: Pick<McpServerConfig, 'name'> & { source?: string }, enabled: boolean) {
    updateSettings(({ mcp }) => ({ mcp: { ...mcp, disabled: toggled(mcp?.disabled, server.name, !enabled) } }));
    if (server.source !== 'project') return;

    updateProjectSettings(this.cwd, ({ mcp }) => ({ mcp: { ...mcp, approved: toggled(mcp?.approved, server.name, enabled) } }));
  }
}

function toggled(names: string[] = [], name: string, included: boolean) {
  const set = new Set(names);

  if (included) set.add(name);
  else set.delete(name);

  return [...set].sort();
}

const claudeConfigFile = () =>
  process.env.CLAUDE_CONFIG_DIR ? join(process.env.CLAUDE_CONFIG_DIR, '.claude.json') : join(homedir(), '.claude.json');

function isTransport(value: unknown): value is McpTransport {
  if (typeof value !== 'object' || value === null) return false;

  const transport = value as Record<string, unknown>;

  return typeof transport.command === 'string' || typeof transport.url === 'string';
}

function expand(transport: McpTransport): McpTransport {
  const replace = (value: string) =>
    value.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?\}/g, (_, name: string, fallback?: string) => process.env[name] ?? fallback ?? '');

  const record = (values?: Record<string, string>) =>
    values && Object.fromEntries(Object.entries(values).map(([key, value]) => [key, replace(value)]));

  if ('command' in transport) {
    return { ...transport, command: replace(transport.command), args: transport.args?.map(replace), env: record(transport.env) };
  }

  return { ...transport, url: replace(transport.url), headers: record(transport.headers) };
}
