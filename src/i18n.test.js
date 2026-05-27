import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { t, setLanguage, getLanguage, detectLanguage } from './i18n.js';

describe('i18n', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('t()', () => {
    it('should return correct English string for default language', () => {
      setLanguage('en');
      expect(t('appTitle')).toBe('Pirate Healings');
    });

    it('should return correct German string after setLanguage("de")', () => {
      setLanguage('de');
      expect(t('appTitle')).toBe('Pirate Healings');
      expect(t('masterControl')).toBe('Master Steuerung');
      expect(t('mute')).toBe('Stumm');
    });

    it('should fall back to English for missing keys in German', () => {
      setLanguage('de');
      expect(t('appTitle')).toBe('Pirate Healings');
    });

    it('should return the key itself for completely missing keys', () => {
      expect(t('nonexistent_key_xyz')).toBe('nonexistent_key_xyz');
    });
  });

  describe('setLanguage()', () => {
    it('should persist language to localStorage', () => {
      setLanguage('de');
      expect(localStorage.getItem('immerse_lang')).toBe('de');
    });

    it('should dispatch languagechange event', () => {
      const handler = vi.fn();
      window.addEventListener('languagechange', handler);
      setLanguage('de');
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ detail: 'de' }));
      window.removeEventListener('languagechange', handler);
    });
  });

  describe('getLanguage()', () => {
    it('should return current language', () => {
      setLanguage('en');
      expect(getLanguage()).toBe('en');
      setLanguage('de');
      expect(getLanguage()).toBe('de');
    });
  });

  describe('detectLanguage()', () => {
    it('should return saved language from localStorage if present', () => {
      localStorage.setItem('immerse_lang', 'de');
      expect(detectLanguage()).toBe('de');
    });

    it('should detect German from navigator.language', () => {
      vi.stubGlobal('navigator', { language: 'de-DE' });
      localStorage.clear();
      expect(detectLanguage()).toBe('de');
    });

    it('should default to English for non-German navigator.language', () => {
      vi.stubGlobal('navigator', { language: 'en-US' });
      localStorage.clear();
      expect(detectLanguage()).toBe('en');
    });

    it('should default to English for empty navigator.language', () => {
      vi.stubGlobal('navigator', { language: '' });
      localStorage.clear();
      expect(detectLanguage()).toBe('en');
    });
  });
});
