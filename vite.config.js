import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Two pages: the landing page at / and the app at /app.
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        landing: resolve(__dirname, 'index.html'),
        app: resolve(__dirname, 'app.html'),
        privacy: resolve(__dirname, 'privacy.html'),
      },
    },
  },
});
