/**
 * Inspector
 * The right panel. Four tabs for the selected sound:
 *   Sound  level, generator parameters, filters, tremolo, room send
 *   Space  distance, direction, height (head-locked sources say so instead)
 *   Motion orbit / ping-pong / drift / breathe with speed and radius
 *   Time   clip window, fades, repeat, keyframes
 * Every committed change goes through the undo stack.
 */
import { GENERATORS } from '../audio/Generators.js';
import { getSound, soundName, SOLFEGGIO, bandForBeat } from '../data/SoundLibrary.js';
import { icon } from './Icons.js';
import { syncRangeFills } from './sliders.js';
import { t } from '../i18n.js';
import { Command, createVolumeCommand, createParamCommand, createAutomationCommand, createDeleteCommand } from '../core/UndoManager.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** Binaural entries and the isochronic entry that carries the same band. */
const ISOCHRONIC_FOR = {
  bw_theta: 'iso_theta',
  bw_alpha: 'iso_alpha',
  bw_gamma: 'iso_gamma',
};

const TABS = [
  { id: 'sound', labelKey: 'tabSound', icon: 'volume' },
  { id: 'space', labelKey: 'tabSpace', icon: 'map' },
  { id: 'motion', labelKey: 'tabMotion', icon: 'orbit' },
  { id: 'time', labelKey: 'tabTime', icon: 'clock' },
];

const MOTIONS = [
  { id: 'orbit', labelKey: 'orbit', icon: 'orbit' },
  { id: 'pingpong', labelKey: 'pingpong', icon: 'pingpong' },
  { id: 'drift', labelKey: 'drift', icon: 'drift' },
  { id: 'breathe', labelKey: 'breathe', icon: 'breathe' },
];

export class Inspector {
  constructor(root, audioEngine, canvasGrid, timeline, undoManager) {
    this.root = root;
    this.audioEngine = audioEngine;
    this.canvasGrid = canvasGrid;
    this.timeline = timeline;
    this.undoManager = undoManager;
    this.tab = 'sound';
    this.nodeId = null;
    this._commitStart = null;
    this._commitKey = null;

    this._build();
    this._bind();
    this.show(null);
  }

  _build() {
    this.root.innerHTML = `
      <div class="panel-head">
        <h2 class="panel-title" data-i18n="properties">Properties</h2>
        <button class="icon-btn insp-close" data-i18n-title="close">${icon('close', { size: 14 })}</button>
      </div>
      <div class="insp-empty">
        <span class="insp-empty-glyph">${icon('focus', { size: 26 })}</span>
        <p data-i18n="selectNode"></p>
      </div>
      <div class="insp-body" hidden>
        <header class="insp-id">
          <span class="insp-dot"></span>
          <input class="insp-name input" type="text" maxlength="32" />
          <span class="insp-kind mono"></span>
        </header>
        <nav class="insp-tabs" role="tablist">
          ${TABS.map(tab => `<button class="insp-tab" data-tab="${tab.id}" role="tab">${icon(tab.icon, { size: 14 })}<span>${t(tab.labelKey)}</span></button>`).join('')}
        </nav>
        <div class="insp-pane"></div>
        <footer class="insp-foot">
          <button class="btn btn-ghost insp-mute">${icon('mute', { size: 13 })}<span data-i18n="muteSound">Mute</span></button>
          <button class="btn btn-danger insp-remove">${icon('trash', { size: 13 })}<span data-i18n="removeSound">Remove</span></button>
        </footer>
      </div>
    `;
    this.emptyEl = this.root.querySelector('.insp-empty');
    this.bodyEl = this.root.querySelector('.insp-body');
    this.paneEl = this.root.querySelector('.insp-pane');
    this.nameEl = this.root.querySelector('.insp-name');
    this.kindEl = this.root.querySelector('.insp-kind');
    this.dotEl = this.root.querySelector('.insp-dot');
  }

