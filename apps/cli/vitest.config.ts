import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The app tests check colors, and tests don't run in a TTY.
    env: { FORCE_COLOR: '3' },
    // Longer than a `waitFor`, so a test that waits too long fails with what the screen shows.
    testTimeout: 20_000,
  },
});
