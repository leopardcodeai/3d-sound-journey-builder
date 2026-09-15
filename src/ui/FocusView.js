/**
 * FocusView
 * The simple view: one screen, one big control, no map and no timeline. It is
 * meant for sessions that are only frequencies and texture, in the spirit of a
 * plain focus player. The same audio engine and the same sources back it, so
 * switching to the field mid-session keeps everything playing.
 */
import { MODES, MODE_ORDER, phaseAt, sessionPhases, modeForHour } from '../data/Presets.js';
import { getSound, soundName, bandForBeat, SOLFEGGIO } from '../data/SoundLibrary.js';
import { GENERATORS } from '../audio/Generators.js';
import { icon } from './Icons.js';
import { CircleField } from './CircleField.js';
import { syncRangeFills } from './sliders.js';
import { t } from '../i18n.js';

/** "Remove Singing bowl" rather than five buttons all called "Remove". */
function named(key, name) {
  return t(key).replace('{name}', name);
}

const LENGTHS = [10, 20, 25, 45, 60, 90];

export class FocusView {
  /**
   * @param {HTMLElement} root
   * @param {SpatialAudioEngine} audioEngine
   * @param {Object} callbacks { onOpenField, onSourcesChanged, onStart }
   */
  constructor(root, audioEngine, callbacks = {}) {
    this.root = root;
    this.audioEngine = audioEngine;
    this.callbacks = callbacks;
    this.modeId = null;
    this.minutes = 25;
    this.running = false;
    this.startedAt = 0;
    this.elapsed = 0;
    this.visible = false;
    this._tickTimer = null;

    this._build();
    this._bind();
  }

  _build() {
    this.root.innerHTML = `
      <div class="focus-wrap">
        <header class="focus-head">
          <h1 class="focus-title" data-i18n="focusTitle">Focus session</h1>
          <p class="focus-sub" data-i18n="focusHelp"></p>
          <button class="focus-bare-btn" data-i18n-title="hideInterface">
            ${icon('focus', { size: 14 })}<span data-i18n="hideInterface">Hide interface</span>
          </button>
        </header>

        <div class="focus-modes" role="tablist">
          ${MODE_ORDER.map(id => {
            const m = MODES[id];
            return `<button class="focus-mode" data-mode="${id}" role="tab">
              <span class="focus-mode-icon">${icon(m.icon, { size: 18 })}</span>
              <span class="focus-mode-name">${m.name}</span>
              <span class="focus-mode-sum">${m.summary}</span>
            </button>`;
          }).join('')}
        </div>

        <div class="focus-stage">
          <canvas class="focus-field" aria-hidden="true"></canvas>
          <button class="focus-orb" aria-label="Play">
            <svg class="focus-ring" viewBox="0 0 220 220" aria-hidden="true">
              <circle class="focus-ring-track" cx="110" cy="110" r="100" />
              <circle class="focus-ring-progress" cx="110" cy="110" r="100" />
              <circle class="focus-ring-breath" cx="110" cy="110" r="72" />
            </svg>
            <span class="focus-orb-icon">${icon('play', { size: 34 })}</span>
            <span class="focus-orb-time mono">00:00</span>
          </button>
          <p class="focus-phase"></p>
          <p class="focus-bare-hint" data-i18n="bareHint"></p>
        </div>

        <div class="focus-readout"></div>

        <div class="focus-controls">
          <div class="focus-lengths">
            <span class="focus-label" data-i18n="sessionLength">Length</span>
            <p class="note focus-length-note" data-i18n="sessionLengthHelp"></p>
            <div class="chips focus-length-chips">
              ${LENGTHS.map(min => `<button class="chip" data-minutes="${min}" aria-label="${escapeHtml(t('minutesLong').replace('{n}', min))}">${min}</button>`).join('')}
            </div>
          </div>
          <div class="focus-layers"></div>
        </div>

        <footer class="focus-foot">
          <button class="btn btn-ghost focus-open-field">${icon('map', { size: 14 })}<span data-i18n="openInField">Open in the field</span></button>
        </footer>
      </div>
    `;
    this.bareBtn = this.root.querySelector('.focus-bare-btn');
    this.fieldEl = this.root.querySelector('.focus-field');
    this.orbEl = this.root.querySelector('.focus-orb');
    this.orbIcon = this.root.querySelector('.focus-orb-icon');
    this.orbTime = this.root.querySelector('.focus-orb-time');
    this.ringProgress = this.root.querySelector('.focus-ring-progress');
    this.ringBreath = this.root.querySelector('.focus-ring-breath');
    this.readoutEl = this.root.querySelector('.focus-readout');
    this.layersEl = this.root.querySelector('.focus-layers');
    this.phaseEl = this.root.querySelector('.focus-phase');
    this._ringLength = 2 * Math.PI * 100;
    this.ringProgress.style.strokeDasharray = String(this._ringLength);
    this.ringProgress.style.strokeDashoffset = String(this._ringLength);
  }

