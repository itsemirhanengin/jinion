import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';
import { run, type ColorScheme } from '@jinion/tui';
import { findServer } from '@jinion/core/api/server-file';
import { connectWebSocket } from '@jinion/core/api/websocket';
import { App } from './app/app.js';
import { coreOptions, startCore } from './host.js';
import { serve } from './serve.js';

const { version } = createRequire(import.meta.url)('../package.json') as { version: string };

const USAGE = `jinion ${version}

Usage: jinion [options]
       jinion serve [--port <port>] [--stdio] [--origin <origin>]...

Options:
  -c, --continue        Continue the last conversation in this directory
  -m, --model <model>   Claude model alias or id (or JINION_MODEL); /model's last pick, else opus
  -e, --effort <level>  Effort level, e.g. low, medium, high, xhigh, max (or JINION_EFFORT)
  --attach              Show the conversations of the jinion serve running for this directory
  --demo                Play the scripted demo instead of running Claude
  --debug               Log what goes to Claude Code and back to ~/.jinion/logs (or JINION_DEBUG=1)
  --theme <light|dark>  Skip background detection (or set JINION_THEME)
  -v, --version         Print the version
  -h, --help            Show this help

jinion serve runs jinion without a screen, for other apps to drive over its API: on a WebSocket on this
machine, with a token only you can read, or over stdin and stdout with --stdio.
  --port <port>         The port to serve on; a free one when left out
  --stdio               Serve the process that started this one, over stdin and stdout
  --origin <origin>     A web page let in, e.g. a desktop app's; repeat for several`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    continue: { type: 'boolean', short: 'c' },
    model: { type: 'string', short: 'm' },
    effort: { type: 'string', short: 'e' },
    attach: { type: 'boolean' },
    demo: { type: 'boolean' },
    debug: { type: 'boolean' },
    theme: { type: 'string' },
    port: { type: 'string' },
    stdio: { type: 'boolean' },
    origin: { type: 'string', multiple: true },
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

const [command, ...rest] = positionals;

if ((command !== undefined && command !== 'serve') || rest.length > 0) fail(`Unknown command "${positionals.join(' ')}". jinion --help lists what there is.`);

const theme = values.theme ?? process.env.JINION_THEME;

if (theme !== undefined && theme !== 'light' && theme !== 'dark') fail(`Unknown theme "${theme}". Use light or dark.`);

const port = values.port === undefined ? undefined : Number(values.port);

if (port !== undefined && !(Number.isInteger(port) && port >= 0 && port < 65_536)) fail(`"${values.port}" is no port. Use a number up to 65535.`);

// Package managers run scripts from the package directory; INIT_CWD is where the user invoked them.
const cwd = process.env.INIT_CWD ?? process.cwd();
const scheme = theme as ColorScheme | undefined;

if (values.attach) {
  const server = findServer(cwd);

  if (!server) fail('No jinion serve runs for this directory. Start one with jinion serve.');

  let lost = false;
  const instance = await run(<App connect={() => connectWebSocket(server.url, server.token)} version={version} attached onLost={() => (lost = true)} />, { scheme });

  await instance.waitUntilExit();
  if (lost) console.log(`The connection to jinion serve at ${server.url} closed.`);
  process.exit(0);
}

const { options, debug, farewells } = coreOptions({
  cwd,
  version,
  demo: values.demo,
  model: values.model ?? process.env.JINION_MODEL,
  effort: values.effort ?? process.env.JINION_EFFORT,
  debug: values.debug || process.env.JINION_DEBUG === '1',
  continue: values.continue,
});

const core = startCore(options);

core.server.app.start();

if (command === 'serve') {
  await serve(core.server, { cwd, version, port, stdio: values.stdio, origins: values.origin });
  for (const backend of options.backends) backend.close?.();
  for (const message of farewells) console.error(message);
  process.exit(0);
}

const instance = await run(<App connect={core.connect} version={version} />, { scheme });

await instance.waitUntilExit();
for (const backend of options.backends) backend.close?.();
for (const message of farewells) console.log(message);
if (debug) console.log(`Debug log: ${debug.path}`);

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
