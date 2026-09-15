import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { creditLeadsWith, parsePage, textOf } from './fetch-sounds.mjs';

const AGENCY = ['NPS'];

describe('creditLeadsWith', () => {
  it('accepts the agency alone', () => {
    expect(creditLeadsWith('NPS', AGENCY)).toBe(true);
  });

  it('accepts a staff recording, which is still a federal work', () => {
    expect(creditLeadsWith('NPS / Theresa Thom', AGENCY)).toBe(true);
    expect(creditLeadsWith('NPS photo by J. Doe', AGENCY)).toBe(true);
  });

  it('rejects an outside recordist who merely names the agency', () => {
    expect(creditLeadsWith('Jane Roe, courtesy of NPS', AGENCY)).toBe(false);
    expect(creditLeadsWith('Recording by Cornell Lab, used by NPS', AGENCY)).toBe(false);
    expect(creditLeadsWith('© 2019 Someone / NPS', AGENCY)).toBe(false);
  });

  it('rejects a different agency that merely starts with the same letters', () => {
    expect(creditLeadsWith('NPSX Media Group', AGENCY)).toBe(false);
    expect(creditLeadsWith('NPSounds Ltd', AGENCY)).toBe(false);
  });

  it('rejects nothing at all', () => {
    for (const bad of ['', '   ', null, undefined, 42, {}]) {
      expect(creditLeadsWith(bad, AGENCY)).toBe(false);
    }
  });

  it('ignores case and leading space, because pages are inconsistent', () => {
    expect(creditLeadsWith('  nps / Someone', AGENCY)).toBe(true);
  });
});

describe('parsePage', () => {
  const page = (body) => `<html><body>${body}</body></html>`;

  it('finds the audio link and the credit on the next line', () => {
    const r = parsePage(page(`
      <a href="https://example.gov/audio/wolf.mp3">listen</a>
      <dt>Credit / Author:</dt><dd>NPS</dd>
    `));
    expect(r.audio).toBe('https://example.gov/audio/wolf.mp3');
    expect(r.credit).toBe('NPS');
  });

  it('reads a credit given on the same line after the colon', () => {
    const r = parsePage(page(`
      <a href="https://example.gov/a.mp3">x</a>
      <p>Credit: NPS / Theresa Thom</p>
    `));
    expect(r.credit).toBe('NPS / Theresa Thom');
  });

  it('returns no credit when the page carries none, rather than guessing', () => {
    const r = parsePage(page('<a href="https://example.gov/a.mp3">x</a>'));
    expect(r.audio).toBe('https://example.gov/a.mp3');
    expect(r.credit).toBeNull();
  });

  it('returns no audio when the page has none', () => {
    const r = parsePage(page('<p>Credit: NPS</p>'));
    expect(r.audio).toBeNull();
  });

  it('takes the first audio link when a page lists several', () => {
    const r = parsePage(page(`
      <a href="https://example.gov/one.mp3">a</a>
      <a href="https://example.gov/two.mp3">b</a>
      <p>Credit: NPS</p>
    `));
    expect(r.audio).toBe('https://example.gov/one.mp3');
  });

  it('does not mistake a script or style body for page text', () => {
    const lines = textOf('<script>var credit = "NPS";</script><p>Credit: Someone Else</p>');
    expect(lines.join(' ')).not.toContain('var credit');
  });
});

describe('the source manifest', () => {
  // A plain path, not import.meta.url: under jsdom that is an http URL.
  const manifest = JSON.parse(readFileSync('scripts/sound-sources.json', 'utf8'));

  it('names a source and a credit rule for every entry', () => {
    for (const e of manifest.entries) {
      expect(manifest.sources[e.source], e.file).toBeTruthy();
      expect(manifest.sources[e.source].creditMustStartWith.length).toBeGreaterThan(0);
      expect(manifest.sources[e.source].licence, e.file).toBeTruthy();
    }
  });

  it('gives every entry a reason, so nobody has to guess why it is on the list', () => {
    for (const e of manifest.entries) expect(typeof e.why, e.file).toBe('string');
  });

  it('uses each target filename and sound type only once', () => {
    const files = manifest.entries.map(e => e.file);
    const types = manifest.entries.map(e => e.type);
    expect(new Set(files).size).toBe(files.length);
    expect(new Set(types).size).toBe(types.length);
  });

  it('fetches over https only', () => {
    for (const e of manifest.entries) expect(e.page.startsWith('https://'), e.file).toBe(true);
  });
});