  _bind() {
    this.root.querySelector('.focus-modes').addEventListener('click', (e) => {
      const btn = e.target.closest('.focus-mode');
      if (btn) this.applyMode(btn.dataset.mode);
    });
    this.orbEl.addEventListener('click', () => this.toggle());

    this.bareBtn.addEventListener('click', (e) => {
      // Without this the click bubbles to the root handler below, which sees
      // bare mode already on and turns it straight back off.
      e.stopPropagation();
      this.setBare(true);
    });
    // Leaving is deliberately easy: anything but the orb brings the interface
    // back. A mode you cannot get out of is worse than no mode.
    this.root.addEventListener('click', (e) => {
      if (!this.bare) return;
      if (e.target.closest('.focus-orb') || e.target.closest('.focus-bare-btn')) return;
      this.setBare(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.bare) { this.setBare(false); e.stopPropagation(); }
    });
    this.root.querySelector('.focus-length-chips').addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      this.minutes = parseInt(chip.dataset.minutes, 10);
      this._renderLengths();
    });
    this.root.querySelector('.focus-open-field').addEventListener('click', () => {
      if (this.callbacks.onOpenField) this.callbacks.onOpenField();
    });
    this.layersEl.addEventListener('input', (e) => {
      const input = e.target.closest('[data-id][data-key]');
      if (!input) return;
      const id = input.dataset.id;
      const key = input.dataset.key;
      const value = input.tagName === 'SELECT' ? input.value : parseFloat(input.value);
      if (key === 'volume') this.audioEngine.updateSourceVolume(id, value);
      else this.audioEngine.setSourceParam(id, key, value);
      const out = input.parentElement.querySelector('output');
      if (out) out.textContent = key === 'volume' ? `${Math.round(value * 100)}%` : formatParam(key, value);
      this.renderReadout();
    });
    this.layersEl.addEventListener('click', (e) => {
      const solf = e.target.closest('.solf-btn');
      if (solf) {
        this.audioEngine.setSourceParam(solf.dataset.id, 'freq', parseFloat(solf.dataset.freq));
        this.renderLayers();
        this.renderReadout();
        return;
      }
      const rm = e.target.closest('.focus-layer-remove');
      if (rm) {
        this.audioEngine.removeSource(rm.dataset.id);
        this.renderLayers();
        this.renderReadout();
      }
    });
  }

  // ------------------------------------------------------------------

  /**
   * Strips the screen back to the orb, the phase line and the field.
   *
   * Endel ships this as an explicit "Hide interface" button and Calm fades its
   * chrome after fifteen idle seconds. The button is the honest version: an
   * interface that vanishes on its own reads as a fault the first time it
   * happens. Leaving is a click anywhere or Escape.
   */
  setBare(on) {
    this.bare = !!on;
    this.root.classList.toggle('is-bare', this.bare);
    document.body.classList.toggle('focus-bare', this.bare);
  }

  show() {
    this.visible = true;
    this.root.hidden = false;
    this.root.classList.add('is-visible');
    this.renderModes();
    this._renderLengths();
    this.renderLayers();
    this.renderReadout();
    // The canvas has no box while the view is hidden, so the field is built and
    // measured on first show rather than in the constructor.
    if (!this.field && this.fieldEl) {
      this.field = new CircleField(this.fieldEl, { colour: '242, 140, 96' });
    }
    if (this.field) {
      this.field.resize();
      this.field.setIntensity(this.running ? 1 : 0);
      this.field.start();
    }
  }

  hide() {
    this.visible = false;
    this.root.hidden = true;
    this.root.classList.remove('is-visible');
    // A hidden canvas still costs a frame each tick, so the loop stops with it.
    if (this.field) this.field.stop();
    // The session kept running after the view was gone, so its taper later
    // faded out whatever the field had loaded in the meantime.
    if (this.running) this.pause();
  }

  /**
   * Replace the current session with a mode: clears sources, adds the layers.
   */
  async applyMode(modeId) {
    const mode = MODES[modeId];
    if (!mode) return;
    this.modeId = modeId;
    this.minutes = mode.minutes;
    if (!this.audioEngine.isInitialized) this.audioEngine.init();
    await this.audioEngine.resume();

    for (const id of [...this.audioEngine.sources.keys()]) this.audioEngine.removeSource(id);
    this.audioEngine.setMasterVolume(mode.masterVolume);

    this._baseParams = new Map();
    mode.layers.forEach((layer, i) => {
      const def = getSound(layer.type);
      const id = `focus_${modeId}_${i}`;
      const src = this.audioEngine.addSource(id, layer.type, soundName(layer.type), 0, 0, 0, layer.volume, {
        params: { ...(def.params || {}), ...(layer.params || {}) },
      });
      if (src) this._baseParams.set(id, { ...src.params });
    });
    this._tapered = false;
    // A session that was interrupted mid-fade would otherwise leave this set,
    // and the next one would never ramp down.
    this._fadeStarted = false;
    this.elapsed = 0;

    this.renderModes();
    this._renderLengths();
    this.renderLayers();
    this.renderReadout();
    if (this.callbacks.onSourcesChanged) this.callbacks.onSourcesChanged();
    this.start();
  }

  toggle() { this.running ? this.pause() : this.start(); }

  start() {
    if (this.audioEngine.sources.size === 0) {
      this.applyMode(this.modeId || 'focus');
      return;
    }
    this.audioEngine.resume();
    this.running = true;
    this.startedAt = Date.now() - this.elapsed * 1000;
    this.orbEl.classList.add('is-running');
    this.orbIcon.innerHTML = icon('pause', { size: 30 });
    if (this.field) this.field.setIntensity(1);
    for (const [id, src] of this.audioEngine.sources) if (!src.isPlaying) this.audioEngine.toggleSource(id);
    if (this.callbacks.onStart) this.callbacks.onStart();
    clearInterval(this._tickTimer);
    this._tickTimer = setInterval(() => this._tick(), 250);
  }

  pause() {
    this.running = false;
    // Pausing during a fade abandons that ramp, so the flag goes with it.
    if (this._fadeStarted) {
      this._fadeStarted = false;
      const mode = this.modeId ? MODES[this.modeId] : null;
      if (mode && this.audioEngine.masterGain && this.audioEngine.ctx) {
        const g = this.audioEngine.masterGain.gain;
        g.cancelScheduledValues(this.audioEngine.ctx.currentTime);
        g.setValueAtTime(mode.masterVolume, this.audioEngine.ctx.currentTime);
      }
    }
    this.orbEl.classList.remove('is-running');
    this.orbIcon.innerHTML = icon('play', { size: 34 });
    if (this.field) this.field.setIntensity(0);
    for (const [id, src] of this.audioEngine.sources) if (src.isPlaying) this.audioEngine.toggleSource(id);
    clearInterval(this._tickTimer);
    this._tickTimer = null;
  }

  reset() {
    this.pause();
    this.elapsed = 0;
    this._tick();
  }

  _tick() {
    if (this.running) this.elapsed = (Date.now() - this.startedAt) / 1000;
    const total = this.minutes * 60;
    const progress = Math.min(1, this.elapsed / total);
    this.ringProgress.style.strokeDashoffset = String(this._ringLength * (1 - progress));
    this.orbTime.textContent = fmtClock(this.running || this.elapsed > 0 ? total - this.elapsed : total);
    const mode = this.modeId ? MODES[this.modeId] : null;

    if (mode && this.running) {
      const left = total - this.elapsed;
      const phase = phaseAt(mode, this.minutes, this.elapsed);
      this.phaseEl.textContent = `${t(phase.id)} · ${t('remaining')} ${fmtClock(left)}`;

      if (phase.id === 'windDown') {
        if (mode.taper) this._applyTaper(phase.progress);
        if (mode.fadeOut && this.audioEngine.masterGain && !this._fadeStarted) {
          this._fadeStarted = true;
          const ctx = this.audioEngine.ctx;
          const g = this.audioEngine.masterGain.gain;
          g.cancelScheduledValues(ctx.currentTime);
          g.setValueAtTime(g.value, ctx.currentTime);
          g.linearRampToValueAtTime(0.0001, ctx.currentTime + Math.max(1, left));
        }
      }
    } else if (!this.running) {
      this.phaseEl.textContent = mode ? mode.summary : '';
    }

    if (this.elapsed >= total) {
      this.pause();
      this.elapsed = 0;
      this._fadeStarted = false;
      this._restoreParams();
      if (this.audioEngine.masterGain && mode) this.audioEngine.setMasterVolume(mode.masterVolume);
      this._tick();
    }
  }

  /**
   * During the wind-down, move every generator toward its calmer end: a slower
   * beat, a darker noise, a duller pad. `p` runs 0 to 1 across the phase.
   */
  _applyTaper(p) {
    if (!this._baseParams) return;
    const k = Math.min(1, Math.max(0, p));
    const lerp = (a, b) => a + (b - a) * k;
    for (const [id, base] of this._baseParams.entries()) {
      const src = this.audioEngine.sources.get(id);
      if (!src) continue;
      if (base.beat !== undefined) this.audioEngine.setSourceParam(id, 'beat', round2(lerp(base.beat, Math.max(1.5, base.beat * 0.3))));
      if (base.cutoff !== undefined) this.audioEngine.setSourceParam(id, 'cutoff', Math.round(lerp(base.cutoff, 900)));
      if (base.brightness !== undefined) this.audioEngine.setSourceParam(id, 'brightness', round2(lerp(base.brightness, 0.08)));
      if (base.movement !== undefined) this.audioEngine.setSourceParam(id, 'movement', round2(lerp(base.movement, 0.08)));
      if (base.bpm !== undefined) this.audioEngine.setSourceParam(id, 'bpm', round2(lerp(base.bpm, 4.5)));
    }
    this._tapered = true;
    this.renderReadout();
  }

  _restoreParams() {
    if (!this._tapered || !this._baseParams) return;
    for (const [id, base] of this._baseParams.entries()) {
      if (!this.audioEngine.sources.has(id)) continue;
      for (const [key, value] of Object.entries(base)) this.audioEngine.setSourceParam(id, key, value);
    }
    this._tapered = false;
    this.renderLayers();
    this.renderReadout();
  }

  /** Per-frame visuals: the breath ring follows a breath generator if present. */
  update() {
    if (!this.visible) return;
    const session = this.audioEngine.describeSession ? this.audioEngine.describeSession() : { breath: null };
    let scale = 1;
    if (session.breath && session.breath.generator && session.breath.generator.phase) {
      const p = session.breath.generator.phase();
      const inhale = session.breath.params.inhale || 0.45;
      const amount = p < inhale ? p / inhale : 1 - (p - inhale) / (1 - inhale);
      scale = 0.72 + amount * 0.34;
      this.ringBreath.style.opacity = '0.8';
      const label = p < inhale ? t('inhale') : t('exhale');
      if (this.running) this.phaseEl.textContent = `${label} · ${fmtClock(this.minutes * 60 - this.elapsed)}`;
    } else {
      const levels = this.audioEngine.getLeftRightLevels();
      scale = 0.9 + Math.max(levels.left, levels.right) * 0.18;
      this.ringBreath.style.opacity = '0.35';
    }
    this.ringBreath.setAttribute('r', String(72 * scale));
  }

  // ------------------------------------------------------------------
  // Rendering
  // ------------------------------------------------------------------

  renderModes() {
    const suggested = modeForHour(new Date().getHours());
    this.root.querySelectorAll('.focus-mode').forEach(btn => {
      const on = btn.dataset.mode === this.modeId;
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-selected', on);
      btn.classList.toggle('is-suggested', btn.dataset.mode === suggested);
      let badge = btn.querySelector('.focus-mode-badge');
      if (btn.dataset.mode === suggested) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'focus-mode-badge';
          btn.appendChild(badge);
        }
        badge.textContent = t('suggested');
      } else if (badge) {
        badge.remove();
      }
    });
  }

  _renderLengths() {
    this.root.querySelectorAll('.focus-length-chips .chip').forEach(chip => {
      chip.classList.toggle('is-on', parseInt(chip.dataset.minutes, 10) === this.minutes);
    });
    this._tick();
  }

  renderReadout() {
    const session = this.audioEngine.describeSession ? this.audioEngine.describeSession() : { frequency: [], ambient: [] };
    const cells = [];
    for (const src of session.frequency) {
      const p = src.params || {};
      if (p.beat !== undefined) {
        const band = bandForBeat(p.beat);
        cells.push(cell(t(band.nameKey), `${Number(p.beat).toFixed(1)} Hz`, `${t('carrierFrequency')} ${Math.round(p.carrier || 0)} Hz`));
      } else if (p.freq !== undefined) {
        cells.push(cell(t('toneFrequency'), `${Number(p.freq).toFixed(1)} Hz`, soundName(src.type)));
      } else if (p.color) {
        cells.push(cell(t('noiseColor'), p.color, `${Math.round(p.cutoff || 0)} Hz`));
      } else if (p.bpm !== undefined) {
        cells.push(cell(t('breathRate'), `${p.bpm}`, `${(60 / p.bpm).toFixed(1)} s`));
      }
    }
    // This cell counts the texture bed only, while the list further down shows
    // every layer including the beat and the breath pacer. Both were labelled
    // "Layers", so the readout said 3 with 5 rows underneath and nothing
    // explained the difference. Same numbers, different word.
    if (session.ambient.length) cells.push(cell(t('textureLayers'), String(session.ambient.length), session.ambient.map(s => s.name).join(', ')));
    this.readoutEl.innerHTML = cells.join('') || `<p class="note">${t('focusHelp')}</p>`;
  }

  renderLayers() {
    const sources = [...this.audioEngine.sources.values()];
    if (!sources.length) { this.layersEl.innerHTML = ''; return; }
    this.layersEl.innerHTML = `<span class="focus-label">${t('layers')}</span>` + sources.map(src => {
      const def = getSound(src.type);
      const gen = src.gen && GENERATORS[src.gen];
      const main = gen ? gen.controls[0] : null;
      const mainValue = main ? src.params[main.key] : null;
      const layerName = src.name || soundName(src.type);
      return `
        <div class="focus-layer">
          <span class="focus-layer-glyph" style="--tint:${escapeHtml(def.color)}">${icon(def.glyph || 'file', { size: 15 })}</span>
          <span class="focus-layer-name">${escapeHtml(layerName)}</span>
          <label class="focus-layer-ctl">
            <input type="range" data-id="${escapeHtml(src.id)}" data-key="volume" min="0" max="1" step="0.01" value="${src.volume}"
                   aria-label="${escapeHtml(named('volumeNamed', layerName))}" />
            <output class="mono">${Math.round(src.volume * 100)}%</output>
          </label>
          ${main ? layerControl(src.id, main, mainValue, layerName) : ''}
          ${src.gen === 'tone' ? `<div class="chips">${SOLFEGGIO.slice(0, 5).map(f => `<button class="chip solf-btn" data-id="${escapeHtml(src.id)}" data-freq="${f}" aria-label="${escapeHtml(`${f} Hz`)}">${f}</button>`).join('')}</div>` : ''}
          <button class="icon-btn focus-layer-remove" data-id="${escapeHtml(src.id)}" title="${escapeHtml(named('removeNamed', layerName))}" aria-label="${escapeHtml(named('removeNamed', layerName))}">${icon('close', { size: 12 })}</button>
        </div>`;
    }).join('');
    syncRangeFills(this.layersEl);
  }
}

