import type { Scenario } from '../types.js';

const HITS = [
  { title: 'RateLimit header fields for HTTP', url: 'https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/' },
  { title: '429 Too Many Requests - HTTP | MDN', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429' },
  { title: 'Rate limits | GitHub REST API', url: 'https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api' },
  { title: 'Rate limits | Stripe API reference', url: 'https://docs.stripe.com/rate-limits' },
  { title: 'Retry-After - HTTP | MDN', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Retry-After' },
  { title: 'express-rate-limit', url: 'https://www.npmjs.com/package/express-rate-limit' },
  { title: 'Rate limiting best practices | Cloudflare', url: 'https://developers.cloudflare.com/waf/rate-limiting-rules/best-practices/' },
];

const PAGE = [
  'The 429 status means the client sent too many requests in a given amount of time.',
  'A Retry-After header may say how long to wait before the next request, in seconds or as a date.',
  'The response body should explain the limit; servers are not required to send Retry-After.',
  'How clients are identified and counted is up to the server.',
];

const DOCS = [
  'express-rate-limit: Basic rate-limiting middleware for Express.',
  '',
  'standardHeaders: "draft-8" sends a combined `RateLimit` header and `RateLimit-Policy`,',
  'as in the IETF draft; legacyHeaders: false drops the older `X-RateLimit-*` ones.',
  '',
  'const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: "draft-8", legacyHeaders: false });',
  'app.use(limiter);',
];

export const research: Scenario = {
  title: 'Look up how APIs answer 429',
  match: /\b(look up|search|research)\b/i,
  async *play(script) {
    yield* script.think('This is about conventions, not this codebase: what other APIs send back with a 429. A search first, then the reference pages.');
    yield* script.usage(2_100, 0.007);

    yield* script.tool('search', { query: 'http 429 rate limit response headers' }, { hits: HITS, searches: 1, durationMs: 2_800 }, 900);
    yield* script.tool('fetch', { url: HITS[1]!.url, prompt: 'What does a 429 response carry?' }, { bytes: 148_213, code: 200, codeText: 'OK' }, 700, PAGE);

    yield* script.tool(
      'mcp',
      { server: 'context7', tool: 'query-docs', arguments: 'libraryId: "/express-rate-limit/express-rate-limit", query: "standard headers"' },
      {},
      600,
      DOCS,
    );

    yield* script.usage(3_400, 0.012);

    yield* script.say(
      [
        'A `429 Too Many Requests` usually carries three things:',
        '- **`Retry-After`**, the seconds to wait. MDN lists it as optional, but GitHub and Stripe both send it.',
        '- **`RateLimit` and `RateLimit-Policy`**, from the IETF draft: the budget and what is left of it. `express-rate-limit` sends them with `standardHeaders: "draft-8"`.',
        '- **A body that names the limit**, so a client can tell it apart from other errors.',
      ].join('\n'),
    );
  },
};