  _bind() {
    this.root.querySelector('.insp-close').addEventListener('click', () => {
      this.canvasGrid.selectedNodeId = null;
      this.show(null);
    });

    this.root.querySelector('.insp-tabs').addEventListener('click', (e) => {
      const btn = e.target.closest('.insp-tab');
      if (!btn) return;
      this.tab = btn.dataset.tab;
      this._renderTabs();
      this._renderPane();
    });

    this.nameEl.addEventListener('change', () => {
      if (!this.nodeId) return;
      this.audioEngine.renameSource(this.nodeId, this.nameEl.value.trim() || soundName(this.audioEngine.sources.get(this.nodeId).type));
      if (this.timeline && this.timeline.visible) this.timeline._render();
    });

    this.root.querySelector('.insp-remove').addEventListener('click', () => this._remove());
    this.root.querySelector('.insp-mute').addEventListener('click', () => {
      if (!this.nodeId || !this.timeline) return;
      const muted = this.timeline.toggleMute(this.nodeId);
      this.root.querySelector('.insp-mute').classList.toggle('is-on', muted);
    });

    // Delegated control handling: ranges commit on change, selects on change.
    this.paneEl.addEventListener('input', (e) => this._onControl(e, false));
    this.paneEl.addEventListener('change', (e) => this._onControl(e, true));
    // Remember the value a gesture starts from, so the change event can push a
    // single undo entry. Keyboard users get the same through focusin.
    const rememberStart = (e) => {
      const input = e.target.closest && e.target.closest('input[type="range"]');
      if (!input) return;
      // The key travels with the value: a commit must only use a start value
      // that was captured from the same control.
      this._commitKey = input.dataset.key;
      this._commitStart = this._readValue(this._commitKey);
    };
    this.paneEl.addEventListener('pointerdown', rememberStart);
    this.paneEl.addEventListener('focusin', rememberStart);
    this.paneEl.addEventListener('click', (e) => {
      const motion = e.target.closest('.motion-btn');
      if (motion) { this._setMotion(motion.dataset.motion); return; }
      const kf = e.target.closest('.insp-add-kf');
      if (kf && this.timeline) { this.timeline.addKeyframeAt(this.nodeId, this.timeline.playheadTime); this._renderPane(); return; }
      const solf = e.target.closest('.solf-btn');
      if (solf) {
        this._clearStart();
        this._remember('freq', this._readValue('freq'));
        this._apply('freq', parseFloat(solf.dataset.freq), true);
        this._renderPane();
        return;
      }
      if (e.target.closest('.insp-to-iso')) this._convertToIsochronic();
    });
  }

  // ------------------------------------------------------------------
  // Selection
  // ------------------------------------------------------------------

  show(node) {
    if (!node || node.id !== this.nodeId) { this._clearStart(); this._lastValues = {}; }
    this.nodeId = node ? node.id : null;
    const has = !!node;
    this.emptyEl.hidden = has;
    this.bodyEl.hidden = !has;
    this.root.classList.toggle('is-empty', !has);
    if (!has) return;

    const def = getSound(node.type);
    this.nameEl.value = node.name || soundName(node.type);
    this.kindEl.textContent = def.kind === 'generator' ? (node.gen || def.gen || '') : (def.category || '');
    this.dotEl.style.background = this.canvasGrid.colorFor(node.type);
    const state = this.timeline ? this.timeline.state(node.id) : { muted: false };
    this.root.querySelector('.insp-mute').classList.toggle('is-on', !!state.muted);
    this._renderTabs();
    this._renderPane();
  }

  /** Refresh the live readouts without rebuilding the pane. */
  update(node) {
    if (!node || node.id !== this.nodeId) return;
    this.paneEl.querySelectorAll('[data-live]').forEach(el => {
      el.textContent = this._liveValue(el.dataset.live, node);
    });
    const dist = this.paneEl.querySelector('[data-key="distance"]');
    if (dist && document.activeElement !== dist) dist.value = Math.hypot(node.x, node.y);
    const az = this.paneEl.querySelector('[data-key="azimuth"]');
    if (az && document.activeElement !== az) az.value = azimuthOf(node);
  }

  _node() { return this.nodeId ? this.audioEngine.sources.get(this.nodeId) : null; }

  _renderTabs() {
    const node = this._node();
    const locked = node && node.spatial === false;
    this.root.querySelectorAll('.insp-tab').forEach(btn => {
      btn.classList.toggle('is-on', btn.dataset.tab === this.tab);
      btn.setAttribute('aria-selected', btn.dataset.tab === this.tab);
      if (btn.dataset.tab === 'motion') btn.toggleAttribute('disabled', !!locked);
    });
    if (locked && this.tab === 'motion') this.tab = 'sound';
  }

