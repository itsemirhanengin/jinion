import type { Scenario } from '../types.js';

const PLAN = `# Plan: rate limiting for the API

Requests are limited per API key, **60 a minute**, counted in Redis so every instance of the server shares the count. A request over the limit gets a \`429\` with a \`Retry-After\` header.

## How a request goes

\`\`\`mermaid
flowchart LR
  request[Request] --> limits["limits(apiKey)"]
  limits -->|under 60| handler[handler]
  limits -->|over| refused[429 Retry-After]
\`\`\`

## Steps

1. Add \`src/limits.ts\`: a middleware that counts each key's requests in a sliding window.
2. Use it in \`src/server.ts\`, before \`express.json()\`, so a refused request isn't read.
3. Tests for a key under the limit, over it, and after its minute has passed.

## Files

- [ ] \`src/limits.ts\`, new
- [ ] \`src/server.ts\`, one line
- [ ] \`tests/limits.test.ts\`, new

## Risks

Without Redis the limit falls back to each instance's memory, so a key gets 60 a minute on every instance.
`;

/** Plan mode's loop: the agent reads, writes a plan with a diagram, and waits for the user to build it or change it. */
export const planning: Scenario = {
  title: 'Plan rate limiting',
  match: /\bplan\b/i,
  async *play(script) {
    yield* script.think('A plan first: read how requests go through the server, then write the steps down for the user to check.');
    yield* script.tool('read', { files: [{ path: 'src/server.ts' }] }, {}, 300);
    yield* script.tool('grep', { pattern: 'app.use', path: 'src' }, { matches: [{ file: 'src/server.ts', line: 12, text: 'app.use(express.json());' }] }, 250);
    yield* script.usage(9_800, 0.03);

    const decision = yield* script.plan(PLAN);

    if (!decision.approve) {
      yield* script.say(decision.note ? `Understood: ${decision.note} I'll rework the plan around that.` : 'Sure. What should change in the plan?');

      return;
    }

    yield* script.say(
      decision.plan
        ? 'You changed the plan before approving it, so I will build it as you left it, not as I first wrote it.'
        : 'Building it as planned.',
    );
  },
};
