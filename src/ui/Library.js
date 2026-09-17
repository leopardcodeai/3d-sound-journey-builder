/**
 * Library
 * The left panel: categories, a search field, and a card per sound. A card can
 * be auditioned (a short preview through the master bus), added to the field,
 * or dragged onto the map. Custom uploads land in their own category.
 */
import { CATEGORIES, SOUNDS, soundsByCategory, getSound, soundName } from '../data/SoundLibrary.js';
import { icon } from './Icons.js';
import { t } from '../i18n.js';

export class Library {
  /**
   * @param {HTMLElement} root
   * @param {SpatialAudioEngine} audioEngine
   * @param {Object} callbacks { onAdd(type), onUpload(file, name) }
   */
  constructor(root, audioEngine, callbacks = {}) {
    this.root = root;
    this.audioEngine = audioEngine;
    this.callbacks = callbacks;
    this.category = 'nature';
    this.query = '';
    this.customSounds = [];
    this._previewTimer = null;
    this._previewBtn = null;

    this._build();
    this._bind();
    this.render();
  }

  _build() {
    this.root.innerHTML = `
      <div class="panel-head">
        <h2 class="panel-title" data-i18n="library">Library</h2>
        <div class="field-search">
          ${icon('search', { size: 14 })}
          <input type="search" class="lib-search input" data-i18n="search" placeholder="Search sounds" />
        </div>
      </div>
      <div class="lib-cats" role="tablist"></div>
      <div class="lib-list"></div>
      <div class="lib-foot">
        <label class="upload">
          <input type="file" class="lib-file" accept="audio/*" hidden />
          <span class="upload-inner">${icon('upload', { size: 14 })}<span data-i18n="uploadAudio">Add your own audio</span></span>
        </label>
        <p class="note" data-i18n="evidenceNote"></p>
      </div>
    `;
    this.catsEl = this.root.querySelector('.lib-cats');
    this.listEl = this.root.querySelector('.lib-list');
    this.searchEl = this.root.querySelector('.lib-search');
    this.fileEl = this.root.querySelector('.lib-file');
  }

