import type { TodoGroup, TodoStatus } from '@jinion/core/agent/todos';
import { SERVER } from './files.js';
import type { Scenario, Script } from './script.js';

/** Tried in order; the last has no pattern and answers anything else. */
export const scenarios: Scenario[] = [
  { match: /^\s*(hi|hello|hey|selam|merhaba)\b/i, play: greeting },
  { match: /rate|limit|throttl/i, play: rateLimiting },
  { match: /test|flaky|fail|fix|bug|hata/i, play: flakyTest },
  { match: /dev server|start|run the app|çalıştır|başlat/i, play: devServer },
  { match: /explain|how does|how do|what is|queue|anlat|nasıl/i, play: explainQueue },
  { play: fallback },
];

export const suggestions = ['Add rate limiting to the API', 'Fix the flaky session test', 'Explain how the job queue works', 'Start the dev server'];

export function scenarioFor(prompt: string) {
  return scenarios.find((scenario) => !scenario.match || scenario.match.test(prompt))!;
}

/** In Plan, any request gets a plan rather than changes. */
export async function plan(script: Script, prompt: string) {
  await script.think(`Plan mode: I read what I need and write a plan for "${prompt}", changing nothing.`);
  await script.read('README.md', 'src/server.ts');
  await script.glob('src/**/*.ts', ['src/server.ts', 'src/routes.ts', 'src/routes/auth.ts', 'src/routes/orders.ts', 'src/jobs/queue.ts']);

  await script.say(
    [
      'Here is how I would go about it:',
      '1. **Find where it belongs.** Requests come in through `src/server.ts`, which mounts every route under `/api`.',
      '2. **Make the change** in one small module, reusing what is there (`HttpError` for errors).',
      '3. **Test it** with a focused test next to it, then run `pnpm test` and `pnpm typecheck`.',
      'Nothing is changed yet. Switch to Accept edits and send it again to build it.',
    ].join('\n\n'),
  );
}

async function greeting(script: Script) {
  await script.wait(400);

  await script.say(
    "Hi! I'm working in **acme-api**. This window runs on sample data for now, so try one of these to see how a turn looks:\n\n- Add rate limiting to the API\n- Fix the flaky session test\n- Explain how the job queue works\n- Start the dev server",
  );
}

async function fallback(script: Script, prompt: string) {
  await script.think(`The request: "${prompt}". This is the desktop app's sample data, so there is no real agent behind it yet.`);
  await script.glob('src/**/*.ts', ['src/server.ts', 'src/routes.ts', 'src/routes/auth.ts', 'src/jobs/queue.ts']);

  await script.say(
    "This window runs on sample data, so I can only play a few scripted turns for now. These show the most:\n\n- **Add rate limiting to the API**: a subagent, edits, a test run and todos\n- **Fix the flaky session test**: a failing run, a fix and a permission to answer\n- **Explain how the job queue works**: reading the code and explaining it\n- **Start the dev server**: a command that goes on in the background",
  );
}

