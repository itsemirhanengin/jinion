import type { QuestionAnswer, TodoGroup, TodoStatus } from '@jinion/tui/chat';
import type { Scenario } from '../types.js';
import {
  AUTH_PATCH,
  BOUNDARY_FIX,
  FAILING_RUN,
  FULL_SUITE,
  LINT_RUN,
  PASSING_RUN,
  RATE_LIMIT_FILE,
  SERVER_PATCH,
  TEST_FILE,
  TYPECHECK_RUN,
} from './acme-api.js';

const CHECKS = [
  {
    label: 'The full test suite',
    description: 'pnpm test, about 2s',
    command: 'pnpm test 2>&1 | tail -n 15',
    output: FULL_SUITE,
    durationMs: 2_400,
    verified: '- `pnpm test`: 48 passing, no regressions.',
  },
  {
    label: 'Typecheck',
    description: 'pnpm typecheck',
    command: 'pnpm typecheck',
    output: TYPECHECK_RUN,
    durationMs: 1_000,
    verified: '- `pnpm typecheck`: clean.',
  },
  { label: 'Lint', description: 'pnpm lint', command: 'pnpm lint', output: LINT_RUN, durationMs: 1_000, verified: '- `pnpm lint`: no problems.' },
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

export const rateLimiting: Scenario = {
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

    for (const check of picked) yield* script.bash(check.command, check.output, { durationMs: check.durationMs });
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
          ...picked.map((check) => check.verified),
        ].join('\n'),
        'One thing left open: clients are keyed by IP, so users behind a shared NAT share a budget. Keying authenticated requests by user id would fix that.',
      ].join('\n\n'),
    );
  },
};
