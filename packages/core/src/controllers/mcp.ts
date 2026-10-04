import type { McpServerInfo } from '../agent/mcp.js';
import { errorMessage } from '../lib/errors.js';
import type { Context } from './context.js';

/** Changes apply from the next turn, when the agent connects again. */
export class McpController {
  constructor(
    private readonly context: Context,
    private readonly changed: () => void,
  ) {}

  async save(servers: McpServerInfo[], checked: string[]) {
    const { backend, notice } = this.context;
    const changes = servers.filter((server) => checked.includes(server.name) !== server.enabled);
    if (!backend.mcp || changes.length === 0) return;

    const labels = (on: boolean) => changes.filter((server) => !server.enabled === on).map((server) => server.label);

    try {
      await backend.mcp.setEnabled(Object.fromEntries(changes.map((server) => [server.name, !server.enabled])));
    } catch (error) {
      return notice(`Couldn't change the MCP servers: ${errorMessage(error)}`, 'error');
    }

    const parts = [labels(true).length > 0 && `turned on ${labels(true).join(', ')}`, labels(false).length > 0 && `turned off ${labels(false).join(', ')}`];
    const done = parts.filter(Boolean).join('; ');

    notice(`${done.charAt(0).toUpperCase()}${done.slice(1)}. This applies from the next turn.`, 'success');
    this.changed();
  }
}
