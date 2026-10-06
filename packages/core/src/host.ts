import type { AgentBackend } from './agent/agent.js';
import { ClaudeBackend } from './agent/claude/backend.js';
import { syncSkills } from './agent/claude/synced-skills.js';
import { CodexBackend } from './agent/codex/backend.js';
import { ScriptedBackend } from './agent/demo/agent.js';
import { demoCommands } from './agent/demo/commands.js';
import { scenarios } from './agent/demo/scenarios/index.js';
import { demoSessions } from './agent/demo/sessions.js';
import type { ModelSelection } from './agent/models.js';
import { JinionServer } from './api/server.js';
import { inProcessTransports } from './api/transport.js';
import { builtinCommands } from './commands/builtin.js';
import { CommandRegistry } from './commands/registry.js';
import type { JinionOptions } from './controllers/jinion.js';
import { FileSessionStore, MemorySessionStore } from './conversation/store.js';
import { DebugLog } from './lib/debug.js';
import { McpConfig } from './mcp/config.js';
import { MemoryStore } from './memory/store.js';
import { loadProjectSettings } from './settings/project.js';
import { loadSettings } from './settings/user.js';
import { Terminals } from './terminals/terminals.js';

export interface CoreFlags {
  cwd: string;
  version: string;
  demo?: boolean;
  model?: string;
  effort?: string;
  debug?: boolean;
  continue?: boolean;
  /** The client shows the project's terminals, so the agent gets tools to run and read commands there. */
  terminals?: boolean;
}

export type CoreOptions = Omit<JinionOptions, 'commands'>;

/** What the core runs with, from the flags it was started with. */
export function coreOptions(flags: CoreFlags) {
  const { cwd, version, demo } = flags;
  const { mode } = loadProjectSettings(cwd);
  const memory = new MemoryStore(cwd);
  const terminals = flags.terminals ? new Terminals() : undefined;
  const debug = flags.debug ? new DebugLog() : undefined;

  const settings = loadSettings();

  const backends: AgentBackend[] = demo
    ? [new ScriptedBackend(scenarios, demoCommands)]
    : [
        new ClaudeBackend({ cwd, account: settings.accounts?.Claude, memory, terminals, mcp: new McpConfig(cwd), debug, syncSkills }),
        new CodexBackend({ cwd, version, memory, terminals, debug }),
      ];

  const backend = backends.find(({ name }) => name === settings.agent) ?? backends[0]!;

  // Flags win over the choice `/model` saved in an earlier run.
  const savedModel = settings.models?.[backend.name];
  const { model, effort } = flags;
  const selection: ModelSelection = model ? { model, effort } : { ...(savedModel ?? { model: backend.defaultModel }), ...(effort && { effort }) };

  const saved = demo ? new MemorySessionStore(demoSessions()) : new FileSessionStore(cwd);
  const farewells: string[] = [];

  const options: CoreOptions = {
    backends,
    agent: backend.name,
    selection,
    mode,
    info: { version, cwd, examples: demo ? ['add rate limiting to the api', 'hello'] : [] },
    saved,
    memory,
    terminals,
    initial: flags.continue ? saved.list()[0] : undefined,
    onExit: (message) => farewells.push(message),
  };

  return { options, debug, farewells };
}

/** The core, run in this process; each client reaches it the way any client does. */
export function startCore(options: CoreOptions) {
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
