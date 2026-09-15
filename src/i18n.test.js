import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { t, setLanguage, getLanguage, detectLanguage, applyTranslations } from './i18n.js';

describe('i18n', () => {
  beforeEach(() => { localStorage.clear(); setLanguage('en'); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('returns English strings by default', () => {
    expect(t('appTitle')).toBe('Sound Journey Builder');
    expect(t('catFrequencies')).toBe('Frequencies');
  });

  it('switches to German', () => {
    setLanguage('de');
    expect(t('masterVolume')).toBe('Gesamtlautstärke');
    expect(t('mute')).toBe('Stumm');
    expect(getLanguage()).toBe('de');
  });

  it('falls back to English for keys missing in German', () => {
    setLanguage('de');
    expect(t('appTitle')).toBe('Sound Journey Builder');
  });

  it('returns the key itself when nothing matches', () => {
    expect(t('nonexistent_key_xyz')).toBe('nonexistent_key_xyz');
  });

  it('persists the language and dispatches an event', () => {
    const spy = vi.fn();
    window.addEventListener('languagechange', spy);
    setLanguage('de');
    expect(localStorage.getItem('sjb_lang')).toBe('de');
    expect(spy).toHaveBeenCalled();
    window.removeEventListener('languagechange', spy);
  });

  it('detects German from the browser language', () => {
    localStorage.clear();
    vi.stubGlobal('navigator', { language: 'de-DE' });
    expect(detectLanguage()).toBe('de');
    vi.stubGlobal('navigator', { language: 'fr-FR' });
    expect(detectLanguage()).toBe('en');
  });

  it('applies translations to marked elements', () => {
    setLanguage('en');
    const root = document.createElement('div');
    root.innerHTML = '<span data-i18n="volume"></span><button data-i18n-title="mute"></button>';
    applyTranslations(root);
    expect(root.querySelector('span').textContent).toBe('Volume');
    expect(root.querySelector('button').title).toBe('Mute');
    expect(root.querySelector('button').getAttribute('aria-label')).toBe('Mute');
  });
});