  // ------------------------------------------------------------------
  // Panes
  // ------------------------------------------------------------------

  _renderPane() {
    const node = this._node();
    if (!node) return;
    const map = { sound: '_paneSound', space: '_paneSpace', motion: '_paneMotion', time: '_paneTime' };
    this.paneEl.innerHTML = this[map[this.tab] || '_paneSound'](node);
    syncRangeFills(this.paneEl);
  }

  _paneSound(node) {
    const def = getSound(node.type);
    const rows = [row({ key: 'volume', label: t('volume'), min: 0, max: 1.2, step: 0.01, value: node.volume, format: pct })];

    if (node.gen && GENERATORS[node.gen]) {
      for (const ctl of GENERATORS[node.gen].controls) {
        const value = node.params[ctl.key];
        if (ctl.options) {
          rows.push(select({ key: ctl.key, label: ctl.label, value, options: ctl.options }));
        } else {
          rows.push(row({ key: ctl.key, label: ctl.label, min: ctl.min, max: ctl.max, step: ctl.step, value, unit: ctl.unit }));
        }
      }
      if (node.params.beat !== undefined) {
        const band = bandForBeat(node.params.beat);
        rows.push(`<p class="note">${t(band.nameKey)} · ${band.min}–${band.max} Hz</p>`);
      }
      if (node.gen === 'tone') {
        rows.push(`<div class="chips">${SOLFEGGIO.map(f => `<button class="chip solf-btn" data-freq="${f}">${f}</button>`).join('')}</div>`);
      }
    }

    if (def.evidence) {
      const grade = t(`evidence${def.evidence.charAt(0).toUpperCase()}${def.evidence.slice(1)}`);
      const note = def.noteKey ? ` ${t(def.noteKey)}` : ` ${t('evidenceNote')}`;
      rows.push(`<p class="note note-${def.evidence}"><strong>${grade}.</strong>${note}</p>`);
    }

    // Binaural beats fall apart on speakers, so say so and offer the swap.
    if (node.gen === 'binaural') {
      rows.push(`<div class="callout callout-action">
        ${icon('headphones', { size: 15 })}
        <div>
          <strong>${t('headphoneCheck')}</strong>
          <p>${t('headphoneCheckHelp')}</p>
          <button class="btn btn-ghost insp-to-iso">${icon('pulse', { size: 13 })}<span>${t('switchToIsochronic')}</span></button>
        </div>
      </div>`);
    }

    if (node.kind === 'sample') {
      rows.push(section(t('tabSound')));
      rows.push(row({ key: 'lowpass', label: t('lowpass'), min: 200, max: 20000, step: 50, value: node.inserts.lowpass, unit: 'Hz' }));
      rows.push(row({ key: 'highpass', label: t('highpass'), min: 20, max: 4000, step: 10, value: node.inserts.highpass, unit: 'Hz' }));
      rows.push(row({ key: 'rate', label: t('playbackRate'), min: 0.5, max: 1.5, step: 0.01, value: node.inserts.rate, format: v => `${v.toFixed(2)}x` }));
      rows.push(row({ key: 'modRate', label: t('modRate'), min: 0, max: 20, step: 0.1, value: node.inserts.modRate, unit: 'Hz' }));
      rows.push(row({ key: 'modDepth', label: t('modDepth'), min: 0, max: 1, step: 0.01, value: node.inserts.modDepth, format: pct }));
    }
    rows.push(row({ key: 'reverb', label: t('reverbSend'), min: 0, max: 1, step: 0.01, value: node.inserts.reverb, format: pct }));
    return rows.join('');
  }

