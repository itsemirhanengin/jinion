import type { AgentBackend } from '../agent/agent.js';
import type { McpServerInfo } from '../agent/mcp.js';
import { errorMessage } from '../lib/errors.js';
import type { AppContext } from './context.js';

/** The servers of the backend the user looks at. Changes apply from the next turn, when the agent connects again. */
export class McpController {
  constructor(
    private readonly context: AppContext,
    private readonly changed: (backend: AgentBackend) => void,
  ) {}

  /** `enabled` names the servers to have on; the others go off. */
  async save(enabled: string[]) {
    const { notice } = this.context;
    const backend = this.context.activeBackend();
    if (!backend.mcp) return;

    let changes: McpServerInfo[];

    try {
      changes = (await backend.mcp.servers()).filter((server) => enabled.includes(server.name) !== server.enabled);
      if (changes.length === 0) return;

      await backend.mcp.setEnabled(Object.fromEntries(changes.map((server) => [server.name, !server.enabled])));
    } catch (error) {
      return notice(`Couldn't change the MCP servers: ${errorMessage(error)}`, 'error');
    }

    const labels = (on: boolean) => changes.filter((server) => !server.enabled === on).map((server) => server.label);
    const parts = [labels(true).length > 0 && `turned on ${labels(true).join(', ')}`, labels(false).length > 0 && `turned off ${labels(false).join(', ')}`];
    const done = parts.filter(Boolean).join('; ');

    notice(`${done.charAt(0).toUpperCase()}${done.slice(1)}. This applies from the next turn.`, 'success');
    this.changed(backend);
  }
}
