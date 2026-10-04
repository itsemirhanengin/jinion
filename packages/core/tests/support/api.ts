import { vi } from 'vitest';
import { z } from 'zod';
import type { AgentBackend } from '../../src/agent/agent.js';
import { ScriptedBackend } from '../../src/agent/demo/agent.js';
import { demoCommands } from '../../src/agent/demo/commands.js';
import { scenarios } from '../../src/agent/demo/scenarios/index.js';
import { demoSessions } from '../../src/agent/demo/sessions.js';
import { JinionClient, type ScreenHandlers } from '../../src/api/client.js';
import { notificationsToClient, requests } from '../../src/api/protocol.js';
import { JinionServer } from '../../src/api/server.js';
import { inProcessTransports, type Transport } from '../../src/api/transport.js';
import { builtinCommands } from '../../src/commands/builtin.js';
import { CommandRegistry } from '../../src/commands/registry.js';
import { MemorySessionStore } from '../../src/conversation/store.js';
import { MemoryStore } from '../../src/memory/store.js';

/** A server on the demo backend, as fast as it goes, and clients connected to it in process. */
export function serve(project: string, { backend = new ScriptedBackend(scenarios, demoCommands, 0) as AgentBackend } = {}) {
  const saved = new MemorySessionStore(demoSessions());
  const memory = new MemoryStore(project);

  const server = new JinionServer({
    backend,
    info: { version: '1.2.3', cwd: project },
    saved,
    memory,
    commands: new CommandRegistry(builtinCommands),
  });

  /** `wire` stands between the client and its transport, e.g. to lose a message on the way. */
  const connect = async ({ wire = (transport: Transport) => transport, followAll = false } = {}) => {
    const [serverSide, clientSide] = inProcessTransports();
    const screen: ScreenHandlers = { view: vi.fn(), fillPrompt: vi.fn(), notify: vi.fn(), expand: vi.fn(), exit: vi.fn() };
    const client = new JinionClient(checked(wire(clientSide)), { name: 'test', version: '0.0.0', screen, followAll });

    server.connect(serverSide);

    const initialized = await client.initialize();

    return { client, screen, initialized, session: server.app.session.id };
  };

  return { server, saved, memory, connect };
}

/**
 * Checks everything the server sends against the protocol's schemas before the client sees it, so every API test also
 * tests that the types and the JSON Schema clients get say what really comes.
 */
export function checked(transport: Transport): Transport {
  const asked = new Map<unknown, keyof typeof requests>();

  const check = (text: string) => {
    const message = JSON.parse(text) as { id?: unknown; method?: keyof typeof notificationsToClient; params?: unknown; result?: unknown };
    if (message.method) return fits(message.method, notificationsToClient[message.method], message.params);

    const method = asked.get(message.id);

    if (method && 'result' in message) fits(method, requests[method].result, message.result);
  };

  return {
    start: (receiver) =>
      transport.start({
        message: (text) => {
          check(text);
          receiver.message(text);
        },
        closed: () => receiver.closed(),
      }),
    send: (text) => {
      const message = JSON.parse(text) as { id?: unknown; method?: keyof typeof requests };

      if (message.id !== undefined && message.method) asked.set(message.id, message.method);
      transport.send(text);
    },
    close: () => transport.close(),
  };
}

function fits(method: string, schema: z.ZodType | undefined, value: unknown) {
  if (!schema) throw new Error(`The server sent ${method}, which the protocol doesn't have.`);

  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new Error(`What the server sent for ${method} doesn't fit the protocol:\n${z.prettifyError(parsed.error)}`);
}
