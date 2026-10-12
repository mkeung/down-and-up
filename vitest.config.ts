import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      'server-only': fileURLToPath(
        new URL('./scripts/server-only-test.ts', import.meta.url),
      ),
      '@down-up/shared': fileURLToPath(
        new URL('./packages/shared/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    include: ['packages/**/*.test.ts', 'apps/**/*.test.ts'],
    testTimeout: 15000,
  },
});
