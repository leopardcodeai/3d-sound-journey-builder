import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Library } from './Library.js';
import { setLanguage } from '../i18n.js';

function makeLibrary(onAdd = vi.fn()) {
  document.body.innerHTML = '<div id="lib"></div>';
  const engine = { previewSound: vi.fn(() => Promise.resolve()) };
  const lib = new Library(document.getElementById('lib'), engine, { onAdd });
  return { lib, onAdd, engine };
}

describe('library cards and the keyboard', () => {
  beforeEach(() => setLanguage('en'));

  it('offers add and preview as real buttons, not decorated spans', () => {
    const { lib } = makeLibrary();
    const card = lib.listEl.querySelector('.card-sound');
    expect(card).toBeTruthy();
    for (const cls of ['.card-add', '.card-preview']) {
      const el = card.querySelector(cls);
      expect(el, cls).toBeTruthy();
      // A span cannot be reached by Tab and does not activate on Enter.
      expect(el.tagName, cls).toBe('BUTTON');
      expect(el.getAttribute('aria-hidden'), cls).toBeNull();
    }
  });

  it('does not leave the card itself focusable, since it does nothing on Enter', () => {
    const { lib } = makeLibrary();
    expect(lib.listEl.querySelector('.card-sound').getAttribute('tabindex')).toBeNull();
  });

  it('names every button after its own sound', () => {
    const { lib } = makeLibrary();
    const cards = [...lib.listEl.querySelectorAll('.card-sound')].slice(0, 4);
    expect(cards.length).toBeGreaterThan(1);
    const adds = cards.map(c => c.querySelector('.card-add').getAttribute('aria-label'));
    const previews = cards.map(c => c.querySelector('.card-preview').getAttribute('aria-label'));
    for (const label of [...adds, ...previews]) {
      expect(label).toBeTruthy();
      expect(label).not.toContain('{name}');
    }
    // Sixty buttons all called "Audition" told a screen reader nothing.
    expect(new Set(adds).size).toBe(adds.length);
    expect(new Set(previews).size).toBe(previews.length);
  });

  it('adds the sound exactly once when its add button is activated', () => {
    const { lib, onAdd } = makeLibrary();
    const card = lib.listEl.querySelector('.card-sound');
    card.querySelector('.card-add').click();
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledWith(card.dataset.type);
  });

  it('previews without adding when the preview button is activated', () => {
    const { lib, onAdd, engine } = makeLibrary();
    const card = lib.listEl.querySelector('.card-sound');
    card.querySelector('.card-preview').click();
    expect(engine.previewSound).toHaveBeenCalled();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('keeps a hostile display name as text, in the label and on the card', () => {
    const { lib } = makeLibrary();
    const hostile = '"><img src=x onerror=1>';
    lib.addCustomSound({
      type: 'custom_x', kind: 'sample', category: 'custom', glyph: 'file',
      color: '#ff7b7b', spatial: true, name: hostile, desc: '1 s',
    });
    // Searching the serialised innerHTML is the wrong test: angle brackets are
    // legal inside an attribute value and are not escaped on the way out. What
    // matters is that nothing was parsed as markup.
    expect(lib.listEl.querySelector('img')).toBeNull();
    expect(lib.listEl.querySelectorAll('.card-sound')).toHaveLength(1);
    const card = lib.listEl.querySelector('.card-sound');
    expect(card.querySelector('.card-name').textContent).toBe(hostile);
    expect(card.querySelector('.card-add').getAttribute('aria-label')).toContain(hostile);
  });

  it('keeps the labels in the interface language', () => {
    const { lib } = makeLibrary();
    setLanguage('de');
    lib.refresh();
    const label = lib.listEl.querySelector('.card-add').getAttribute('aria-label');
    expect(label).toContain('hinzufügen');
    setLanguage('en');
  });
});
