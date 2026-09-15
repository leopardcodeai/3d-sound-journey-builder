/**
 * Timeline
 * The journey editor: one lane per sound, a clip that says when it plays, and
 * keyframes that carry position and level through time. The transport owns
 * playback; while it runs, keyframed sources are driven from here and the
 * canvas automations stand back (`src._timelineControlled`).
 *
 * Layout is a fixed-width header column plus a scrolling lane area. One
 * coordinate system: `timeToX(t) = headerW + t * pixelsPerSecond - scrollX`.
 */
import { createClipTimingCommand, createAddKeyframeCommand, createRemoveKeyframeCommand, createMoveKeyframeCommand } from '../core/UndoManager.js';
import { getSound, soundName } from '../data/SoundLibrary.js';
import { icon } from './Icons.js';
import { t } from '../i18n.js';

const MIN_PPS = 0.6;
const MAX_PPS = 60;
const LANE_H = 40;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Timeline {
  constructor(container, audioEngine, canvasGrid) {
    this.container = container;
    this.audioEngine = audioEngine;
    this.canvasGrid = canvasGrid;
    this.undoManager = null;

    this.visible = false;
    this.isPlaying = false;
    this.isLooping = true;
    this.pixelsPerSecond = 1.4;
    this.scrollX = 0;
    this.playheadTime = 0;
    this.totalDuration = 600;
    this.snap = true;

    this.sourceTimings = new Map();   // id -> { startTime, duration }
    this.keyframes = new Map();       // id -> [{ time, x, y, z, volume, easing }]
    this.trackState = new Map();      // id -> { muted, solo }
    this.sections = [];               // [{ time, name }]

    this.onTimeUpdate = null;
    this.onSelect = null;

    this._headerW = 168;
    this._animationFrame = null;
    this._lastFrameTime = 0;
    this._drag = null;
    this._captured = null;
    this._masterBeforeFade = undefined;
    this._endFadeTimer = null;

    this._buildDOM();
    this._setupEvents();
    this._render();
  }

  // ---------------------------------------------------------------------
  // DOM
  // ---------------------------------------------------------------------

  _buildDOM() {
    this.container.innerHTML = '';
    this.container.style.display = 'none';
    this.container.classList.add('tl');

    this.header = document.createElement('div');
    this.header.className = 'tl-bar';
    this.header.innerHTML = `
      <div class="tl-group">
        <button class="tl-btn tl-play" data-i18n-title="play">${icon('play', { size: 14 })}</button>
        <button class="tl-btn tl-stop" data-i18n-title="stop">${icon('stop', { size: 13 })}</button>
        <button class="tl-btn tl-loop is-on" data-i18n-title="loopForever">${icon('loop', { size: 15 })}</button>
      </div>
      <div class="tl-readout">
        <span class="tl-current">00:00</span><span class="tl-sep">/</span><span class="tl-total">10:00</span>
      </div>
      <label class="tl-field">
        <span class="tl-field-label" data-i18n="journeyDuration">Journey length</span>
        <select class="tl-duration">
          <option value="300">5 min</option>
          <option value="600" selected>10 min</option>
          <option value="900">15 min</option>
          <option value="1200">20 min</option>
          <option value="1800">30 min</option>
          <option value="2700">45 min</option>
          <option value="3600">60 min</option>
        </select>
      </label>
      <div class="tl-spacer"></div>
      <div class="tl-group">
        <button class="tl-btn tl-snap is-on" data-i18n-title="snap">${icon('snap', { size: 14 })}</button>
        <button class="tl-btn tl-fit" data-i18n-title="fitToView">${icon('fit', { size: 14 })}</button>
        <button class="tl-btn tl-zoom-out" data-i18n-title="zoomOut">${icon('minus', { size: 14 })}</button>
        <button class="tl-btn tl-zoom-in" data-i18n-title="zoomIn">${icon('plus', { size: 14 })}</button>
      </div>
    `;
    this.container.appendChild(this.header);

    this.viewport = document.createElement('div');
    this.viewport.className = 'tl-viewport';
    this.container.appendChild(this.viewport);

    this.ruler = document.createElement('div');
    this.ruler.className = 'tl-ruler';
    this.viewport.appendChild(this.ruler);

    this.tracksArea = document.createElement('div');
    this.tracksArea.className = 'tl-tracks';
    this.viewport.appendChild(this.tracksArea);

    this.playhead = document.createElement('div');
    this.playhead.className = 'tl-playhead';
    this.playhead.innerHTML = '<div class="tl-playhead-head"></div><div class="tl-playhead-line"></div>';
    this.viewport.appendChild(this.playhead);

    this.emptyState = document.createElement('div');
    this.emptyState.className = 'tl-empty';
    this.emptyState.innerHTML = `
      <div class="tl-empty-title" data-i18n="timelineEmpty">No sounds yet</div>
      <div class="tl-empty-help" data-i18n="timelineEmptyHelp"></div>
    `;
    this.viewport.appendChild(this.emptyState);
  }

  _q(sel) { return this.header.querySelector(sel); }

  // ---------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------

  _setupEvents() {
    this._q('.tl-play').addEventListener('click', () => this.togglePlay());
    this._q('.tl-stop').addEventListener('click', () => this.stop());
    this._q('.tl-loop').addEventListener('click', () => this.setLooping(!this.isLooping));
    this._q('.tl-snap').addEventListener('click', () => this.setSnap(!this.snap));
    this._q('.tl-fit').addEventListener('click', () => this.fit());
    this._q('.tl-zoom-in').addEventListener('click', () => this.zoom(1.35));
    this._q('.tl-zoom-out').addEventListener('click', () => this.zoom(1 / 1.35));
    this._q('.tl-duration').addEventListener('change', (e) => this.setTotalDuration(parseInt(e.target.value, 10)));

    // Track header buttons: mute / solo / select
    this.tracksArea.addEventListener('click', (e) => {
      const head = e.target.closest('.tl-head');
      if (!head) return;
      const id = head.closest('.tl-track')?.dataset.id;
      if (!id) return;
      if (e.target.closest('.tl-mute')) { this.toggleMute(id); return; }
      if (e.target.closest('.tl-solo')) { this.toggleSolo(id); return; }
      if (this.onSelect) this.onSelect(id);
    });

    this.tracksArea.addEventListener('pointerdown', (e) => this._onLanePointerDown(e));
    this.ruler.addEventListener('pointerdown', (e) => this._onScrubStart(e));
    this.viewport.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.tl-track') || e.target.closest('.tl-ruler')) return;
      this._onScrubStart(e);
    });

    window.addEventListener('pointermove', (e) => this._onPointerMove(e));
    window.addEventListener('pointerup', (e) => this._onPointerUp(e));
    // A release outside the window never reaches us. Without these the drag
    // stays live with the button up, and the next click anywhere commits it.
    window.addEventListener('pointercancel', (e) => this._onPointerUp(e));
    window.addEventListener('blur', () => this._onPointerUp());

    // Double-click a lane to add a keyframe, a keyframe to remove it
    this.tracksArea.addEventListener('dblclick', (e) => {
      const id = e.target.closest('.tl-track')?.dataset.id;
      if (!id) return;
      const kfEl = e.target.closest('.tl-kf');
      if (kfEl) {
        const index = parseInt(kfEl.dataset.kfIndex, 10);
        const kf = this.keyframes.get(id)?.[index];
        if (!kf) return;
        if (this.undoManager) this.undoManager.execute(createRemoveKeyframeCommand(this, id, kf, index));
        else this.removeKeyframe(id, index);
      } else if (e.target.closest('.tl-lane')) {
        this.addKeyframeAt(id, this._timeAt(e.clientX));
      }
      this._render();
    });

    this.viewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      const timeAtMouse = this._timeAt(e.clientX, false);
      if (e.metaKey || e.ctrlKey) {
        const factor = e.deltaY > 0 ? 0.9 : 1.1;
        const rect = this.viewport.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const newPps = clamp(this.pixelsPerSecond * factor, MIN_PPS, MAX_PPS);
        this.scrollX = timeAtMouse * newPps - (mouseX - this._headerW);
        this.pixelsPerSecond = newPps;
      } else {
        this.scrollX += (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY);
      }
      this._clampScroll();
      this._render();
    }, { passive: false });
  }

  _onLanePointerDown(e) {
    const track = e.target.closest('.tl-track');
    if (!track) return;
    const id = track.dataset.id;
    const kfEl = e.target.closest('.tl-kf');
    const block = e.target.closest('.tl-clip');
    if (!kfEl && !block) return;
    e.preventDefault();
    this.ensureTiming(id);

    this._capture(e);
    if (kfEl) {
      const index = parseInt(kfEl.dataset.kfIndex, 10);
      const kf = this.keyframes.get(id)?.[index];
      if (!kf) return;
      this._drag = { kind: 'keyframe', id, index, startX: e.clientX, startY: e.clientY, orig: { ...kf }, moved: false };
      if (this.onSelect) this.onSelect(id);
      return;
    }

    const edge = e.target.closest('.tl-clip-edge');
    this._drag = {
      kind: 'clip',
      id,
      mode: edge ? (edge.classList.contains('tl-clip-left') ? 'left' : 'right') : 'move',
      startX: e.clientX,
      orig: { ...this.sourceTimings.get(id) },
      moved: false,
    };
    if (this.onSelect) this.onSelect(id);
  }

  _onScrubStart(e) {
    if (e.button !== 0) return;
    this._capture(e);
    this._drag = { kind: 'scrub', wasPlaying: this.isPlaying };
    this.pause();
    this._seekTo(this._timeAt(e.clientX));
  }

  _onPointerMove(e) {
    const d = this._drag;
    if (!d) return;
    // The primary button is no longer down: the release happened somewhere we
    // could not see it, so finish the drag here rather than keep following.
    if (e.buttons !== undefined && (e.buttons & 1) === 0) { this._onPointerUp(e); return; }
    if (d.kind === 'scrub') { this._seekTo(this._timeAt(e.clientX)); return; }
    if (d.kind === 'clip') { this._dragClip(e); return; }
    if (d.kind === 'keyframe') { this._dragKeyframe(e); return; }
  }

  /** Hold the pointer so a drag keeps reporting once it leaves the element. */
  _capture(e) {
    const target = e && e.currentTarget;
    if (target && target.setPointerCapture && e.pointerId !== undefined) {
      try { target.setPointerCapture(e.pointerId); this._captured = { target, id: e.pointerId }; }
      catch (err) { this._captured = null; }
    }
  }

  _release() {
    const c = this._captured;
    this._captured = null;
    if (c && c.target.releasePointerCapture) {
      try { c.target.releasePointerCapture(c.id); } catch (err) { /* already released */ }
    }
  }

  _onPointerUp() {
    this._release();
    const d = this._drag;
    this._drag = null;
    if (!d) return;

    if (d.kind === 'scrub') {
      if (d.wasPlaying) this.play();
      return;
    }
    if (d.kind === 'clip' && d.moved) {
      const current = { ...this.sourceTimings.get(d.id) };
      this.sourceTimings.set(d.id, { ...d.orig });
      if (this.undoManager) this.undoManager.execute(createClipTimingCommand(this, d.id, d.orig, current));
      else this.sourceTimings.set(d.id, current);
    }
    if (d.kind === 'keyframe' && d.moved) {
      const kfs = this.keyframes.get(d.id) || [];
      const current = { ...kfs[d.index] };
      kfs[d.index] = { ...d.orig };
      if (this.undoManager) this.undoManager.execute(createMoveKeyframeCommand(this, d.id, d.index, d.orig, current));
      else kfs[d.index] = current;
    }
    this._applyKeyframes();
    this._render();
  }

  _dragClip(e) {
    const d = this._drag;
    const timing = this.sourceTimings.get(d.id);
    if (!timing) { this._drag = null; return; }
    const dt = (e.clientX - d.startX) / this.pixelsPerSecond;
    if (Math.abs(e.clientX - d.startX) > 2) d.moved = true;
    if (d.mode === 'move') {
      timing.startTime = this._snapTime(clamp(d.orig.startTime + dt, 0, this.totalDuration - d.orig.duration));
    } else if (d.mode === 'right') {
      timing.duration = this._snapTime(clamp(d.orig.duration + dt, 1, this.totalDuration - d.orig.startTime));
    } else {
      const origEnd = d.orig.startTime + d.orig.duration;
      const newStart = this._snapTime(clamp(d.orig.startTime + dt, 0, origEnd - 1));
      timing.startTime = newStart;
      timing.duration = origEnd - newStart;
    }
    this._render();
  }

  _dragKeyframe(e) {
    const d = this._drag;
    const kfs = this.keyframes.get(d.id);
    if (!kfs || !kfs[d.index]) { this._drag = null; return; }
    if (Math.abs(e.clientX - d.startX) > 2 || Math.abs(e.clientY - d.startY) > 2) d.moved = true;
    const dt = (e.clientX - d.startX) / this.pixelsPerSecond;
    const kf = kfs[d.index];
    kf.time = this._snapTime(clamp(d.orig.time + dt, 0, this.totalDuration));
    // Vertical drag adjusts the level of that keyframe.
    const dv = (d.startY - e.clientY) / (LANE_H - 10);
    kf.volume = clamp(d.orig.volume + dv * 0.8, 0, 1);
    // Keep the list sorted; follow the moved entry.
    const moved = kf;
    kfs.sort((a, b) => a.time - b.time);
    d.index = kfs.indexOf(moved);
    this._applyKeyframes();
    this._render();
  }

  // ---------------------------------------------------------------------
  // Coordinates
  // ---------------------------------------------------------------------

  timeToX(t) { return this._headerW + t * this.pixelsPerSecond - this.scrollX; }

  _timeAt(clientX, snap = true) {
    const rect = this.viewport.getBoundingClientRect();
    const raw = (clientX - rect.left - this._headerW + this.scrollX) / this.pixelsPerSecond;
    const clamped = clamp(raw, 0, this.totalDuration);
    return snap ? this._snapTime(clamped) : clamped;
  }

  /** Snap step chosen from the current zoom: finer when zoomed in. */
  snapStep() {
    if (!this.snap) return 0;
    const pps = this.pixelsPerSecond;
    if (pps > 24) return 0.5;
    if (pps > 8) return 1;
    if (pps > 3) return 5;
    if (pps > 1.2) return 15;
    return 30;
  }

  _snapTime(t) {
    const step = this.snapStep();
    if (!step) return Math.round(t * 10) / 10;
    return Math.round(t / step) * step;
  }

  _clampScroll() {
    const contentW = this.totalDuration * this.pixelsPerSecond;
    const laneW = Math.max(60, this.viewport.clientWidth - this._headerW);
    this.scrollX = clamp(this.scrollX, 0, Math.max(0, contentW - laneW + 24));
  }

  zoom(factor) {
    const centre = this.playheadTime;
    this.pixelsPerSecond = clamp(this.pixelsPerSecond * factor, MIN_PPS, MAX_PPS);
    const laneW = Math.max(60, this.viewport.clientWidth - this._headerW);
    this.scrollX = centre * this.pixelsPerSecond - laneW / 2;
    this._clampScroll();
    this._render();
  }

  /** Fit the whole journey into the lane area. */
  fit() {
    const laneW = Math.max(60, this.viewport.clientWidth - this._headerW - 24);
    this.pixelsPerSecond = clamp(laneW / Math.max(1, this.totalDuration), MIN_PPS, MAX_PPS);
    this.scrollX = 0;
    this._render();
  }

  setSnap(on) {
    this.snap = on;
    this._q('.tl-snap').classList.toggle('is-on', on);
  }

  // ---------------------------------------------------------------------
  // Transport
  // ---------------------------------------------------------------------

  togglePlay() { this.isPlaying ? this.pause() : this.play(); }

  setLooping(on) {
    this.isLooping = on;
    const btn = this._q('.tl-loop');
    if (btn) {
      btn.classList.toggle('is-on', on);
      btn.innerHTML = icon(on ? 'loop' : 'once', { size: 15 });
      btn.title = on ? t('loopForever') : t('playOnce');
      btn.setAttribute('aria-label', btn.title);
    }
  }

  play() {
    if (this.isPlaying) return;
    this._restoreMaster();
    this.isPlaying = true;
    this._lastFrameTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this._setPlayIcon(true);
    this._loop();
  }

  pause() {
    this.isPlaying = false;
    this._setPlayIcon(false);
    if (this._animationFrame) { cancelAnimationFrame(this._animationFrame); this._animationFrame = null; }
    if (this._endFadeTimer) { clearTimeout(this._endFadeTimer); this._endFadeTimer = null; this._restoreMaster(); }
    for (const src of this.audioEngine.sources.values()) if (src) src._timelineControlled = false;
  }

  stop() {
    this.pause();
    this.playheadTime = 0;
    this._updatePlayhead();
    this._applyKeyframes();
  }

  _setPlayIcon(playing) {
    const btn = this._q('.tl-play');
    if (!btn) return;
    btn.innerHTML = icon(playing ? 'pause' : 'play', { size: 14 });
    btn.classList.toggle('is-on', playing);
    btn.title = playing ? t('pause') : t('play');
  }

  _seekTo(time) {
    this.playheadTime = clamp(time, 0, this.totalDuration);
    this._updatePlayhead();
    this._applyKeyframes();
  }

  _loop() {
    if (!this.isPlaying) return;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const dt = (now - this._lastFrameTime) / 1000;
    this._lastFrameTime = now;
    this.playheadTime += dt;

    if (this.playheadTime >= this.totalDuration) {
      if (this.isLooping) {
        this.playheadTime = 0;
      } else {
        this.playheadTime = this.totalDuration;
        this._updatePlayhead();
        this.isPlaying = false;
        this._setPlayIcon(false);
        this._finishOnce();
        return;
      }
    }
    this._updatePlayhead();
    this._applyKeyframes();
    this._autoScroll();
    this._animationFrame = requestAnimationFrame(() => this._loop());
  }

  _restoreMaster() {
    if (this._masterBeforeFade === undefined) return;
    const mg = this.audioEngine.masterGain;
    const ctx = this.audioEngine.ctx;
    if (mg && ctx) {
      mg.gain.cancelScheduledValues(ctx.currentTime);
      mg.gain.setValueAtTime(this._masterBeforeFade, ctx.currentTime);
    }
    this._masterBeforeFade = undefined;
  }

  _finishOnce() {
    const mg = this.audioEngine.masterGain;
    const ctx = this.audioEngine.ctx;
    const FADE = 2.5;
    if (mg && ctx) {
      this._masterBeforeFade = mg.gain.value;
      mg.gain.cancelScheduledValues(ctx.currentTime);
      mg.gain.setValueAtTime(mg.gain.value, ctx.currentTime);
      mg.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + FADE);
    }
    this._endFadeTimer = setTimeout(() => {
      this.pause();
      this.playheadTime = 0;
      this._updatePlayhead();
      this._applyKeyframes();
      this._restoreMaster();
    }, FADE * 1000 + 100);
  }

  setTotalDuration(seconds) {
    this.totalDuration = seconds;
    if (this.playheadTime > seconds) this.playheadTime = seconds;
    for (const timing of this.sourceTimings.values()) {
      if (timing.startTime >= seconds) timing.startTime = Math.max(0, seconds - 1);
      timing.duration = Math.min(timing.duration, seconds - timing.startTime);
    }
    for (const kfs of this.keyframes.values()) for (const kf of kfs) kf.time = Math.min(kf.time, seconds);
    this.sections = this.sections.filter(s => s.time < seconds);
    this._clampScroll();
    this._updatePlayhead();
    this._syncDurationSelect();
    this._render();
  }

  _syncDurationSelect() {
    const sel = this._q('.tl-duration');
    if (!sel) return;
    if (![...sel.options].some(o => parseInt(o.value, 10) === this.totalDuration)) {
      const opt = document.createElement('option');
      opt.value = String(this.totalDuration);
      opt.textContent = `${Math.round(this.totalDuration / 60)} min`;
      sel.appendChild(opt);
    }
    sel.value = String(this.totalDuration);
  }

  _autoScroll() {
    const laneW = Math.max(60, this.viewport.clientWidth - this._headerW);
    const x = this.playheadTime * this.pixelsPerSecond - this.scrollX;
    if (x > laneW - 80 || x < 0) {
      this.scrollX = this.playheadTime * this.pixelsPerSecond - laneW * 0.35;
      this._clampScroll();
      this._render();
    }
  }

  // ---------------------------------------------------------------------
  // Tracks
  // ---------------------------------------------------------------------

  ensureTiming(id) {
    if (!this.sourceTimings.has(id)) {
      this.sourceTimings.set(id, { startTime: 0, duration: this.totalDuration });
    }
    if (!this.trackState.has(id)) this.trackState.set(id, { muted: false, solo: false });
  }

  state(id) {
    this.ensureTiming(id);
    return this.trackState.get(id);
  }

  toggleMute(id) {
    const s = this.state(id);
    s.muted = !s.muted;
    this._applyKeyframes();
    this._render();
    return s.muted;
  }

  toggleSolo(id) {
    const s = this.state(id);
    s.solo = !s.solo;
    this._applyKeyframes();
    this._render();
    return s.solo;
  }

  _anySolo() {
    for (const s of this.trackState.values()) if (s.solo) return true;
    return false;
  }

  setSections(sections) {
    this.sections = (sections || []).map(s => ({ time: s.time, name: s.name }));
    this._render();
  }

  // ---------------------------------------------------------------------
  // Keyframes
  // ---------------------------------------------------------------------

  addKeyframe(id, time, options = {}) {
    if (!this.keyframes.has(id)) this.keyframes.set(id, []);
    const kfs = this.keyframes.get(id);
    const src = this.audioEngine.sources.get(id);
    if (!src) return null;
    const kf = {
      time: time !== undefined ? time : this.playheadTime,
      x: options.x !== undefined ? options.x : src.x,
      y: options.y !== undefined ? options.y : src.y,
      z: options.z !== undefined ? options.z : src.z,
      volume: options.volume !== undefined ? options.volume : src.volume,
      easing: options.easing || 'ease-in-out',
    };
    const idx = kfs.findIndex(k => k.time > kf.time);
    const index = idx === -1 ? kfs.length : idx;
    kfs.splice(index, 0, kf);
    return { kf, index };
  }

  /** Add a keyframe at a time, routed through undo when available. */
  addKeyframeAt(id, time) {
    const src = this.audioEngine.sources.get(id);
    if (!src) return;
    const kfs = this.keyframes.get(id) || [];
    const kf = { time: this._snapTime(time), x: src.x, y: src.y, z: src.z, volume: src.volume, easing: 'ease-in-out' };
    const idx = kfs.findIndex(k => k.time > kf.time);
    const index = idx === -1 ? kfs.length : idx;
    if (this.undoManager) this.undoManager.execute(createAddKeyframeCommand(this, id, kf, index));
    else { if (!this.keyframes.has(id)) this.keyframes.set(id, []); this.keyframes.get(id).splice(index, 0, kf); }
    this._render();
  }

  removeKeyframe(id, index) {
    const kfs = this.keyframes.get(id);
    if (!kfs || index < 0 || index >= kfs.length) return;
    kfs.splice(index, 1);
    if (kfs.length === 0) this.keyframes.delete(id);
  }

  setKeyframes(id, keyframes) {
    this.keyframes.set(id, keyframes.map(kf => ({
      time: kf.time || 0,
      x: kf.x || 0, y: kf.y || 0, z: kf.z || 0,
      volume: kf.volume !== undefined ? kf.volume : 0.5,
      easing: kf.easing || 'linear',
    })));
  }

  _sampleKeyframes(kfs, now) {
    const first = kfs[0];
    if (kfs.length === 1 || now <= first.time) return { x: first.x, y: first.y, z: first.z, volume: first.volume };
    const last = kfs[kfs.length - 1];
    if (now >= last.time) return { x: last.x, y: last.y, z: last.z, volume: last.volume };
    let prev = first, next = last;
    for (let i = 0; i < kfs.length - 1; i++) {
      if (now >= kfs[i].time && now <= kfs[i + 1].time) { prev = kfs[i]; next = kfs[i + 1]; break; }
    }
    const span = next.time - prev.time;
    const raw = span > 0 ? (now - prev.time) / span : 1;
    const eased = this._ease(raw, prev.easing || 'linear');
    const lerp = (a, b) => a + (b - a) * eased;
    return {
      x: lerp(prev.x, next.x),
      y: lerp(prev.y, next.y),
      z: lerp(prev.z, next.z),
      volume: (prev.volume !== undefined && next.volume !== undefined)
        ? lerp(prev.volume, next.volume)
        : (prev.volume !== undefined ? prev.volume : next.volume),
    };
  }

  _ease(t, type) {
    switch (type) {
      case 'ease-in': return t * t;
      case 'ease-out': return 1 - (1 - t) * (1 - t);
      case 'ease-in-out': return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      default: return t;
    }
  }

  /**
   * Drive every source from the playhead: position from keyframes, level from
   * keyframe volume gated by the clip window, mute and solo.
   */
  _applyKeyframes() {
    const now = this.playheadTime;
    const soloing = this._anySolo();

    for (const [id, src] of this.audioEngine.sources.entries()) {
      if (!src) continue;
      this.ensureTiming(id);
      const timing = this.sourceTimings.get(id);
      const state = this.trackState.get(id);
      const inWindow = now >= timing.startTime && now <= timing.startTime + timing.duration;
      const audible = inWindow && !state.muted && (!soloing || state.solo);

      const kfs = this.keyframes.get(id);
      let kfVolume;
      if (kfs && kfs.length > 0) {
        const s = this._sampleKeyframes(kfs, now);
        if (src.spatial !== false) this.audioEngine.updateSourcePosition(id, s.x, s.y, s.z);
        kfVolume = s.volume;
        src._timelineControlled = this.isPlaying;
      } else {
        src._timelineControlled = false;
      }

      if (inWindow && !src.isPlaying) {
        this.audioEngine.toggleSource(id, Math.max(0, now - timing.startTime));
      }

      const target = audible ? (kfVolume !== undefined ? kfVolume : src.volume) : 0;
      if (src.gainNode && this.audioEngine.ctx) {
        if (src.gainNode.gain.setTargetAtTime) src.gainNode.gain.setTargetAtTime(target, this.audioEngine.ctx.currentTime, 0.05);
        else src.gainNode.gain.value = target;
      }
    }
    if (this.onTimeUpdate) this.onTimeUpdate(this.playheadTime, this.totalDuration);
  }

  // ---------------------------------------------------------------------
  // Visibility
  // ---------------------------------------------------------------------

  toggle() { this.visible ? this.hide() : this.show(); }

  show() {
    this.visible = true;
    this.container.style.display = 'flex';
    this._render();
    this._updatePlayhead();
    this._reflectVisibility();
  }

  hide() {
    this.visible = false;
    this.container.style.display = 'none';
    this.pause();
    this._reflectVisibility();
  }

  _reflectVisibility() {
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.toggle('timeline-open', this.visible);
    }
  }

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------

  _updatePlayhead() {
    if (!this.playhead) return;
    this.playhead.style.transform = `translateX(${this.timeToX(this.playheadTime)}px)`;
    const cur = this._q('.tl-current');
    const tot = this._q('.tl-total');
    if (cur) cur.textContent = fmt(this.playheadTime);
    if (tot) tot.textContent = fmt(this.totalDuration);
    const visible = this.timeToX(this.playheadTime) >= this._headerW - 2;
    this.playhead.style.opacity = visible ? '1' : '0';
  }

  /**
   * Horizontal pixel range worth drawing. Before the first layout (and in
   * jsdom) clientWidth is 0, so culling is switched off rather than hiding
   * everything.
   */
  _cullRange(margin = 40) {
    const w = this.viewport.clientWidth;
    if (!w) return { min: -Infinity, max: Infinity };
    return { min: this._headerW - margin, max: w + margin };
  }

  _render() {
    if (!this.visible) return;
    const pps = this.pixelsPerSecond;

    this._syncDurationSelect();

    // --- ruler ---
    const majorStep = pickStep(pps);
    const minorStep = majorStep / (majorStep >= 60 ? 6 : 5);
    const cull = this._cullRange(40);
    let ruler = '';
    for (let time = 0; time <= this.totalDuration + 0.001; time += minorStep) {
      const x = this.timeToX(time);
      if (x < cull.min || x > cull.max) continue;
      const major = Math.abs(time % majorStep) < 0.001;
      ruler += `<div class="tl-tick${major ? ' is-major' : ''}" style="left:${x}px">${major ? `<span>${fmt(time)}</span>` : ''}</div>`;
    }
    for (const section of this.sections) {
      const x = this.timeToX(section.time);
      if (x < cull.min || x > cull.max) continue;
      ruler += `<div class="tl-section" style="left:${x}px"><span>${escapeHtml(section.name)}</span></div>`;
    }
    this.ruler.innerHTML = ruler;

    // --- tracks ---
    const sources = [...this.audioEngine.sources.entries()].filter(([, s]) => s);
    if (sources.length === 0) {
      this.emptyState.style.display = 'flex';
      this.tracksArea.innerHTML = '';
      this._updatePlayhead();
      return;
    }
    this.emptyState.style.display = 'none';
    const soloing = this._anySolo();

    let html = '';
    for (const [id, src] of sources) {
      this.ensureTiming(id);
      const timing = this.sourceTimings.get(id);
      const state = this.trackState.get(id);
      const def = getSound(src.type);
      const color = (this.canvasGrid && this.canvasGrid.colorFor) ? this.canvasGrid.colorFor(src.type) : (def.color || '#888');
      const left = this.timeToX(timing.startTime);
      const width = Math.max(18, timing.duration * pps);
      const active = this.playheadTime >= timing.startTime && this.playheadTime <= timing.startTime + timing.duration;
      const dimmed = state.muted || (soloing && !state.solo);
      const selected = this.canvasGrid && this.canvasGrid.selectedNodeId === id;
      const kfs = this.keyframes.get(id) || [];

      const dots = kfs.map((kf, i) => {
        const x = this.timeToX(kf.time) - left;
        if (x < -8 || x > width + 8) return '';
        const y = (1 - clamp(kf.volume, 0, 1)) * (LANE_H - 18) + 4;
        return `<div class="tl-kf" data-kf-index="${i}" style="left:${x}px;top:${y}px" title="${fmt(kf.time)} · ${Math.round(kf.volume * 100)}%"></div>`;
      }).join('');

      const envelope = kfs.length > 1 ? this._envelopeSvg(kfs, left, width) : '';

      html += `
        <div class="tl-track${selected ? ' is-selected' : ''}${dimmed ? ' is-dim' : ''}" data-id="${escapeHtml(id)}">
          <div class="tl-head">
            <span class="tl-dot" style="background:${color}"></span>
            <span class="tl-name">${escapeHtml(src.name || soundName(src.type))}</span>
            <button class="tl-mini tl-solo${state.solo ? ' is-on' : ''}" title="${t('solo')}">S</button>
            <button class="tl-mini tl-mute${state.muted ? ' is-on' : ''}" title="${t('muteSound')}">M</button>
          </div>
          <div class="tl-lane">
            <div class="tl-clip${active ? ' is-active' : ''}" style="left:${left}px;width:${width}px;--clip:${color}">
              ${envelope}
              <span class="tl-clip-label">${fmt(timing.startTime)} – ${fmt(timing.startTime + timing.duration)}</span>
              <div class="tl-clip-kfs">${dots}</div>
              <div class="tl-clip-edge tl-clip-left"></div>
              <div class="tl-clip-edge tl-clip-right"></div>
            </div>
          </div>
        </div>`;
    }
    this.tracksArea.innerHTML = html;

    const headEl = this.tracksArea.querySelector('.tl-head');
    if (headEl && headEl.offsetWidth > 0 && Math.abs(headEl.offsetWidth - this._headerW) > 1) {
      this._headerW = headEl.offsetWidth;
      this._updatePlayhead();
    }
    this._updatePlayhead();
  }

  /** Volume envelope as an inline SVG polyline inside the clip. */
  _envelopeSvg(kfs, clipLeft, clipWidth) {
    const pts = kfs.map(kf => {
      const x = this.timeToX(kf.time) - clipLeft;
      const y = (1 - clamp(kf.volume, 0, 1)) * (LANE_H - 14) + 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    return `<svg class="tl-env" width="${clipWidth}" height="${LANE_H - 8}" viewBox="0 0 ${clipWidth} ${LANE_H - 8}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}"/></svg>`;
  }
}

function pickStep(pps) {
  const target = 90; // pixels between major ticks
  const candidates = [1, 5, 10, 15, 30, 60, 120, 300, 600, 900];
  for (const c of candidates) if (c * pps >= target) return c;
  return 900;
}

function fmt(sec) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
