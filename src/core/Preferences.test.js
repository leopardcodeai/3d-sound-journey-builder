import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  DEFAULTS, OUTPUT_MODES, POSTURES,
  sanitisePrefs, loadPrefs, savePrefs, resetPrefs,
} from './Preferences.js';

const KEY = 'sjb_prefs';

describe('sanitisePrefs', () => {
  it('returns the defaults for nothing', () => {
    expect(sanitisePrefs(null)).toEqual(DEFAULTS);
    expect(sanitisePrefs(undefined)).toEqual(DEFAULTS);
    expect(sanitisePrefs('not an object')).toEqual(DEFAULTS);
    expect(sanitisePrefs([])).toEqual(DEFAULTS);
  });

  it('keeps valid values', () => {
    const p = sanitisePrefs({ output: 'stereo-speakers', room: 0.8, posture: 'lying-back', headTilt: -12 });
    expect(p.output).toBe('stereo-speakers');
    expect(p.room).toBe(0.8);
    expect(p.posture).toBe('lying-back');
    expect(p.headTilt).toBe(-12);
  });

  it('rejects an output mode that is not one of ours', () => {
    expect(sanitisePrefs({ output: 'binaural-telepathy' }).output).toBe(DEFAULTS.output);
    expect(sanitisePrefs({ posture: 'upside-down' }).posture).toBe(DEFAULTS.posture);
  });

  it('clamps numbers into range instead of passing them on', () => {
    expect(sanitisePrefs({ room: 99 }).room).toBe(1);
    expect(sanitisePrefs({ room: -4 }).room).toBe(0);
    expect(sanitisePrefs({ headTilt: 900 }).headTilt).toBe(45);
    expect(sanitisePrefs({ masterVolume: 2.5 }).masterVolume).toBe(1);
  });

  it('replaces a non-finite number with the default, never NaN', () => {
    for (const bad of [NaN, Infinity, -Infinity, 'abc', null, {}, []]) {
      const p = sanitisePrefs({ room: bad });
      expect(Number.isFinite(p.room)).toBe(true);
      expect(p.room).toBe(DEFAULTS.room);
    }
  });

  it('parses a numeric string, because range inputs report strings', () => {
    expect(sanitisePrefs({ room: '0.42' }).room).toBeCloseTo(0.42);
  });

  it('rejects a start id with unusable characters', () => {
    expect(sanitisePrefs({ startWith: 'ocean' }).startWith).toBe('ocean');
    expect(sanitisePrefs({ startWith: '../../etc/passwd' }).startWith).toBe(DEFAULTS.startWith);
    expect(sanitisePrefs({ startWith: '<img src=x onerror=1>' }).startWith).toBe(DEFAULTS.startWith);
    expect(sanitisePrefs({ startWith: 'x'.repeat(200) }).startWith).toBe(DEFAULTS.startWith);
    expect(sanitisePrefs({ startWith: '' }).startWith).toBe(DEFAULTS.startWith);
  });

  it('takes booleans only for a boolean field', () => {
    expect(sanitisePrefs({ rememberStart: false }).rememberStart).toBe(false);
    expect(sanitisePrefs({ rememberStart: 'yes' }).rememberStart).toBe(DEFAULTS.rememberStart);
  });

  it('drops keys it does not know', () => {
    const p = sanitisePrefs({ output: 'stereo-speakers', __proto__: { polluted: true }, nonsense: 1 });
    expect(p.nonsense).toBeUndefined();
    expect(Object.keys(p).sort()).toEqual(Object.keys(DEFAULTS).sort());
  });

  it('covers every value the interface can produce', () => {
    for (const m of OUTPUT_MODES) expect(sanitisePrefs({ output: m }).output).toBe(m);
    for (const p of POSTURES) expect(sanitisePrefs({ posture: p }).posture).toBe(p);
  });
});

describe('preference storage', () => {
  beforeEach(() => { localStorage.clear(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('reads the defaults when nothing is stored', () => {
    expect(loadPrefs()).toEqual(DEFAULTS);
  });

  it('round-trips a saved value', () => {
    savePrefs({ output: 'surround-5.1', room: 0.7 });
    const p = loadPrefs();
    expect(p.output).toBe('surround-5.1');
    expect(p.room).toBe(0.7);
  });

  it('merges a patch instead of replacing everything', () => {
    savePrefs({ output: 'stereo-speakers' });
    savePrefs({ room: 0.9 });
    const p = loadPrefs();
    expect(p.output).toBe('stereo-speakers');
    expect(p.room).toBe(0.9);
  });

  it('returns the clamped value it actually stored', () => {
    expect(savePrefs({ room: 5 }).room).toBe(1);
  });

  it('falls back to the defaults when the stored text is not JSON', () => {
    localStorage.setItem(KEY, '{not json');
    expect(loadPrefs()).toEqual(DEFAULTS);
  });

  it('sanitises what it reads back, not only what it writes', () => {
    localStorage.setItem(KEY, JSON.stringify({ output: 'evil', room: NaN, headTilt: 1e9 }));
    const p = loadPrefs();
    expect(p.output).toBe(DEFAULTS.output);
    expect(p.headTilt).toBe(45);
    expect(Number.isFinite(p.room)).toBe(true);
  });

  it('survives storage that throws on read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(loadPrefs()).toEqual(DEFAULTS);
  });

  it('survives storage that throws on write, and still returns the merged value', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(() => savePrefs({ room: 0.5 })).not.toThrow();
    expect(savePrefs({ room: 0.5 }).room).toBe(0.5);
  });

  it('resets back to the defaults', () => {
    savePrefs({ output: 'stereo-speakers' });
    expect(resetPrefs()).toEqual(DEFAULTS);
    expect(loadPrefs()).toEqual(DEFAULTS);
  });
});
