/**
 * Build identity.
 *
 * A version number on its own does not answer the question you actually have
 * when something looks wrong in production: is the thing in front of me the
 * thing I just pushed? This project deploys by CLI upload, so the running build
 * is not tied to a branch, and the aliases have already pointed at a
 * three-month-old deployment once without anything on screen saying so.
 *
 * So the build carries three facts: the semantic version, the commit it was
 * built from, and when. All three are injected at build time by vite.config.js.
 * The constants below are the fallbacks for anything that loads this module
 * without that step, such as a unit test.
 */

/* global __APP_VERSION__, __BUILD_COMMIT__, __BUILD_DATE__ */

const read = (value, fallback) => (typeof value === 'string' && value ? value : fallback);

export const APP_VERSION = read(
  typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : null, '0.0.0-dev',
);

export const BUILD_COMMIT = read(
  typeof __BUILD_COMMIT__ !== 'undefined' ? __BUILD_COMMIT__ : null, 'unknown',
);

export const BUILD_DATE = read(
  typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : null, '',
);

/**
 * One line for the interface: "2.1.0 · aa2912c · 15 Sep 2026".
 * Parts that are unknown are left out rather than shown as a placeholder: an
 * "unknown" on screen reads as a fault, an absence reads as nothing to say.
 */
export function buildLabel() {
  const parts = [APP_VERSION];
  if (BUILD_COMMIT && BUILD_COMMIT !== 'unknown') parts.push(BUILD_COMMIT);
  if (BUILD_DATE) parts.push(BUILD_DATE);
  return parts.join(' · ');
}

/** The same facts as data, for a bug report or a support question. */
export function buildInfo() {
  return { version: APP_VERSION, commit: BUILD_COMMIT, date: BUILD_DATE };
}