async function rateLimiting(script: Script) {
  await script.think(
    'They want rate limiting on the public API. First I need to know how a request reaches a route, and whether something already limits or throttles, so I do not build a second one.',
  );

  await script.say("I'll map how requests flow first.");

  await script.agent('Map how a request reaches a route', [
    { call: { name: 'glob', input: { pattern: 'src/**/*.ts' } }, result: { files: ['src/server.ts', 'src/routes.ts', 'src/routes/auth.ts', 'src/routes/orders.ts'] } },
    {
      call: { name: 'grep', input: { pattern: 'app.use', path: 'src' } },
      result: { matches: [{ file: 'src/server.ts', line: 8, text: 'app.use(requestId());' }] },
    },
    { call: { name: 'read', input: { files: [{ path: 'src/server.ts' }] } }, result: {} },
  ]);

  await script.read('src/server.ts', 'src/http/errors.ts');

  await script.grep('rateLimit|throttle|429', 'src', [
    { file: 'src/routes/auth.ts', line: 6, text: '// TODO: throttle repeated logins, respond 429' },
    { file: 'src/http/errors.ts', line: 7, text: 'export class TooManyRequests extends HttpError {' },
  ]);

  await script.think(
    'Nothing limits requests yet, and `TooManyRequests` already exists in src/http/errors.ts, so the limiter can throw it. One instance in production, so a Map is enough.',
  );

  await script.todo(limiterTodos('active', 'pending', 'pending'));
  await script.edit('src/middleware/rate-limit.ts', RATE_LIMIT_PATCH, RATE_LIMIT, true);
  await script.todo(limiterTodos('done', 'active', 'pending'));
  await script.edit('src/server.ts', SERVER_PATCH, SERVER_WITH_LIMIT);
  await script.todo(limiterTodos('done', 'done', 'active'));
  await script.bash('pnpm test', ['', ' ✓ tests/auth.test.ts (1)', ' ✓ tests/rate-limit.test.ts (3)', '', ' Test Files  2 passed (2)', '      Tests  4 passed (4)'], { ms: 1800 });
  await script.todo(limiterTodos('done', 'done', 'done'));

  await script.say(
    [
      'Requests to `/api` are now limited to **100 a minute for each API key**, or each IP when a request has none.',
      '1. `src/middleware/rate-limit.ts` counts requests in a fixed one-minute window and throws the existing `TooManyRequests`, so the answer is a `429` with a `Retry-After` header.',
      '2. `src/server.ts` mounts it before the routes, so a rejected request never reaches a handler.',
      'The counts live in memory and reset on a restart, which fits a single instance. When a second one comes, a Redis store is the next step.',
    ].join('\n\n'),
  );
}

function limiterTodos(write: TodoStatus, wire: TodoStatus, test: TodoStatus): TodoGroup[] {
  return [
    {
      title: 'Build',
      items: [
        { text: 'Write the limiter middleware', status: write },
        { text: 'Mount it before the routes', status: wire },
      ],
    },
    { title: 'Verification', items: [{ text: 'Run the tests', status: test }] },
  ];
}

async function flakyTest(script: Script) {
  await script.think('A flaky test usually waits on real time. I will run it first to see how it fails.');
  await script.bash('pnpm vitest run tests/auth.test.ts', FAILING_RUN, { exitCode: 1, ms: 1600 });

  await script.think(
    'The test waits 10ms with a real timer, then expects exactly an hour left. On a slow machine more than a millisecond passes, so it fails now and then. Fake timers make the time exact.',
  );

  await script.read('tests/auth.test.ts');
  await script.edit('tests/auth.test.ts', TEST_PATCH, FIXED_TEST);

  const answer = await script.approve({
    title: 'Run the test 20 times?',
    command: 'pnpm vitest run tests/auth.test.ts --repeat 20',
    description: 'To be sure the flake is gone, not just lucky once.',
    always: '`pnpm vitest run:*` in this project',
  });

  if (!answer.allow) {
    await script.say(
      answer.note
        ? `Understood: ${answer.note}. The fix is in \`tests/auth.test.ts\`; I didn't run anything.`
        : "Okay, I didn't run it. The fix is in `tests/auth.test.ts`: the test uses fake timers now, so it no longer depends on how fast the machine is.",
    );

    return;
  }

  await script.bash('pnpm vitest run tests/auth.test.ts --repeat 20', PASSING_RUN, { ms: 2400 });

  await script.say(
    'The test passed 20 times in a row. It waited on a real 10ms timer and expected the time left to the millisecond, so a slow run failed it. It uses fake timers now, which makes the time exact.',
  );
}

async function devServer(script: Script) {
  await script.read('package.json');
  await script.background('pnpm dev', ['> acme-api@ dev', '> tsx watch src/server.ts', '', 'Listening on http://localhost:3000']);

  await script.say(
    'The dev server runs in the background on http://localhost:3000. Its output is in the side panel under Tasks, where you can stop it.',
  );
}