  _bind() {
    this.searchEl.addEventListener('input', () => {
      this.query = this.searchEl.value.trim().toLowerCase();
      this.renderList();
    });

    this.catsEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.lib-cat');
      if (!btn) return;
      this.category = btn.dataset.cat;
      this.query = '';
      this.searchEl.value = '';
      this.render();
    });

    this.catsEl.addEventListener('scroll', () => this._edgeFade(), { passive: true });

    this.listEl.addEventListener('click', (e) => {
      const card = e.target.closest('.card-sound');
      if (!card) return;
      const type = card.dataset.type;
      if (e.target.closest('.card-preview')) { this.audition(type, e.target.closest('.card-preview')); return; }
      this.add(type);
    });

    this.listEl.addEventListener('dragstart', (e) => {
      const card = e.target.closest('.card-sound');
      if (!card || !e.dataTransfer) return;
      e.dataTransfer.setData('text/plain', card.dataset.type);
      e.dataTransfer.effectAllowed = 'copy';
      card.classList.add('is-dragging');
    });
    this.listEl.addEventListener('dragend', (e) => {
      const card = e.target.closest('.card-sound');
      if (card) card.classList.remove('is-dragging');
    });

    this.fileEl.addEventListener('change', () => {
      const file = this.fileEl.files && this.fileEl.files[0];
      if (file && this.callbacks.onUpload) this.callbacks.onUpload(file);
      this.fileEl.value = '';
    });
  }

  add(type) {
    if (this.callbacks.onAdd) this.callbacks.onAdd(type);
  }

  /**
   * Preview a sound without placing it. Only one preview runs at a time, so the
   * previous button has to be reset here: clearing its timer would otherwise
   * leave it stuck showing the stop icon.
   */
  async audition(type, btn) {
    clearTimeout(this._previewTimer);
    this._resetPreviewButton();
    this._previewBtn = btn || null;
    if (btn) {
      btn.innerHTML = icon('stop', { size: 11 });
      btn.classList.add('is-on');
      btn.setAttribute('aria-pressed', 'true');
    }
    try {
      const def = getSound(type);
      await this.audioEngine.previewSound(type, def.url);
    } catch (e) {
      console.warn('Audition failed', type, e);
    }
    this._previewTimer = setTimeout(() => this._resetPreviewButton(), 4200);
  }

  _resetPreviewButton() {
    const btn = this._previewBtn;
    if (!btn) return;
    btn.innerHTML = icon('play', { size: 11 });
    btn.classList.remove('is-on');
    btn.setAttribute('aria-pressed', 'false');
    this._previewBtn = null;
  }

  /** Register a decoded user upload so it shows up under "Your files". */
  addCustomSound(entry) {
    this.customSounds.push(entry);
    this.category = 'custom';
    this.render();
  }

  _entries() {
    if (this.query) {
      const q = this.query;
      return this._all().filter(s => {
        const name = (s.nameKey ? t(s.nameKey) : s.name || s.type).toLowerCase();
        return name.includes(q) || (s.desc || '').toLowerCase().includes(q) || s.type.toLowerCase().includes(q);
      });
    }
    if (this.category === 'custom') return this.customSounds;
    return soundsByCategory(this.category);
  }

  _all() { return [...SOUNDS, ...this.customSounds]; }

  render() {
    this.catsEl.innerHTML = CATEGORIES.map(c => `
      <button class="lib-cat${c.id === this.category ? ' is-on' : ''}" data-cat="${c.id}" role="tab" aria-selected="${c.id === this.category}">
        ${icon(c.icon, { size: 15 })}<span>${t(c.nameKey)}</span>
      </button>
    `).join('');
    this._revealActiveCat();
    this.renderList();
  }

  /**
   * Scrolls the active category button into the strip's visible range and marks
   * whether the strip overflows. Needed because the category can be set from
   * code (an upload switches to "custom", the last tab), which would otherwise
   * leave the panel with no visible active tab.
   */
  _revealActiveCat() {
    const el = this.catsEl;
    if (!el) return;
    const view = el.clientWidth;
    if (!view || el.scrollWidth <= view) {
      el.classList.remove('is-scrollable', 'at-end');
      return;
    }
    el.classList.add('is-scrollable');
    const btn = el.querySelector('.lib-cat.is-on');
    if (btn) {
      const left = btn.offsetLeft;
      const right = left + btn.offsetWidth;
      if (left < el.scrollLeft) el.scrollLeft = Math.max(0, left - 10);
      else if (right > el.scrollLeft + view) el.scrollLeft = right - view + 10;
    }
    this._edgeFade();
  }

  /** Drops the right-edge fade once the strip is scrolled to its end. */
  _edgeFade() {
    const el = this.catsEl;
    if (!el) return;
    el.classList.toggle('at-end', el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
  }

  renderList() {
    const entries = this._entries();
    if (entries.length === 0) {
      this.listEl.innerHTML = `<p class="empty-note">${this.category === 'custom' && !this.query ? t('uploadAudio') : t('noResults')}</p>`;
      return;
    }
    this.listEl.innerHTML = entries.map(s => {
      const name = s.nameKey ? t(s.nameKey) : (s.name || s.type);
      const meta = describeMeta(s);
      const evidence = s.evidence ? `<span class="tag tag-${s.evidence}">${t(`evidence${cap(s.evidence)}`)}</span>` : '';
      const note = s.noteKey ? `<span class="card-note">${escapeHtml(t(s.noteKey))}</span>` : '';
      return `
        <article class="card-sound" data-type="${escapeHtml(s.type)}" draggable="true">
          <span class="card-glyph" style="--tint:${escapeHtml(s.color)}">${icon(s.glyph || 'file', { size: 17 })}</span>
          <span class="card-body">
            <span class="card-name">${escapeHtml(name)}</span>
            <span class="card-desc">${escapeHtml(s.desc || '')}</span>
            <span class="card-meta">${meta}${evidence}</span>
            ${note}
          </span>
          <button class="card-preview icon-btn" title="${escapeAttr(named('previewNamed', name))}" aria-label="${escapeAttr(named('previewNamed', name))}">${icon('play', { size: 11 })}</button>
          <button class="card-add icon-btn" title="${escapeAttr(named('addNamed', name))}" aria-label="${escapeAttr(named('addNamed', name))}">${icon('plus', { size: 13 })}</button>
        </article>`;
    }).join('');
  }

  /** Re-render after a language switch. */
  refresh() { this.render(); }
}

/**
 * "Add Birdsong" rather than sixty buttons all called "Add sound".
 * Every card carried the same accessible name, so a screen reader could not
 * tell which sound a button belonged to, and the card itself was a focusable
 * article that did nothing on Enter.
 */
function named(key, name) {
  return t(key).replace('{name}', name);
}

function escapeAttr(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function describeMeta(s) {
  const bits = [];
  if (s.params) {
    if (s.params.beat !== undefined) bits.push(`${s.params.beat} Hz beat`);
    else if (s.params.freq !== undefined) bits.push(`${s.params.freq} Hz`);
    else if (s.params.carrier !== undefined) bits.push(`${s.params.carrier} Hz`);
    else if (s.params.color) bits.push(`${s.params.color} noise`);
    else if (s.params.bpm !== undefined) bits.push(`${s.params.bpm} / min`);
  }
  if (s.spatial === false) bits.push('head-locked');
  return bits.map(b => `<span class="tag">${escapeHtml(b)}</span>`).join('');
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
