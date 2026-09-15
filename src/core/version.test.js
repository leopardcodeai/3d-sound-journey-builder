import { describe, it, expect } from 'vitest';
import { APP_VERSION, BUILD_COMMIT, BUILD_DATE, buildLabel, buildInfo } from './version.js';

describe('build identity', () => {
  it('always has a version string, even without the build step', () => {
    expect(typeof APP_VERSION).toBe('string');
    expect(APP_VERSION.length).toBeGreaterThan(0);
  });

  it('never shows an undefined or empty value on screen', () => {
    const label = buildLabel();
    expect(label).toBeTruthy();
    expect(label).not.toContain('undefined');
    expect(label).not.toContain('null');
    expect(label.trim()).toBe(label);
  });

  it('leaves out what it does not know rather than printing a placeholder', () => {
    // An "unknown" on screen reads as a fault; an absence reads as nothing to
    // say. Under test nothing is injected, so the label is the version alone.
    if (BUILD_COMMIT === 'unknown') expect(buildLabel()).not.toContain('unknown');
    if (!BUILD_DATE) expect(buildLabel().split('·')).toHaveLength(1);
  });

  it('reports the same facts as data for a bug report', () => {
    const info = buildInfo();
    expect(Object.keys(info).sort()).toEqual(['commit', 'date', 'version']);
    expect(info.version).toBe(APP_VERSION);
    for (const v of Object.values(info)) expect(typeof v).toBe('string');
  });

  it('matches the version declared in package.json once built', async () => {
    const { readFileSync } = await import('node:fs');
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
    // Under vitest the define step does not run, so the module falls back.
    // What must hold either way is that the fallback is recognisable as one.
    if (APP_VERSION !== pkg.version) expect(APP_VERSION).toContain('dev');
  });
});
