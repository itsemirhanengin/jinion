import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';
import { run, type ColorScheme } from '@jinion/tui';
import { ClaudeBackend } from '@jinion/core/agent/claude/backend';
import { syncSkills } from '@jinion/core/agent/claude/synced-skills';
import { demoCommands } from '@jinion/core/agent/demo/commands';
import { scenarios } from '@jinion/core/agent/demo/scenarios/index';
import { ScriptedBackend } from '@jinion/core/agent/demo/agent';
import type { AgentBackend } from '@jinion/core/agent/agent';
import type { ModelSelection } from '@jinion/core/agent/models';
import { App } from './app/app.js';
import { DebugLog } from '@jinion/core/lib/debug';
import { McpConfig } from '@jinion/core/mcp/config';
import { MemoryStore } from '@jinion/core/memory/store';
import { loadProjectSettings } from '@jinion/core/settings/project';
import { loadSettings } from '@jinion/core/settings/user';
import { demoSessions } from '@jinion/core/agent/demo/sessions';
import { FileSessionStore, MemorySessionStore, type SessionStore } from '@jinion/core/conversation/store';

const { version } = createRequire(import.meta.url)('../package.json') as { version: string };

const USAGE = `jinion ${version}

Usage: jinion [options]

Options:
  -c, --continue        Continue the last conversation in this directory
  -m, --model <model>   Claude model alias or id (or JINION_MODEL); /model's last pick, else opus
  -e, --effort <level>  Effort level, e.g. low, medium, high, xhigh, max (or JINION_EFFORT)
  --demo                Play the scripted demo instead of running Claude
  --debug               Log what goes to Claude Code and back to ~/.jinion/logs (or JINION_DEBUG=1)
  --theme <light|dark>  Skip background detection (or set JINION_THEME)
  -v, --version         Print the version
  -h, --help            Show this help`;

const { values } = parseArgs({
  options: {
    continue: { type: 'boolean', short: 'c' },
    model: { type: 'string', short: 'm' },
    effort: { type: 'string', short: 'e' },
    demo: { type: 'boolean' },
    debug: { type: 'boolean' },
    theme: { type: 'string' },
    version: { type: 'boolean', short: 'v' },
    help: { type: 'boolean', short: 'h' },
  },
});

if (values.help) {
  console.log(USAGE);
  process.exit(0);
}

if (values.version) {
  console.log(version);
  process.exit(0);
}

const theme = values.theme ?? process.env.JINION_THEME;

if (theme !== undefined && theme !== 'light' && theme !== 'dark') {
  console.error(`Unknown theme "${theme}". Use light or dark.`);
  process.exit(1);
}

// Package managers run scripts from the package directory; INIT_CWD is where the user invoked them.
const cwd = process.env.INIT_CWD ?? process.cwd();

const { mode } = loadProjectSettings(cwd);
const account = loadSettings().accounts?.Claude;
const memory = new MemoryStore(cwd);
const debug = values.debug || process.env.JINION_DEBUG === '1' ? new DebugLog() : undefined;

const backend: AgentBackend = values.demo
  ? new ScriptedBackend(scenarios, demoCommands)
  : new ClaudeBackend({ cwd, account, memory, mcp: new McpConfig(cwd), debug, syncSkills });

// Flags win over the choice `/model` saved in an earlier run.
const savedModel = loadSettings().models?.[backend.name];
const model = values.model ?? process.env.JINION_MODEL;
const effort = values.effort ?? process.env.JINION_EFFORT;
const selection: ModelSelection = model ? { model, effort } : { ...(savedModel ?? { model: backend.defaultModel }), ...(effort && { effort }) };

const saved: SessionStore = values.demo ? new MemorySessionStore(demoSessions()) : new FileSessionStore(cwd);
const initial = values.continue ? saved.list()[0] : undefined;
const farewells: string[] = [];

const info = {
  version,
  cwd,
  examples: values.demo ? ['add rate limiting to the api', 'hello'] : [],
};

const instance = await run(
  <App
    backend={backend}
    selection={selection}
    mode={mode}
    info={info}
    saved={saved}
    memory={memory}
    initial={initial}
    onExit={(message) => farewells.push(message)}
  />,
  { scheme: theme as ColorScheme | undefined },
);

await instance.waitUntilExit();
backend.close?.();
for (const message of farewells) console.log(message);
if (debug) console.log(`Debug log: ${debug.path}`);
