/** The sample project's files, as the agent finds them before any scenario changes them. */
export function sampleFiles(project: string): Record<string, string> {
  return {
    'package.json': `{
  "name": "${project}",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "lint": "biome check ."
  },
  "dependencies": {
    "express": "^5.1.0",
    "zod": "^4.1.0"
  },
  "devDependencies": {
    "tsx": "^4.20.0",
    "typescript": "^5.9.0",
    "vitest": "^3.2.0"
  }
}
`,
    'README.md': `# ${project}

The API behind Acme's shop: orders, accounts and the jobs that send emails.

\`\`\`sh
pnpm install
pnpm dev
\`\`\`
`,
    'tsconfig.json': `{
  "compilerOptions": {
    "target": "es2023",
    "module": "nodenext",
    "strict": true,
    "outDir": "dist"
  },
  "include": ["src"]
}
`,
    '.env.example': 'PORT=3000\nDATABASE_URL=postgres://localhost/acme\n',
    'src/server.ts': SERVER,
    'src/routes.ts': `import { Router } from 'express';
import { auth } from './routes/auth.js';
import { orders } from './routes/orders.js';

export const routes = Router();

routes.use('/auth', auth);
routes.use('/orders', orders);
`,
    'src/routes/auth.ts': `import { Router } from 'express';
import { createSession, verifyPassword } from '../accounts.js';

export const auth = Router();

// TODO: throttle repeated logins, respond 429
auth.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const account = await verifyPassword(email, password);
  if (!account) return res.status(401).json({ error: 'Wrong email or password.' });

  res.json({ token: await createSession(account) });
});
`,
    'src/routes/orders.ts': `import { Router } from 'express';
import { listOrders } from '../orders.js';

export const orders = Router();

orders.get('/', async (req, res) => {
  res.json(await listOrders(req.query));
});
`,
    'src/middleware/cors.ts': `import type { RequestHandler } from 'express';

export const cors = (): RequestHandler => (_req, res, next) => {
  res.setHeader('access-control-allow-origin', '*');
  next();
};
`,
    'src/middleware/request-id.ts': `import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

export const requestId = (): RequestHandler => (req, res, next) => {
  res.setHeader('x-request-id', req.header('x-request-id') ?? randomUUID());
  next();
};
`,
    'src/http/errors.ts': `export class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export class TooManyRequests extends HttpError {
  constructor() {
    super(429, 'Too many requests. Try again in a minute.');
  }
}
`,
    'src/jobs/queue.ts': `import type { Job } from './types.js';

const pending: Job[] = [];
let running = false;

/** Jobs run one at a time, in the order they came, and a failed one is tried again twice. */
export function enqueue(job: Job) {
  pending.push({ ...job, attempts: 0 });
  void drain();
}

async function drain() {
  if (running) return;

  running = true;

  while (pending.length > 0) {
    const job = pending.shift()!;

    try {
      await job.run();
    } catch {
      if (job.attempts < 2) pending.push({ ...job, attempts: job.attempts + 1 });
    }
  }

  running = false;
}
`,
    'tests/auth.test.ts': `import { describe, expect, it, vi } from 'vitest';
import { createSession } from '../src/accounts.js';

describe('sessions', () => {
  it('expire after an hour', async () => {
    const session = await createSession({ id: 'a1' });

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(session.expiresAt - Date.now()).toBe(60 * 60 * 1000);
  });
});
`,
  };
}

export const SERVER = `import express from 'express';
import { cors } from './middleware/cors.js';
import { requestId } from './middleware/request-id.js';
import { routes } from './routes.js';

const app = express();

app.use(express.json());
app.use(requestId());
app.use(cors());
app.use('/api', routes);

app.listen(process.env.PORT ?? 3000);
`;
