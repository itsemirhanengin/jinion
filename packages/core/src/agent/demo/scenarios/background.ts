import type { Scenario } from '../types.js';
import { DEV_SERVER_RUN, FAILING_RUN } from './acme-api.js';

export const devServer: Scenario = {
  title: 'Start the dev server',
  match: /dev server|npm run dev|pnpm dev/i,
  async *play(script) {
    yield* script.think('A dev server keeps running, so it goes in the background and the conversation goes on.');

    yield* script.background('pnpm dev', {
      output: DEV_SERVER_RUN,
      durationMs: 1500,
      async *followup(next) {
        yield* next.say('The dev server is stopped. Ask me to start it again whenever you need it.');
      },
    });

    yield* script.usage(1_100, 0.003);

    yield* script.say(
      'The dev server runs in the background on **http://localhost:3000**. `ctrl+t` shows its output, and `x` there stops it; I keep it running while we work.',
    );
  },
};

export const backgroundTests: Scenario = {
  title: 'Run the tests in the background',
  match: /tests? in the background/i,
  async *play(script) {
    yield* script.think('The suite takes a while; it can run in the background and I will look at it when it is done.');

    yield* script.background('pnpm vitest run', {
      output: FAILING_RUN,
      durationMs: 4000,
      exitCode: 1,
      async *followup(next) {
        yield* next.think('The background run failed. The window reset test expects 200 right at the boundary.');
        yield* next.usage(900, 0.003);

        yield* next.say(
          'The test run in the background failed: `resets the window after it elapses` gets 429 where it expects 200, so the window is still closed exactly at its boundary. The check should use `>=`.',
        );
      },
    });

    yield* script.say("The tests run in the background. I'll tell you how they did once they finish.");
  },
};
