import { vi } from 'vitest';
import type { AgentBackend } from '../../src/agent/agent.js';
import { ScriptedBackend } from '../../src/agent/demo/agent.js';
import { demoCommands } from '../../src/agent/demo/commands.js';
import { scenarios } from '../../src/agent/demo/scenarios/index.js';
import { demoSessions } from '../../src/agent/demo/sessions.js';
import { JinionClient, type ScreenHandlers } from '../../src/api/client.js';
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
    const client = new JinionClient(wire(clientSide), { name: 'test', version: '0.0.0', screen, followAll });

    server.connect(serverSide);

    const initialized = await client.initialize();

    return { client, screen, initialized, session: server.app.session.id };
  };

  return { server, saved, memory, connect };
}