async function explainQueue(script: Script) {
  await script.read('src/jobs/queue.ts');
  await script.grep('enqueue\\(', 'src', [{ file: 'src/routes/orders.ts', line: 14, text: "enqueue({ name: 'order-email', run: () => sendOrderEmail(order) });" }]);

  await script.say(
    [
      'The queue in `src/jobs/queue.ts` is small and in memory:',
      '- `enqueue` adds a job and starts `drain` if it isn\'t running.',
      '- `drain` takes jobs **one at a time, in order**, and awaits each.',
      '- A job that throws goes to the back of the line, and is tried **twice more** before it is dropped.',
      '```ts\nif (job.attempts < 2) pending.push({ ...job, attempts: job.attempts + 1 });\n```',
      'Two things to know: jobs are lost when the server restarts, and a slow job holds up every job behind it. Order emails are the only job today (`src/routes/orders.ts`).',
    ].join('\n\n'),
  );
}

const RATE_LIMIT = `import type { RequestHandler } from 'express';
import { TooManyRequests } from '../http/errors.js';

const WINDOW_MS = 60_000;
const LIMIT = 100;
const hits = new Map<string, { count: number; resetAt: number }>();

export const rateLimit = (): RequestHandler => (req, res, next) => {
  const key = req.header('x-api-key') ?? req.ip ?? 'anonymous';
  const now = Date.now();
  const entry = hits.get(key);

  if (!entry || entry.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });

    return next();
  }

  if (entry.count >= LIMIT) {
    res.setHeader('retry-after', Math.ceil((entry.resetAt - now) / 1000));

    throw new TooManyRequests();
  }

  entry.count += 1;
  next();
};
`;

const RATE_LIMIT_PATCH = `@@ -0,0 +1,27 @@\n${RATE_LIMIT.trimEnd()
  .split('\n')
  .map((line) => `+${line}`)
  .join('\n')}`;

const SERVER_WITH_LIMIT = SERVER.replace(
  "import { cors } from './middleware/cors.js';",
  "import { cors } from './middleware/cors.js';\nimport { rateLimit } from './middleware/rate-limit.js';",
).replace("app.use('/api', routes);", "app.use('/api', rateLimit(), routes);");

const SERVER_PATCH = `@@ -1,12 +1,13 @@
 import express from 'express';
 import { cors } from './middleware/cors.js';
+import { rateLimit } from './middleware/rate-limit.js';
 import { requestId } from './middleware/request-id.js';
 import { routes } from './routes.js';

 const app = express();

 app.use(express.json());
 app.use(requestId());
 app.use(cors());
-app.use('/api', routes);
+app.use('/api', rateLimit(), routes);`;

const FIXED_TEST = `import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSession } from '../src/accounts.js';

describe('sessions', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('expire after an hour', async () => {
    const session = await createSession({ id: 'a1' });

    await vi.advanceTimersByTimeAsync(10);
    expect(session.expiresAt - Date.now()).toBe(60 * 60 * 1000 - 10);
  });
});
`;

const TEST_PATCH = `@@ -1,10 +1,13 @@
-import { describe, expect, it, vi } from 'vitest';
+import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
 import { createSession } from '../src/accounts.js';

 describe('sessions', () => {
+  beforeEach(() => vi.useFakeTimers());
+  afterEach(() => vi.useRealTimers());
+
   it('expire after an hour', async () => {
     const session = await createSession({ id: 'a1' });

-    await new Promise((resolve) => setTimeout(resolve, 10));
-    expect(session.expiresAt - Date.now()).toBe(60 * 60 * 1000);
+    await vi.advanceTimersByTimeAsync(10);
+    expect(session.expiresAt - Date.now()).toBe(60 * 60 * 1000 - 10);
   });`;

const FAILING_RUN = [
  '',
  ' ❯ tests/auth.test.ts (1)',
  '   × sessions > expire after an hour',
  '',
  ' FAIL  tests/auth.test.ts > sessions > expire after an hour',
  'AssertionError: expected 3599988 to be 3600000',
  '',
  ' Test Files  1 failed (1)',
  '      Tests  1 failed (1)',
];

const PASSING_RUN = ['', ' ✓ tests/auth.test.ts (20)', '', ' Test Files  1 passed (1)', '      Tests  20 passed (20)'];