  _paneSpace(node) {
    if (node.spatial === false) {
      return `<div class="callout">${icon('lock', { size: 15 })}<div><strong>${t('headLocked')}</strong><p>${t('headLockedHelp')}</p></div></div>`;
    }
    const dist = Math.hypot(node.x, node.y);
    return [
      row({ key: 'distance', label: t('distance'), min: 0.2, max: 10, step: 0.1, value: dist, unit: 'm' }),
      row({ key: 'azimuth', label: t('azimuth'), min: -180, max: 180, step: 1, value: azimuthOf(node), unit: '°' }),
      row({ key: 'height', label: t('height'), min: -10, max: 10, step: 0.1, value: node.z, unit: 'm' }),
      `<dl class="readout">
        <div><dt>x</dt><dd data-live="x">${node.x.toFixed(2)}</dd></div>
        <div><dt>y</dt><dd data-live="y">${node.y.toFixed(2)}</dd></div>
        <div><dt>z</dt><dd data-live="z">${node.z.toFixed(2)}</dd></div>
        <div><dt>dist</dt><dd data-live="dist">${dist.toFixed(2)}</dd></div>
      </dl>`,
      `<p class="note">${t('dragHint')}</p>`,
    ].join('');
  }

  _paneMotion(node) {
    const auto = this.canvasGrid.automations.get(node.id);
    const buttons = MOTIONS.map(m => `
      <button class="motion-btn${auto && auto.type === m.id ? ' is-on' : ''}" data-motion="${m.id}">
        ${icon(m.icon, { size: 16 })}<span>${t(m.labelKey)}</span>
      </button>`).join('');
    const params = auto ? [
      row({ key: 'autoSpeed', label: t('speed'), min: 0.0002, max: 0.05, step: 0.0002, value: auto.speed, format: v => v.toFixed(4) }),
      row({ key: 'autoRadius', label: t('radius'), min: 1, max: 9.5, step: 0.1, value: auto.radius, unit: 'm' }),
    ].join('') : `<p class="note">${t('noMotion')}</p>`;
    return `<div class="motion-grid">${buttons}</div>${params}`;
  }

  _paneTime(node) {
    if (!this.timeline) return '';
    this.timeline.ensureTiming(node.id);
    const timing = this.timeline.sourceTimings.get(node.id);
    const kfs = this.timeline.keyframes.get(node.id) || [];
    return [
      row({ key: 'clipStart', label: t('clipStart'), min: 0, max: this.timeline.totalDuration, step: 1, value: timing.startTime, format: mmss }),
      row({ key: 'clipDuration', label: t('clipEnd'), min: 1, max: this.timeline.totalDuration, step: 1, value: timing.startTime + timing.duration, format: mmss }),
      row({ key: 'rampUp', label: t('rampUp'), min: 0, max: 60, step: 0.5, value: node.rampUp || 0, unit: 's' }),
      row({ key: 'rampDown', label: t('rampDown'), min: 0, max: 60, step: 0.5, value: node.rampDown || 0, unit: 's' }),
      row({ key: 'repeat', label: t('repeatEvery'), min: 0, max: 300, step: 5, value: node.repeatInterval || 0, format: v => (v > 0 ? `${v}s` : t('timerOff')) }),
      `<div class="kf-block">
        <div class="kf-head"><span>${t('keyframes')}</span><span class="mono">${kfs.length}</span></div>
        <button class="btn btn-ghost insp-add-kf">${icon('keyframe', { size: 13 })}<span>${t('addKeyframe')}</span></button>
      </div>`,
    ].join('');
  }

  // ------------------------------------------------------------------
  // Control handling
  // ------------------------------------------------------------------

  /** The captured start value, but only when it came from this same control. */
  _startFor(key) {
    return this._commitKey === key && this._commitStart !== null ? this._commitStart : null;
  }

  _clearStart() {
    this._commitStart = null;
    this._commitKey = null;
  }

  /** Last committed value per key, so a preset button still has something to undo to. */
  _remember(key, value) {
    if (!this._lastValues) this._lastValues = {};
    this._lastValues[key] = value;
  }

  _readValue(key) {
    const node = this._node();
    if (!node) return 0;
    switch (key) {
      case 'volume': return node.volume;
      case 'height': return node.z;
      case 'distance': return Math.hypot(node.x, node.y);
      case 'azimuth': return azimuthOf(node);
      case 'lowpass': case 'highpass': case 'rate': case 'modRate': case 'modDepth': case 'reverb':
        return node.inserts[key];
      default:
        if (node.params && node.params[key] !== undefined) return node.params[key];
        return 0;
    }
  }

  _onControl(e, commit) {
    const input = e.target.closest('[data-key]');
    if (!input || !this.nodeId) return;
    const key = input.dataset.key;
    const value = input.type === 'range' || input.type === 'number' ? parseFloat(input.value) : input.value;
    this._apply(key, value, commit);
    const out = input.parentElement && input.parentElement.querySelector('.ctl-value');
    if (out) out.textContent = formatFor(key, value, input.dataset.format, input.dataset.unit);
  }