function cell(label, value, sub) {
  return `<div class="stat"><span class="stat-label">${escapeHtml(label)}</span><span class="stat-value mono">${escapeHtml(value)}</span><span class="stat-sub">${escapeHtml(sub || '')}</span></div>`;
}

/**
 * One control per layer. A parameter with a fixed set of options (noise colour,
 * chord) needs a select; a numeric one gets a range. Feeding a range with an
 * option value would show NaN.
 */
function layerControl(id, ctl, value, layerName) {
  // Both controls carry the sound and the parameter, e.g. "Pink noise Low-pass".
  // Nine sliders in this view had no accessible name at all, so a screen reader
  // announced a row of bare values with nothing to attach them to.
  const label = layerName ? `${layerName} ${ctl.label}` : ctl.label;
  if (ctl.options) {
    return `<label class="focus-layer-ctl">
      <select class="input" data-id="${escapeHtml(id)}" data-key="${escapeHtml(ctl.key)}" aria-label="${escapeHtml(label)}">
        ${ctl.options.map(o => `<option value="${o}"${o === value ? ' selected' : ''}>${escapeHtml(o)}</option>`).join('')}
      </select>
    </label>`;
  }
  return `<label class="focus-layer-ctl">
    <input type="range" data-id="${escapeHtml(id)}" data-key="${escapeHtml(ctl.key)}" min="${ctl.min}" max="${ctl.max}" step="${ctl.step}" value="${value}"
           aria-label="${escapeHtml(label)}" />
    <output class="mono">${formatParam(ctl.key, value)}</output>
  </label>`;
}

function formatParam(key, value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (key === 'beat' || key === 'freq' || key === 'carrier' || key === 'cutoff') return `${Number(value).toFixed(key === 'beat' ? 1 : 0)} Hz`;
  if (key === 'bpm') return `${value}/min`;
  return String(Math.round(value * 100) / 100);
}

function round2(v) { return Math.round(v * 100) / 100; }

function fmtClock(sec) {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
