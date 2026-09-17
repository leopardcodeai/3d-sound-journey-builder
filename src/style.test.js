import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The stylesheet's :root block is the one place the layout metrics live, and
 * a stray closing brace once cut it in two: everything after the cut landed in
 * the next rule, which only applied with a class nobody had. On every desktop
 * the panels lost their width and the library grew to 681 pixels. Nothing in
 * the test suite touched CSS, so nothing noticed. This does.
 */
describe('style.css keeps its layout metrics in :root', () => {
  const css = readFileSync(resolve(__dirname, 'style.css'), 'utf8');
  const start = css.indexOf(':root {');
  const end = css.indexOf('\n}\n', start);
  const root = css.slice(start, end);

  it('declares every metric the layout reads in the first :root block', () => {
    for (const name of ['--topbar-h', '--safe-top', '--panel-w', '--dock-h', '--ease', '--accent', '--bg', '--fs']) {
      expect(root, name).toContain(`${name}:`);
    }
  });

  it('has balanced braces overall', () => {
    const opens = (css.match(/\{/g) || []).length;
    const closes = (css.match(/\}/g) || []).length;
    expect(opens).toBe(closes);
  });

  it('keeps the standalone floor out of :root', () => {
    expect(root).not.toContain('is-standalone');
    expect(css).toContain('html.is-standalone { --safe-top:');
  });
});
