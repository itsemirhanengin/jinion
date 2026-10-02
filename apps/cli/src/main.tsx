#!/usr/bin/env node
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { parseArgs } from 'node:util';
import { run, type ColorScheme } from '@jinion/tui';
import { ClaudeAgent } from './agent/claude/agent.js';
import { demoCommands, scenarios } from './agent/scenarios.js';
import { ScriptedAgent } from './agent/scripted.js';
import type { Agent } from './agent/types.js';
import { App } from './app.js';
import { demoSessions, MemorySessionStore } from './session-store.js';

const { version } = createRequire(import.meta.url)('../package.json') as { version: string };

const USAGE = `jinion ${version}

Usage: jinion [options]

Options:
  -m, --model <model>   Claude model alias or id (default: opus, or set JINION_MODEL)
  --demo                Play the scripted demo instead of running Claude
  --theme <light|dark>  Skip background detection (or set JINION_THEME)
  -v, --version         Print the version
  -h, --help            Show this help`;

const { values } = parseArgs({
  options: {
    model: { type: 'string', short: 'm' },
    demo: { type: 'boolean' },
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
const model = values.model ?? process.env.JINION_MODEL ?? 'opus';

const agent: Agent = values.demo ? new ScriptedAgent(scenarios, demoCommands) : new ClaudeAgent({ cwd, model });
const sessions = new MemorySessionStore(values.demo ? demoSessions() : []);

const info = {
  version,
  model: agent.model,
  cwd: cwd.replace(homedir(), '~'),
  examples: values.demo ? ['add rate limiting to the api', 'hello'] : [],
};

const instance = await run(<App agent={agent} info={info} sessions={sessions} />, {
  scheme: theme as ColorScheme | undefined,
});
await instance.waitUntilExit();
agent.close?.();
