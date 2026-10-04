
export const RATE_LIMIT_FILE = `@@ -0,0 +1,29 @@
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

export const SERVER_PATCH = `@@ -1,9 +1,10 @@
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

export const AUTH_PATCH = `@@ -1,3 +1,4 @@
 import { Router } from '../http/router.js';
+import { rateLimit } from '../middleware/rate-limit.js';
 import { login, logout, refresh } from './auth.handlers.js';

@@ -39,4 +40,3 @@
 export const auth = Router();

-// TODO: throttle repeated logins, respond 429
-auth.post('/login', login);
+auth.post('/login', rateLimit({ limit: 5, windowMs: 15 * 60_000 }), login);
`;

export const TEST_FILE = `@@ -0,0 +1,28 @@
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

export const BOUNDARY_FIX = `@@ -15,7 +15,7 @@
     const now = Date.now();
     const entry = hits.get(id);

-    if (!entry || now - entry.start > windowMs) {
+    if (!entry || now - entry.start >= windowMs) {
       hits.set(id, { count: 1, start: now });
       return next();
     }
`;

export const FAILING_RUN = [
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

export const PASSING_RUN = [
  ' RUN  v4.1.2 /Users/dev/acme-api',
  '',
  ' ✓ src/middleware/rate-limit.test.ts (3 tests) 9ms',
  '',
  ' Test Files  1 passed (1)',
  '      Tests  3 passed (3)',
  '   Duration  388ms',
];

export const FULL_SUITE = [
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

export const TYPECHECK_RUN = ['> acme-api@1.4.0 typecheck', '> tsc --noEmit'];

export const LINT_RUN = ['> acme-api@1.4.0 lint', '> eslint .', '', 'No problems found.'];

export const DEV_SERVER_RUN = ['> acme-api@1.4.0 dev', '> tsx watch src/server.ts', '', '[watch] starting `node src/server.ts`', 'Server listening on http://localhost:3000'];
