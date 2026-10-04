import type { AgentBackend } from '@jinion/core/agent/agent';
import { ClaudeBackend } from '@jinion/core/agent/claude/backend';
import { syncSkills } from '@jinion/core/agent/claude/synced-skills';
import { ScriptedBackend } from '@jinion/core/agent/demo/agent';
import { demoCommands } from '@jinion/core/agent/demo/commands';
import { scenarios } from '@jinion/core/agent/demo/scenarios/index';
import { demoSessions } from '@jinion/core/agent/demo/sessions';
import type { ModelSelection } from '@jinion/core/agent/models';
import { JinionServer } from '@jinion/core/api/server';
import { inProcessTransports } from '@jinion/core/api/transport';
import { builtinCommands } from '@jinion/core/commands/builtin';
import { CommandRegistry } from '@jinion/core/commands/registry';
import type { JinionOptions } from '@jinion/core/controllers/jinion';
import { FileSessionStore, MemorySessionStore } from '@jinion/core/conversation/store';
import { DebugLog } from '@jinion/core/lib/debug';
import { McpConfig } from '@jinion/core/mcp/config';
import { MemoryStore } from '@jinion/core/memory/store';
import { loadProjectSettings } from '@jinion/core/settings/project';
import { loadSettings } from '@jinion/core/settings/user';

export interface CoreFlags {
  cwd: string;
  version: string;
  demo?: boolean;
  model?: string;
  effort?: string;
  debug?: boolean;
  continue?: boolean;
}

export type CoreOptions = Omit<JinionOptions, 'commands'>;

/** What the core runs with, from the flags it was started with. */
export function coreOptions(flags: CoreFlags) {
  const { cwd, version, demo } = flags;
  const { mode } = loadProjectSettings(cwd);
  const memory = new MemoryStore(cwd);
  const debug = flags.debug ? new DebugLog() : undefined;

  const settings = loadSettings();

  const backends: AgentBackend[] = demo
    ? [new ScriptedBackend(scenarios, demoCommands)]
    : [new ClaudeBackend({ cwd, account: settings.accounts?.Claude, memory, mcp: new McpConfig(cwd), debug, syncSkills })];

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
