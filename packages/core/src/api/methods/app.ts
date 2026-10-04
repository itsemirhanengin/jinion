import type { Jinion } from '../../controllers/jinion.js';
import type { SavedSession } from '../../conversation/session.js';
import type { Methods } from '../connection.js';
import { appFields, readFields } from '../fields.js';
import { type AgentInfo, ApiCode, PROTOCOL_VERSION, type SavedSummary } from '../protocol.js';
import { RpcCode, RpcError } from '../rpc.js';
import { supported } from './supported.js';

/** Starting, quitting, and what every session shares: saved conversations, memory, MCP servers and usage. */
export const appMethods: Methods = (connection) => {
  const { app } = connection;
  const { backend } = app;

  connection.answer('initialize', ({ protocolVersion, notifications }) => {
    if (connection.ready) throw new RpcError(RpcCode.invalidRequest, 'The client is already initialized.');

    if (protocolVersion !== PROTOCOL_VERSION) {
      throw new RpcError(ApiCode.unsupportedVersion, `jinion speaks protocol ${PROTOCOL_VERSION}, the client ${protocolVersion}.`, {
        supported: [PROTOCOL_VERSION],
      });
    }

    connection.ready = true;
    connection.notifications = notifications ?? connection.notifications;

    return {
      protocolVersion: PROTOCOL_VERSION,
      server: { name: 'jinion', version: app.info.version },
      info: app.info,
      agent: agentInfo(app),
      commands: app.commands.list().map(({ run: _, ...command }) => command),
      app: readFields(app.store, appFields),
      ...connection.host.sessions(),
    };
  });

  connection.answer('app/quit', () => app.quit());
  connection.answer('saved/list', () => app.saved.list().map(summary));
  connection.answer('memory/list', () => app.memory.list().map((memory) => ({ ...memory, path: app.memory.path(memory) })));

  connection.answer('memory/forget', ({ scope, id }) => {
    const memory = app.memory.remove(`${scope}/${id}`);

    if (memory) app.notice(`Forgot ${scope}/${id}: ${memory.title}`);
  });

  connection.answer('mcp/servers', () => supported(backend.mcp, backend.name, 'list MCP servers').servers());
  connection.answer('mcp/save', ({ enabled }) => app.mcp.save(enabled));
  connection.answer('usage/limits', ({ drivers }) => supported(backend.usage?.bind(backend), backend.name, 'report its usage')({ drivers }));

  connection.answer('usage/history', () =>
    supported(backend.history?.bind(backend), backend.name, 'keep a history of its use')((done, total) =>
      connection.peer.notify('usage/history-progress', { done, total }),
    ),
  );
};

/** Every session runs on the same backend, so the one the user looks at speaks for all. */
function agentInfo({ backend, session: { agent } }: Jinion): AgentInfo {
  return {
    name: backend.name,
    modes: backend.modes,
    features: {
      accounts: backend.accounts !== undefined,
      mcp: backend.mcp !== undefined,
      usage: backend.usage !== undefined,
      history: backend.history !== undefined,
      steer: agent.steer !== undefined,
      rewind: agent.rewind !== undefined,
      context: agent.context !== undefined,
      background: agent.background !== undefined,
      compact: agent.compact !== undefined,
    },
  };
}

function summary({ id, title, updatedAt, entries, worktree }: SavedSession): SavedSummary {
  return { id, title, updatedAt, messages: entries.filter((entry) => entry.kind === 'user' || entry.kind === 'text').length, worktree: worktree?.name };
}