  _apply(key, value, commit) {
    const node = this._node();
    if (!node) return;
    const engine = this.audioEngine;

    switch (key) {
      case 'volume':
        engine.updateSourceVolume(node.id, clamp(value, 0, 1.5));
        if (commit && this.undoManager && this._startFor('volume') !== null) {
          this.undoManager.execute(createVolumeCommand(engine, node.id, this._startFor('volume'), value));
          this._clearStart();
        }
        return;
      case 'height':
        engine.updateSourcePosition(node.id, node.x, node.y, value);
        return;
      case 'distance': {
        const a = Math.atan2(node.y, node.x);
        engine.updateSourcePosition(node.id, Math.cos(a) * value, Math.sin(a) * value, node.z);
        return;
      }
      case 'azimuth': {
        const r = Math.hypot(node.x, node.y) || 1;
        const rad = ((90 - value) * Math.PI) / 180;
        engine.updateSourcePosition(node.id, Math.cos(rad) * r, Math.sin(rad) * r, node.z);
        return;
      }
      case 'autoSpeed': case 'autoRadius': {
        const auto = this.canvasGrid.automations.get(node.id);
        if (!auto) return;
        auto[key === 'autoSpeed' ? 'speed' : 'radius'] = value;
        return;
      }
      case 'clipStart': {
        const timing = this.timeline.sourceTimings.get(node.id);
        const end = timing.startTime + timing.duration;
        timing.startTime = Math.min(value, end - 1);
        timing.duration = end - timing.startTime;
        this.timeline._render();
        return;
      }
      case 'clipDuration': {
        const timing = this.timeline.sourceTimings.get(node.id);
        timing.duration = Math.max(1, value - timing.startTime);
        this.timeline._render();
        return;
      }
      case 'rampUp':
        engine.setSourceRamp(node.id, value, node.rampDown || 0, node.repeatInterval || 0);
        return;
      case 'rampDown':
        engine.setSourceRamp(node.id, node.rampUp || 0, value, node.repeatInterval || 0);
        return;
      case 'repeat':
        engine.setSourceRamp(node.id, node.rampUp || 0, node.rampDown || 0, value);
        return;
      default: {
        const start = this._startFor(key);
        if (commit && this.undoManager && start !== null && start !== value) {
          this.undoManager.execute(createParamCommand(engine, node.id, key, start, value));
          this._clearStart();
        } else {
          engine.setSourceParam(node.id, key, value);
          // A direct commit with no matching gesture (a preset chip, say) still
          // records a step, using the value the control held a moment ago.
          if (commit && this.undoManager && start === null) {
            const previous = this._lastValues && this._lastValues[key];
            if (previous !== undefined && previous !== value) {
              this.undoManager.execute(createParamCommand(engine, node.id, key, previous, value));
            }
          }
        }
        this._remember(key, value);
      }
    }
  }

  _setMotion(type) {
    const node = this._node();
    if (!node) return;
    const grid = this.canvasGrid;
    const current = grid.automations.get(node.id);
    const old = current ? { ...current } : null;
    const next = current && current.type === type ? null : { type, speed: type === 'orbit' ? 0.004 : 0.001, radius: Math.max(1.5, Math.hypot(node.x, node.y)), baseX: node.x, baseY: node.y, baseVol: node.volume };
    if (this.undoManager) this.undoManager.execute(createAutomationCommand(grid, node.id, old, next));
    else if (next) grid.setAutomation(node.id, next.type, true, next);
    else grid.automations.delete(node.id);
    this._renderPane();
  }

