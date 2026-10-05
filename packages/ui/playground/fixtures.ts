import type { Status } from '@jinion/ui';
import type { DiffLine, TodoGroup } from '@jinion/ui/chat';

export const project = 'acme-api';

export const threads: { title: string; status: Status; age: string }[] = [
  { title: 'Rate limiting for the API', status: 'working', age: '25s' },
  { title: 'Upgrade to Express 5', status: 'waiting', age: '3m' },
  { title: 'Fix the flaky auth tests', status: 'done', age: '4m' },
  { title: 'Pagination on /orders', status: 'idle', age: '1h' },
  { title: 'Explain the job queue', status: 'idle', age: '1h' },
  { title: 'Move the config to zod', status: 'done', age: '2h' },
  { title: 'Error handling middleware', status: 'idle', age: '1mo' },
];

export const tabs = [
  { title: 'Rate limiting for the API', status: 'working' as const, added: 27, removed: 1 },
  { title: 'Upgrade to Express 5', status: 'waiting' as const, added: 0, removed: 0 },
  { title: 'Fix the flaky auth tests', status: 'done' as const, added: 12, removed: 4 },
  { title: 'New thread', badge: 'New' },
];

export const prompt = `Add rate limiting to the API: 100 requests a minute for each API key, and a clear error when someone hits it.
Don't add Redis yet, we run a single instance for now.`;

export const firstThought =
  'Every route is mounted under /api in src/server.ts. There is no middleware folder yet, and package.json has no Redis, which matches what they asked. A fixed window per API key, kept in memory, is enough for one instance.';

export const explored = [
  { label: 'Read', detail: 'src/server.ts' },
  { label: 'Read', detail: 'src/routes.ts' },
  { label: 'Searched', detail: '"rate" in src' },
  { label: 'Read', detail: 'package.json' },
];

export const rateLimitFile: DiffLine[] = [
  "import type { NextFunction, Request, Response } from 'express';",
  '',
  'const WINDOW_MS = 60_000;',
  'const LIMIT = 100;',
  'const hits = new Map<string, { count: number; resetAt: number }>();',
  '',
  'export function rateLimit(request: Request, response: Response, next: NextFunction) {',
  "  const key = request.header('x-api-key') ?? request.ip ?? 'anonymous';",
  '  const now = Date.now();',
  '  const entry = hits.get(key);',
  '',
  '  if (!entry || entry.resetAt <= now) {',
  '    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });',
  '',
  '    return next();',
  '  }',
  '',
  '  if (entry.count >= LIMIT) {',
  "    response.setHeader('retry-after', Math.ceil((entry.resetAt - now) / 1000));",
  '',
  "    return response.status(429).json({ error: 'Too many requests. Try again in a minute.' });",
  '  }',
  '',
  '  entry.count += 1;',
  '  next();',
  '}',
].map((text) => ({ kind: 'added' as const, text }));

export const serverFile: DiffLine[] = [
  { kind: 'context', text: "import express from 'express';" },
  { kind: 'added', text: "import { rateLimit } from './middleware/rate-limit.js';" },
  { kind: 'context', text: "import { routes } from './routes.js';" },
  { kind: 'context', text: '' },
  { kind: 'context', text: 'const app = express();' },
  { kind: 'context', text: '' },
  { kind: 'context', text: 'app.use(express.json());' },
  { kind: 'removed', text: "app.use('/api', routes);" },
  { kind: 'added', text: "app.use('/api', rateLimit, routes);" },
];

export const todos: TodoGroup[] = [
  {
    title: 'Build',
    items: [
      { text: 'Read how the routes are mounted', status: 'done' },
      { text: 'Write the rate limit middleware', status: 'done' },
      { text: 'Put it in front of /api', status: 'done' },
    ],
  },
  {
    title: 'Verification',
    items: [
      { text: 'Add a test for the 429', status: 'done' },
      { text: 'Run the tests', status: 'done' },
    ],
  },
];

export const runningTodos: TodoGroup[] = [
  { ...todos[0]!, items: todos[0]!.items.map((item, index) => ({ ...item, status: index < 2 ? 'done' : 'active' })) },
  { ...todos[1]!, items: todos[1]!.items.map((item) => ({ ...item, status: 'pending' })) },
];

export const summary = `Requests to \`/api\` are now limited to **100 a minute for each API key**, or for each IP when a request has no key.

1. \`src/middleware/rate-limit.ts\` counts requests in a fixed one-minute window.
2. Past the limit it answers \`429\` with a \`Retry-After\` header and a short error.
3. \`src/server.ts\` puts it in front of the routes.

The counts live in memory, so they reset when the server restarts and aren't shared between instances. When you run more than one, a Redis store is the next step.`;
