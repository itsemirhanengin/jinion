import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Colors are part of what the terminal tests check, and tests don't run in a TTY.
    env: { FORCE_COLOR: '3' },
  },
});
