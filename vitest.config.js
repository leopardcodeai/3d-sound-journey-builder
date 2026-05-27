import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.js'],
    setupFiles: ['./vitest.setup.js'],
  },
});
