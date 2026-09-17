import { describe, it, expect, vi } from 'vitest';
import { defaultSceneName, shareLink } from './share.js';

describe('defaultSceneName', () => {
  const at = new Date(2026, 8, 17, 19, 5);

  it('reads as a moment', () => {
    const name = defaultSceneName([], at);
    expect(name).toMatch(/17/);
    expect(name).toMatch(/19:05|7:05/);
  });

  it('does not collide with a name already taken', () => {
    const first = defaultSceneName([], at);
    const second = defaultSceneName([first], at);
    const third = defaultSceneName([first, second], at);
    expect(second).toBe(`${first} (2)`);
    expect(third).toBe(`${first} (3)`);
  });
});

describe('shareLink', () => {
  const url = 'https://example.test/app#scene=abc';

  it('uses the share sheet on a device that has one, when asked to', async () => {
    const nav = { share: vi.fn(() => Promise.resolve()), clipboard: { writeText: vi.fn() } };
    expect(await shareLink(url, { nav, preferSheet: true })).toBe('shared');
    expect(nav.share).toHaveBeenCalledWith({ title: 'Sound Journey', url });
    expect(nav.clipboard.writeText).not.toHaveBeenCalled();
  });

  it('reports a closed sheet as cancelled and does not fall back', async () => {
    const err = new Error('closed'); err.name = 'AbortError';
    const nav = { share: vi.fn(() => Promise.reject(err)), clipboard: { writeText: vi.fn() } };
    expect(await shareLink(url, { nav, preferSheet: true })).toBe('cancelled');
    expect(nav.clipboard.writeText).not.toHaveBeenCalled();
  });

  it('copies on a desktop even when a sheet exists', async () => {
    const nav = { share: vi.fn(), clipboard: { writeText: vi.fn(() => Promise.resolve()) } };
    expect(await shareLink(url, { nav, preferSheet: false })).toBe('copied');
    expect(nav.share).not.toHaveBeenCalled();
  });

  it('asks the caller to show the link when nothing else is possible', async () => {
    const nav = { clipboard: { writeText: vi.fn(() => Promise.reject(new Error('denied'))) } };
    expect(await shareLink(url, { nav })).toBe('shown');
    expect(await shareLink(url, { nav: {} })).toBe('shown');
  });
});
