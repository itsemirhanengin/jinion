export const PATH = 'src/middleware/rate-limit.ts';

export const NAME = 'rate-limit.ts';

export const SELECTED = { from: 10, to: 13 };

export const CODE = `import type { NextFunction, Request, Response } from 'express';
import { store } from './store.js';

const WINDOW = 15 * 60 * 1000;
const LIMIT = 100;

/** Counts each address's requests in a sliding window and turns away what goes over. */
export function rateLimit(limit = LIMIT) {
  return async (request: Request, response: Response, next: NextFunction) => {
    const key = \`rate:\${request.ip}\`;
    const count = await store.increment(key, WINDOW);

    if (count > limit) {
      response.setHeader('Retry-After', Math.ceil(WINDOW / 1000));

      return response.status(429).json({ error: 'Too many requests' });
    }

    response.setHeader('X-RateLimit-Remaining', Math.max(0, limit - count));
    next();
  };
}

/** Login gets its own, stricter budget: five tries in fifteen minutes. */
export const loginLimit = rateLimit(5);

export function resetFor(ip: string) {
  return store.delete(\`rate:\${ip}\`);
}
`;
