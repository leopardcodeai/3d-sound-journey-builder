import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Library } from './Library.js';
import { SOUNDS } from '../data/SoundLibrary.js';

function createEngine() {
  return { previewSound: vi.fn(() => Promise.resolve(true)), stopPreview: vi.fn() };
}

describe('Library', () => {
  let root, engine, library;

  beforeEach(() => {
    vi.useFakeTimers();
    root = document.createElement('div');
    document.body.appendChild(root);
    engine = createEngine();
    library = new Library(root, engine, {});
  });

  it('renders a card per sound in the active category', () => {
    library.category = 'nature';
    library.render();
    const cards = root.querySelectorAll('.card-sound');
    expect(cards.length).toBe(SOUNDS.filter(s => s.category === 'nature').length);
  });

  it('searches beyond the selected category', () => {
    library.category = 'nature';
    library.render();
    library.searchEl.value = 'binaural';
    library.searchEl.dispatchEvent(new Event('input'));
    const types = [...root.querySelectorAll('.card-sound')].map(c => c.dataset.type);
    expect(types).toContain('bw_alpha');
    expect(types.every(t => t.startsWith('bw_'))).toBe(true);
  });

  it('matches the description as well as the name', () => {
    library.searchEl.value = 'waterfall';
    library.searchEl.dispatchEvent(new Event('input'));
    expect([...root.querySelectorAll('.card-sound')].map(c => c.dataset.type)).toEqual([]);
    library.searchEl.value = 'masking';
    library.searchEl.dispatchEvent(new Event('input'));
    expect([...root.querySelectorAll('.card-sound')].map(c => c.dataset.type)).toContain('noise_brown');
  });

  it('reports when nothing matches', () => {
    library.searchEl.value = 'zzzznothing';
    library.searchEl.dispatchEvent(new Event('input'));
    expect(root.querySelector('.empty-note')).toBeTruthy();
  });

  it('shows an evidence tag and a note for frequency tools', () => {
    library.category = 'frequencies';
    library.render();
    const card = root.querySelector('.card-sound[data-type="noise_brown"]');
    expect(card.querySelector('.tag-weak')).toBeTruthy();
    expect(card.querySelector('.card-note').textContent).toMatch(/brown noise/i);
  });

  it('escapes names so a user upload cannot inject markup', () => {
    library.addCustomSound({ type: 'custom_x', kind: 'sample', category: 'custom', glyph: 'file', color: '#fff', name: '<img src=x onerror=alert(1)>', desc: '1 s' });
    const card = root.querySelector('.card-sound[data-type="custom_x"]');
    expect(card.querySelector('img')).toBeNull();
    expect(card.querySelector('.card-name').textContent).toBe('<img src=x onerror=alert(1)>');
  });

  it('resets the previous audition button when a second preview starts', async () => {
    library.category = 'nature';
    library.render();
    const [a, b] = root.querySelectorAll('.card-preview');
    await library.audition('rain', a);
    expect(a.classList.contains('is-on')).toBe(true);

    await library.audition('waves', b);
    expect(a.classList.contains('is-on'), 'first button released').toBe(false);
    expect(b.classList.contains('is-on')).toBe(true);

    vi.advanceTimersByTime(4300);
    expect(b.classList.contains('is-on')).toBe(false);
  });
});
