import { firstPrompt, type SavedSession } from '../../conversation/session.js';
import type { Methods } from '../connection.js';
import { appFields, readFields } from '../fields.js';
import { ApiCode, PROTOCOL_VERSION, type SavedSummary } from '../protocol.js';
import { RpcCode, RpcError } from '../rpc.js';
import { supported } from './supported.js';

/**
 * Starting, quitting, and what every session shares: saved conversations, memory, and the MCP servers and usage of the
 * backend the user looks at.
 */
export const appMethods: Methods = (connection) => {
  const { app } = connection;

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
      commands: app.commands.list().map(({ run: _, ...command }) => command),
      app: readFields(app.store, appFields),
      ...connection.host.sessions(),
    };
  });

  connection.answer('app/quit', () => app.quit());

  connection.answer('saved/list', () =>
    app.saved.list().map((session) => ({ ...summary(session), openElsewhere: app.saved.openElsewhere(session.id) !== undefined || undefined })),
  );

  connection.answer('memory/list', () => app.memory.list().map((memory) => ({ ...memory, path: app.memory.path(memory) })));

  connection.answer('memory/forget', ({ scope, id }) => {
    const memory = app.memory.remove(`${scope}/${id}`);

    if (memory) app.notice(`Forgot ${scope}/${id}: ${memory.title}`);
  });

  connection.answer('mcp/servers', () => {
    const { backend } = app;

    return supported(backend.mcp, backend.name, 'list MCP servers').servers();
  });

  connection.answer('mcp/save', ({ enabled }) => app.mcp.save(enabled));

  connection.answer('usage/limits', ({ drivers }) => {
    const { backend } = app;

    return supported(backend.usage?.bind(backend), backend.name, 'report its usage')({ drivers });
  });

  connection.answer('usage/history', () => {
    const { backend } = app;

    return supported(backend.history?.bind(backend), backend.name, 'keep a history of its use')((done, total) =>
      connection.peer.notify('usage/history-progress', { done, total }),
    );
  });
};

function summary(session: SavedSession): SavedSummary {
  const { id, title, updatedAt, entries, worktree } = session;
  const messages = entries.filter((entry) => entry.kind === 'user' || entry.kind === 'text').length;

  return { id, title, updatedAt, messages, firstPrompt: firstPrompt(session), worktree: worktree?.name };
}
