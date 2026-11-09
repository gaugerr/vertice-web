import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'node',
    include: ['shared/workspaces/**/*.test.{ts,mjs}'],
    testTimeout: 20000,
    pool: 'forks',
    maxWorkers: 1,
  },
});
