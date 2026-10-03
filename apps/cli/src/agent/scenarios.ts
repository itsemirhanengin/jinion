import type { QuestionAnswer, TodoGroup, TodoStatus } from '@jinion/tui';
import type { Scenario } from './scripted.js';
import type { AgentCommand } from './types.js';

export const demoCommands: AgentCommand[] = [
  { name: 'review', description: 'Review the current changes for bugs and risky patterns', source: 'skill', group: 'project' },
  { name: 'commit', description: 'Write a commit message for the staged changes', source: 'skill', group: 'user' },
  { name: 'explain', description: 'Explain how a piece of code works', source: 'skill', group: 'user', argumentHint: '<path>' },
  { name: 'pr-summary', description: 'Summarize a pull request', source: 'mcp', group: 'github', argumentHint: '<number>' },
  { name: 'create-issue', description: 'Turn this conversation into a Linear issue', source: 'mcp', group: 'Linear' },
];

const MENTIONED = new RegExp(`(?<=^|\\s)\\$(${demoCommands.map((command) => command.name).join('|')})(?=$|\\s)`, 'g');

const agentCommand: Scenario = {
  title: (prompt) => `Use ${[...prompt.matchAll(MENTIONED)].map((match) => match[0]).join(', ')}`,
  // Without the `g` flag, which would make `test` remember where it stopped.
  match: new RegExp(MENTIONED.source),
  async *play(script, prompt) {
    const commands = [...prompt.matchAll(MENTIONED)].map((match) => demoCommands.find((command) => command.name === match[1])!);
    const rest = prompt.replace(MENTIONED, '').replace(/\s+/g, ' ').trim();

    for (const command of commands) {
      const mcp = command.source === 'mcp';
      yield* script.think(
        mcp
          ? `The user picked the ${command.name} prompt from the ${command.group} MCP server. I will fetch it and follow what it returns.`
          : `The user picked the ${command.name} skill. I will load its instructions before doing anything.`,
      );
      yield* script.tool(
        'read',
        { files: [{ path: mcp ? `mcp://${command.group}/prompts/${command.name}` : `.claude/skills/${command.name}/SKILL.md` }] },
        {},
        500,
      );
    }
    yield* script.usage(1_100, 0.003);
    const names = commands.map((command) => `\`$${command.name}\``).join(' and ');
    yield* script.say(
      `This is the scripted demo agent, so ${names} ${commands.length > 1 ? 'stop' : 'stops'} here${rest ? ` (the rest of the message: \`${rest}\`)` : ''}. A real agent would now follow what it loaded.`,
    );
  },
};

const greeting: Scenario = {
  title: 'Say hello',
  match: /^\s*(hi|hello|hey|selam|merhaba|sa)\b/i,
  async *play(script) {
    yield* script.think('Just a greeting. No tools needed, so I will introduce myself and point at what this demo can show.');
    yield* script.usage(1_400, 0.004);
    yield* script.say(
      [
        "Hey! I'm **Jinion**, a coding agent that lives in your terminal.",
        'This build runs a scripted demo agent, so nothing touches your files yet. Ask me to `add rate limiting to the api` to watch the whole loop: reading code, asking you a question, editing files, running tests and recovering from a failing one.',
        '- `/` lists commands, skills and MCP prompts\n- the mouse wheel or `pgup`/`pgdn` scrolls the conversation\n- `ctrl+o` expands collapsed output\n- `esc` interrupts a running turn',
      ].join('\n\n'),
    );
  },
};

const RATE_LIMIT_FILE = `@@ -0,0 +1,29 @@
+import type { Middleware } from './index.js';
+import { TooManyRequests } from '../http/errors.js';
+
+export interface RateLimitOptions {
+  limit: number;
+  windowMs: number;
+  key?: (req: Request) => string;
+}
+
+export function rateLimit({ limit, windowMs, key = (req) => req.ip }: RateLimitOptions): Middleware {
+  const hits = new Map<string, { count: number; start: number }>();
+
+  return (req, res, next) => {
+    const id = key(req);
+    const now = Date.now();
+    const entry = hits.get(id);
+
+    if (!entry || now - entry.start > windowMs) {
+      hits.set(id, { count: 1, start: now });
+      return next();
+    }
+    if (entry.count >= limit) {
+      res.setHeader('Retry-After', Math.ceil((entry.start + windowMs - now) / 1000));
+      throw new TooManyRequests();
+    }
+    entry.count++;
+    next();
+  };
+}
`;

const SERVER_PATCH = `@@ -1,9 +1,10 @@
 import { createServer } from 'node:http';
 import { cors, errorHandler, requestId } from './middleware/index.js';
+import { rateLimit } from './middleware/rate-limit.js';
 import { router } from './routes/index.js';

 const app = createServer();

-app.use(requestId(), cors());
+app.use(requestId(), cors(), rateLimit({ limit: 100, windowMs: 60_000 }));
 app.use('/api', router);
 app.use(errorHandler());
`;

const AUTH_PATCH = `@@ -1,3 +1,4 @@
 import { Router } from '../http/router.js';
+import { rateLimit } from '../middleware/rate-limit.js';
 import { login, logout, refresh } from './auth.handlers.js';

@@ -39,4 +40,3 @@
 export const auth = Router();

-// TODO: throttle repeated logins, respond 429
-auth.post('/login', login);
+auth.post('/login', rateLimit({ limit: 5, windowMs: 15 * 60_000 }), login);
`;

const TEST_FILE = `@@ -0,0 +1,28 @@
+import { describe, expect, it, vi } from 'vitest';
+import { invoke } from '../../test/http.js';
+import { rateLimit } from './rate-limit.js';
+
+describe('rateLimit', () => {
+  const limiter = () => rateLimit({ limit: 2, windowMs: 1_000 });
+
+  it('allows requests under the limit', async () => {
+    const run = invoke(limiter());
+    expect((await run()).status).toBe(200);
+    expect((await run()).status).toBe(200);
+  });
+
+  it('rejects the request over the limit with 429', async () => {
+    const run = invoke(limiter());
+    await run();
+    await run();
+    expect((await run()).status).toBe(429);
+  });
+
+  it('resets the window after it elapses', async () => {
+    vi.useFakeTimers();
+    const run = invoke(limiter());
+    await run();
+    await run();
+    vi.advanceTimersByTime(1_000);
+    expect((await run()).status).toBe(200);
+  });
+});
`;

const BOUNDARY_FIX = `@@ -15,7 +15,7 @@
     const now = Date.now();
     const entry = hits.get(id);

-    if (!entry || now - entry.start > windowMs) {
+    if (!entry || now - entry.start >= windowMs) {
       hits.set(id, { count: 1, start: now });
       return next();
     }
`;

const FAILING_RUN = [
  ' RUN  v4.1.2 /Users/dev/acme-api',
  '',
  ' ❯ src/middleware/rate-limit.test.ts (3 tests | 1 failed) 21ms',
  '   ✓ rateLimit > allows requests under the limit 3ms',
  '   ✓ rateLimit > rejects the request over the limit with 429 1ms',
  '   × rateLimit > resets the window after it elapses 4ms',
  '     → expected 429 to be 200 // Object.is equality',
  '',
  ' FAIL  src/middleware/rate-limit.test.ts > rateLimit > resets the window after it elapses',
  'AssertionError: expected 429 to be 200 // Object.is equality',
  ' ❯ src/middleware/rate-limit.test.ts:27:34',
  '     26|     vi.advanceTimersByTime(1_000);',
  '     27|     expect((await run()).status).toBe(200);',
  '       |                                  ^',
  '',
  ' Test Files  1 failed (1)',
  '      Tests  1 failed | 2 passed (3)',
  '   Duration  402ms',
];

const PASSING_RUN = [
  ' RUN  v4.1.2 /Users/dev/acme-api',
  '',
  ' ✓ src/middleware/rate-limit.test.ts (3 tests) 9ms',
  '',
  ' Test Files  1 passed (1)',
  '      Tests  3 passed (3)',
  '   Duration  388ms',
];

const FULL_SUITE = [
  ' RUN  v4.1.2 /Users/dev/acme-api',
  '',
  ' ✓ src/http/errors.test.ts (4 tests) 3ms',
  ' ✓ src/middleware/cors.test.ts (5 tests) 6ms',
  ' ✓ src/middleware/request-id.test.ts (3 tests) 2ms',
  ' ✓ src/middleware/rate-limit.test.ts (3 tests) 9ms',
  ' ✓ src/routes/auth.test.ts (11 tests) 48ms',
  ' ✓ src/routes/users.test.ts (14 tests) 61ms',
  ' ✓ src/routes/health.test.ts (2 tests) 4ms',
  ' ✓ src/server.test.ts (6 tests) 33ms',
  '',
  ' Test Files  8 passed (8)',
  '      Tests  48 passed (48)',
  '   Start at  14:02:11',
  '   Duration  1.21s',
];

const TYPECHECK_RUN = ['> acme-api@1.4.0 typecheck', '> tsc --noEmit'];

const LINT_RUN = ['> acme-api@1.4.0 lint', '> eslint .', '', 'No problems found.'];

/** The checks the user can pick after the change, each with its command and output. */
const CHECKS = [
  { label: 'The full test suite', description: 'pnpm test, about 2s', command: 'pnpm test 2>&1 | tail -n 15' },
  { label: 'Typecheck', description: 'pnpm typecheck', command: 'pnpm typecheck' },
  { label: 'Lint', description: 'pnpm lint', command: 'pnpm lint' },
];

const STORAGE_NOTES = [
  'Counters live in an in-process `Map`. A restart resets them, which is fine while the API runs as a single instance.',
  'You picked Redis, but this repo has no Redis client yet, so the limiter ships with the in-memory store for now. Adding a Redis-backed store is the natural next step once `REDIS_URL` is provisioned.',
  'Counters sit behind the in-memory `Map` today, and the `key` option plus a small store seam leave room for a Redis store later without touching the middleware.',
];

function storageNote(answer: QuestionAnswer | undefined) {
  const choice =
    answer?.text
      ? `You asked for "${answer.text}". This demo still ships the in-memory store; wiring that in is the next step.`
      : STORAGE_NOTES[answer?.options[0] ?? 0];
  return answer?.note ? `${choice} Your note is tracked as a follow-up: "${answer.note}".` : choice;
}

type Plan = [title: string, items: [text: string, status: TodoStatus][]][];

function todos(plan: Plan): TodoGroup[] {
  return plan.map(([title, items]) => ({ title, items: items.map(([text, status]) => ({ text, status })) }));
}

function plan(build: [TodoStatus, TodoStatus], verify: [TodoStatus, TodoStatus]): TodoGroup[] {
  return todos([
    [
      'Design',
      [
        ['Map the middleware chain', 'done'],
        ['Agree on storage and scope', 'done'],
      ],
    ],
    [
      'Build',
      [
        ['Write the limiter middleware', build[0]],
        ['Wire it into the server and routes', build[1]],
      ],
    ],
    [
      'Verification',
      [
        ['Unit test the limiter', verify[0]],
        ['Run the full test suite', verify[1]],
      ],
    ],
  ]);
}

const rateLimiting: Scenario = {
  title: 'Add rate limiting to the public API',
  async *play(script) {
    yield* script.think(
      'The user wants rate limiting on the public API. Before adding anything I need to know how requests flow: where the server is created, whether there is a middleware chain, and whether something like a limiter already exists so I do not build a second one.',
    );
    yield* script.usage(3_200, 0.011);
    yield* script.agent('Map how a request reaches a route', [
      { call: { name: 'glob', input: { pattern: 'src/**/*.ts' } }, result: { files: Array.from({ length: 41 }, (_, index) => `src/file-${index}.ts`) } },
      {
        call: { name: 'grep', input: { pattern: 'app.use', path: 'src' } },
        result: { matches: [{ file: 'src/server.ts', line: 12, text: 'app.use(requestId());' }, { file: 'src/server.ts', line: 13, text: 'app.use(cors());' }] },
      },
      { call: { name: 'read', input: { files: [{ path: 'src/server.ts' }] } }, result: {} },
    ]);
    yield* script.tool('read', { files: [{ path: 'src/server.ts' }, { path: 'src/middleware/index.ts' }] }, {}, 700);
    yield* script.tool(
      'grep',
      { pattern: 'rateLimit|throttle|429', path: 'src' },
      {
        matches: [
          { file: 'src/routes/auth.ts', line: 41, text: '// TODO: throttle repeated logins, respond 429' },
          { file: 'src/http/errors.ts', line: 18, text: 'export class TooManyRequests extends HttpError {' },
        ],
      },
      500,
    );
    yield* script.tool(
      'glob',
      { pattern: 'src/middleware/*.ts' },
      {
        files: [
          'src/middleware/index.ts',
          'src/middleware/cors.ts',
          'src/middleware/request-id.ts',
          'src/middleware/error-handler.ts',
        ],
      },
      400,
    );
    yield* script.usage(5_800, 0.019);

    yield* script.think(
      [
        'No limiter exists yet. There is a TODO in the login route and a `TooManyRequests` error already defined in src/http/errors.ts, which I can reuse instead of hand-rolling a 429.',
        'Middleware are plain (req, res, next) functions composed in src/server.ts, so a limiter fits in as one more entry. The real decision is storage: a Map is enough for one process, but behind a load balancer every instance would count separately. I will ask instead of guessing.',
      ].join('\n\n'),
    );

    const [storage, scope, checks] = yield* script.ask([
      {
        id: 'storage',
        prompt: 'Where should the limiter keep its counters?',
        options: [
          { label: 'In-memory', description: 'single process, zero dependencies' },
          { label: 'Redis', description: 'shared across instances, needs REDIS_URL' },
          { label: 'In-memory behind a store seam', description: 'Redis can be added later' },
        ],
      },
      {
        id: 'scope',
        prompt: 'Which routes should be limited?',
        options: [
          { label: '/api plus a stricter /auth/login', description: '5 attempts per 15 minutes on login', recommended: true },
          { label: 'Everything under /api', description: 'one shared budget' },
        ],
      },
      {
        id: 'checks',
        prompt: 'Which checks should run when the change is in?',
        multiple: true,
        options: CHECKS.map(({ label, description }) => ({ label, description })),
      },
    ]);
    const picked = (checks?.options ?? [0]).map((index) => CHECKS[index]!);
    const strictLogin = scope?.options[0] !== 1;

    yield* script.think(
      'Plan: a small fixed-window limiter keyed by client IP, reusing TooManyRequests, mounted globally before the router' +
        (strictLogin ? ', plus a tighter budget on POST /auth/login.' : '.') +
        ` Then a focused unit test, then ${picked.map((check) => check.label.toLowerCase()).join(', ')}.`,
    );
    yield* script.tool('todo', { groups: plan(['active', 'pending'], ['pending', 'pending']) }, {}, 250);

    yield* script.tool('edit', { path: 'src/middleware/rate-limit.ts', patch: RATE_LIMIT_FILE, created: true }, {}, 900);
    yield* script.usage(4_100, 0.016);
    yield* script.tool('todo', { groups: plan(['done', 'active'], ['pending', 'pending']) }, {}, 200);

    yield* script.tool('edit', { path: 'src/server.ts', patch: SERVER_PATCH }, {}, 700);
    if (strictLogin) yield* script.tool('edit', { path: 'src/routes/auth.ts', patch: AUTH_PATCH }, {}, 700);
    yield* script.tool('todo', { groups: plan(['done', 'done'], ['active', 'pending']) }, {}, 200);

    yield* script.tool('edit', { path: 'src/middleware/rate-limit.test.ts', patch: TEST_FILE, created: true }, {}, 800);
    yield* script.bash('pnpm vitest run src/middleware/rate-limit.test.ts', FAILING_RUN, {
      exitCode: 1,
      durationMs: 1_600,
    });
    yield* script.usage(6_300, 0.024);

    yield* script.think(
      'The reset test fails at the boundary. The window check uses `>` against the start timestamp, and fake timers advance exactly windowMs, so a request landing on the boundary still counts toward the old window. It should be `>=`.',
    );
    yield* script.tool('edit', { path: 'src/middleware/rate-limit.ts', patch: BOUNDARY_FIX }, {}, 600);
    yield* script.bash('pnpm vitest run src/middleware/rate-limit.test.ts', PASSING_RUN, { durationMs: 1_200 });
    yield* script.tool('todo', { groups: plan(['done', 'done'], ['done', 'active']) }, {}, 200);

    for (const check of picked) {
      const output = check === CHECKS[0] ? FULL_SUITE : check === CHECKS[1] ? TYPECHECK_RUN : LINT_RUN;
      yield* script.bash(check.command, output, { durationMs: check === CHECKS[0] ? 2_400 : 1_000 });
    }
    yield* script.tool('todo', { groups: plan(['done', 'done'], ['done', 'done']) }, {}, 200);
    yield* script.usage(2_900, 0.013);

    const rows = ['| `/api/*` | 100 | 1 min |', ...(strictLogin ? ['| `POST /auth/login` | 5 | 15 min |'] : [])];

    yield* script.say(
      [
        `Rate limiting is in. Every request under \`/api\` now goes through a fixed-window limiter${strictLogin ? ', and login gets its own stricter budget' : ''}.`,
        '## What changed',
        [
          '1. **Limiter.** `src/middleware/rate-limit.ts` counts requests per client in a fixed window and answers `429` with a `Retry-After` header, reusing the existing `TooManyRequests` error.',
          `2. **Wiring.** \`src/server.ts\` mounts it before the router, so rejected requests never reach a handler.${strictLogin ? ' `src/routes/auth.ts` replaces the old TODO with a 5 per 15 minutes budget on login.' : ''}`,
          `3. **Storage.** ${storageNote(storage)}`,
        ].join('\n'),
        ['| Route | Limit | Window |', '| --- | ---: | --- |', ...rows].join('\n'),
        '## Verification',
        [
          '- `pnpm vitest run src/middleware/rate-limit.test.ts`: 3/3 passing. The first run caught an off-by-one at the window boundary (`>` instead of `>=`), now fixed.',
          ...picked.map((check) =>
            check === CHECKS[0]
              ? '- `pnpm test`: 48 passing, no regressions.'
              : check === CHECKS[1]
                ? '- `pnpm typecheck`: clean.'
                : '- `pnpm lint`: no problems.',
          ),
        ].join('\n'),
        'One thing left open: clients are keyed by IP, so users behind a shared NAT share a budget. Keying authenticated requests by user id would fix that.',
      ].join('\n\n'),
    );
  },
};

export const scenarios: Scenario[] = [agentCommand, greeting, rateLimiting];