  /**
   * Rebuild a binaural source as an isochronic one at the same beat rate, so a
   * listener on speakers still gets a pulse instead of nothing.
   */
  _convertToIsochronic() {
    const node = this._node();
    if (!node || node.gen !== 'binaural') return;
    const { id, name, x, y, z, volume } = node;
    const beat = node.params.beat;
    const carrier = node.params.carrier || 220;
    // Keep the beat rate, take the matching isochronic entry when one exists so
    // the card, colour and evidence note match what is now playing.
    const type = ISOCHRONIC_FOR[node.type] || node.type;
    const before = {
      id, type: node.type, name, x, y, z, volume,
      gen: node.gen, params: { ...node.params }, inserts: { ...node.inserts },
    };
    const after = {
      id, type, name, x: x || 0, y: y || -2.5, z: z || 0, volume,
      gen: 'isochronic', params: { beat, freq: carrier, duty: 0.5 }, inserts: { ...node.inserts },
    };
    const swap = (to) => {
      this.audioEngine.removeSource(id);
      const next = this.audioEngine.addSource(id, to.type, to.name, to.x, to.y, to.z, to.volume, {
        gen: to.gen, params: to.params, inserts: to.inserts,
        spatial: to.gen === 'binaural' ? false : true,
      });
      if (next) {
        this.canvasGrid.selectedNodeId = id;
        this.show(next);
        if (this.timeline && this.timeline.visible) this.timeline._render();
      }
    };
    if (this.undoManager) {
      this.undoManager.execute(new Command('SwitchGenerator', () => swap(after), () => swap(before)));
    } else {
      swap(after);
    }
  }

  _remove() {
    const node = this._node();
    if (!node) return;
    const data = {
      id: node.id, type: node.type, name: node.name,
      x: node.x, y: node.y, z: node.z, volume: node.volume,
      gen: node.gen, params: { ...node.params }, inserts: { ...node.inserts },
      rampUp: node.rampUp, rampDown: node.rampDown, repeatInterval: node.repeatInterval,
    };
    if (this.undoManager) {
      this.undoManager.execute(createDeleteCommand(this.audioEngine, this.canvasGrid, data, this.timeline));
    } else {
      this.audioEngine.removeSource(node.id);
      this.canvasGrid.automations.delete(node.id);
    }
    this.canvasGrid.selectedNodeId = null;
    this.show(null);
  }

  _liveValue(key, node) {
    switch (key) {
      case 'x': return node.x.toFixed(2);
      case 'y': return node.y.toFixed(2);
      case 'z': return node.z.toFixed(2);
      case 'dist': return Math.hypot(node.x, node.y).toFixed(2);
      default: return '';
    }
  }
}

// ---------------------------------------------------------------------------
// Markup helpers
// ---------------------------------------------------------------------------

function row({ key, label, min, max, step, value, unit, format }) {
  const fmtName = format ? format.name || '' : '';
  const shown = format ? format(value) : `${trim(value)}${unit ? ` ${unit}` : ''}`;
  return `
    <label class="ctl">
      <span class="ctl-label">${label}</span>
      <span class="ctl-row">
        <input type="range" data-key="${key}" min="${min}" max="${max}" step="${step}" value="${value}"
               ${unit ? `data-unit="${unit}"` : ''} ${fmtName ? `data-format="${fmtName}"` : ''} />
        <output class="ctl-value mono">${shown}</output>
      </span>
    </label>`;
}

function select({ key, label, value, options }) {
  return `
    <label class="ctl">
      <span class="ctl-label">${label}</span>
      <select class="input" data-key="${key}">
        ${options.map(o => `<option value="${o}"${o === value ? ' selected' : ''}>${o}</option>`).join('')}
      </select>
    </label>`;
}

function section(title) { return `<h3 class="ctl-section">${title}</h3>`; }

function pct(v) { return `${Math.round(v * 100)}%`; }
function mmss(v) { const m = Math.floor(v / 60); const s = Math.floor(v % 60); return `${m}:${String(s).padStart(2, '0')}`; }
function trim(v) { return Number.isInteger(v) ? String(v) : String(Math.round(v * 1000) / 1000); }

function formatFor(key, value, formatName, unit) {
  if (formatName === 'pct') return pct(value);
  if (formatName === 'mmss') return mmss(value);
  if (key === 'volume' || key === 'modDepth' || key === 'reverb') return pct(value);
  if (key === 'clipStart' || key === 'clipDuration') return mmss(value);
  return `${trim(value)}${unit ? ` ${unit}` : ''}`;
}

/** Degrees clockwise from straight ahead: 0 front, 90 right, -90 left. */
export function azimuthOf(node) {
  return Math.round(((Math.atan2(node.x, node.y) * 180) / Math.PI) * 10) / 10;
}
