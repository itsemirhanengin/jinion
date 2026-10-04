import { JinionServer } from '@jinion/core/api/server';
import { inProcessTransports } from '@jinion/core/api/transport';
import { builtinCommands } from '@jinion/core/commands/builtin';
import { CommandRegistry } from '@jinion/core/commands/registry';
import type { JinionOptions } from '@jinion/core/controllers/jinion';

/** The core, run in this process for the terminal app, which reaches it the way any client does. */
export function startCore(options: Omit<JinionOptions, 'commands'>) {
  const server = new JinionServer({ ...options, commands: new CommandRegistry(builtinCommands) });

  return {
    server,
    /** A transport to the core for one client. */
    connect() {
      const [core, client] = inProcessTransports();

      server.connect(core);

      return client;
    },
  };
}
