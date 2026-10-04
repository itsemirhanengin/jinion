import type { AgentMode } from '../agent/agent.js';
import { MODES } from '../agent/modes.js';
import type { Command } from './registry.js';

export const mode: Command = {
  name: 'mode',
  description: 'How freely the agent acts: manual, accept edits, plan or auto (shift+tab)',
  argumentHint: '[mode]',
  run: (jinion, args) => {
    const wanted = args.trim().toLowerCase();
    if (!wanted) return jinion.screen.openView({ id: 'mode' });

    const { modes } = jinion.agent;

    const found = modes.find((candidate) => candidate === wanted || MODES[candidate].name.toLowerCase() === wanted) as
      | AgentMode
      | undefined;
    if (!found) return jinion.notice(`No mode "${args.trim()}". Pick one of ${modes.join(', ')}, or type /mode.`, 'error');

    jinion.modes.select(found);
  },
};

export const account: Command = {
  name: 'account',
  description: 'Switch between your logins, sign one in (again) with account add <name>, or remove one',
  argumentHint: '[name | add <name> | remove <name>]',
  run: (jinion, args) => {
    if (!jinion.agent.accounts) return jinion.notice(`${jinion.agent.name} has a single login.`, 'warning');

    const [first = '', second = ''] = args.trim().split(/\s+/);
    if (!first) return jinion.screen.openView({ id: 'account' });
    if (first === 'add') return jinion.screen.openView({ id: 'account', signIn: second || undefined });

    if (first === 'remove') {
      if (!second) return jinion.notice('Say which account to remove, e.g. /account remove work.', 'warning');

      return void jinion.accounts.remove(second);
    }

    jinion.accounts.select(first);
  },
};

export const mcp: Command = {
  name: 'mcp',
  description: 'The MCP servers the agent connects to; turn them on or off',
  run: (jinion) => {
    if (!jinion.agent.mcp) return jinion.notice(`${jinion.agent.name} has no MCP servers.`, 'warning');

    jinion.screen.openView({ id: 'mcp' });
  },
};
