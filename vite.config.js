import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8'));

/**
 * The commit this build came from.
 *
 * Deployment here is a CLI upload, not a git push, so nothing in the hosting
 * platform knows which commit is live. Reading it at build time is the only way
 * the running app can say. Vercel sets VERCEL_GIT_COMMIT_SHA when a project is
 * connected to a repository, so that is preferred when present; otherwise git
 * itself answers. Both can be absent, and an unknown commit must not fail a
 * build.
 *
 * execFileSync with an argument list rather than execSync with a string: there
 * is no interpolation here today, but a shell string is one edit away from
 * being one.
 *
 * Note for anyone reading a stale number in development: these values are
 * evaluated once when the dev server starts, so bumping the version in
 * package.json shows up only after a restart. A production build always reads
 * them fresh.
 */
function commitId() {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7);
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString().trim();
  } catch (e) {
    return 'unknown';
  }
}

/** A date a person can read, not an ISO timestamp with a time zone in it. */
function buildDate() {
  return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Two pages: the landing page at / and the app at /app.
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_COMMIT__: JSON.stringify(commitId()),
    __BUILD_DATE__: JSON.stringify(buildDate()),
  },
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
