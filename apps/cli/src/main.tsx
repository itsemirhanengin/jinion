import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';
import { run, type ColorScheme } from '@jinion/tui';
import { ClaudeAgent } from './agent/claude/agent.js';
import { demoCommands } from './agent/demo/commands.js';
import { scenarios } from './agent/demo/scenarios/index.js';
import { ScriptedAgent } from './agent/demo/agent.js';
import type { Agent } from './agent/agent.js';
import { App } from './app/app.js';
import { DebugLog } from './lib/debug.js';
import { McpConfig } from './mcp/config.js';
import { MemoryStore } from './memory/store.js';
import { resumeOf } from './conversation/session.js';
import { loadProjectSettings } from './settings/project.js';
import { loadSettings } from './settings/user.js';
import { demoSessions } from './agent/demo/sessions.js';
import { FileSessionStore, MemorySessionStore, type SessionStore } from './conversation/store.js';

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

const agent: Agent = values.demo
  ? new ScriptedAgent(scenarios, demoCommands)
  : new ClaudeAgent({ cwd, mode, account, memory, mcp: new McpConfig(cwd), debug });

// Flags win over the choice `/model` saved in an earlier run.
const saved = loadSettings().models?.[agent.name];
const model = values.model ?? process.env.JINION_MODEL;
const effort = values.effort ?? process.env.JINION_EFFORT;

if (model) await agent.select({ model, effort });
else if (saved || effort) await agent.select({ ...(saved ?? agent.selection), ...(effort && { effort }) });

const sessions: SessionStore = values.demo ? new MemorySessionStore(demoSessions()) : new FileSessionStore(cwd);
const initial = values.continue ? sessions.list()[0] : undefined;
if (initial) agent.reset?.(resumeOf(initial));

const info = {
  version,
  cwd,
  examples: values.demo ? ['add rate limiting to the api', 'hello'] : [],
};

const instance = await run(<App agent={agent} info={info} sessions={sessions} memory={memory} initial={initial} />, {
  scheme: theme as ColorScheme | undefined,
});

await instance.waitUntilExit();
agent.close?.();
if (debug) console.log(`Debug log: ${debug.path}`);
