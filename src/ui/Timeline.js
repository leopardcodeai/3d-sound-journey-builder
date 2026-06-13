import { createClipTimingCommand, createAddKeyframeCommand, createRemoveKeyframeCommand } from '../core/UndoManager.js';

/**
 * Timeline Pro — Professional multitrack timeline for designing spatial sound journeys.
 * Features: Keyframe-based spatial animation, glass UI, play/loop/scrub,
 * draggable clips (move/resize), double-click keyframe editing, journey duration control.
 */
export class Timeline {
  constructor(container, audioEngine, canvasGrid) {
    this.container = container;
    this.audioEngine = audioEngine;
    this.canvasGrid = canvasGrid;
    this.undoManager = null;
    this.visible = false;
    this.isPlaying = false;
    this.isLooping = true;
    this.pixelsPerSecond = 12;
    this.scrollX = 0;
    this.playheadTime = 0;
    this.totalDuration = 600; // 10 minutes default
    this.sourceTimings = new Map();
    this.keyframes = new Map(); // id -> [{time, x, y, z, volume, easing}]
    this._animationFrame = null;
    this._lastFrameTime = 0;
    this._headerW = 140; // track header width, measured at render time
    this._drag = null;

    this._buildDOM();
    this._setupEvents();
    this._render();
  }

  _buildDOM() {
    this.container.innerHTML = '';
    this.container.style.display = 'none';

    // Header with controls
    this.header = document.createElement('div');
    this.header.className = 'tl-pro-header';
    this.header.innerHTML = `
      <div class="tl-pro-controls">
        <button class="tl-pro-btn tl-pro-play" title="Play/Pause">▶</button>
        <button class="tl-pro-btn tl-pro-stop" title="Stop">⏹</button>
        <button class="tl-pro-btn tl-pro-loop active" title="Loop">🔁</button>
        <div class="tl-pro-time">
          <span class="tl-pro-current">00:00</span>
          <span class="tl-pro-separator"> / </span>
          <span class="tl-pro-total">10:00</span>
        </div>
        <select class="tl-pro-duration" title="Journey duration">
          <option value="60">1 min</option>
          <option value="120">2 min</option>
          <option value="300">5 min</option>
          <option value="600" selected>10 min</option>
          <option value="900">15 min</option>
          <option value="1200">20 min</option>
        </select>
      </div>
      <div class="tl-pro-zoom">
        <button class="tl-pro-btn tl-pro-zoom-out" title="Zoom Out">−</button>
        <div class="tl-pro-zoom-bar"><div class="tl-pro-zoom-fill"></div></div>
        <button class="tl-pro-btn tl-pro-zoom-in" title="Zoom In">+</button>
      </div>
    `;
    this.container.appendChild(this.header);

    // Timeline ruler + tracks area
    this.viewport = document.createElement('div');
    this.viewport.className = 'tl-pro-viewport';
    this.container.appendChild(this.viewport);

    this.ruler = document.createElement('div');
    this.ruler.className = 'tl-pro-ruler';
    this.viewport.appendChild(this.ruler);

    this.tracksArea = document.createElement('div');
    this.tracksArea.className = 'tl-pro-tracks';
    this.viewport.appendChild(this.tracksArea);

    // Playhead
    this.playhead = document.createElement('div');
    this.playhead.className = 'tl-pro-playhead';
    this.playhead.innerHTML = '<div class="tl-pro-playhead-line"></div><div class="tl-pro-playhead-handle">▲</div>';
    this.viewport.appendChild(this.playhead);

    // Empty state
    this.emptyState = document.createElement('div');
    this.emptyState.className = 'tl-pro-empty';
    this.emptyState.innerHTML = `
      <div style="font-size:32px;margin-bottom:12px">🎼</div>
      <div style="font-weight:600;margin-bottom:6px">No Sounds in Timeline</div>
      <div style="opacity:0.6">Add sounds from the library — drag clips to arrange them, double-click a lane to set a keyframe</div>
    `;
    this.viewport.appendChild(this.emptyState);
  }

  _setupEvents() {
    // Play/Pause
    this.header.querySelector('.tl-pro-play').addEventListener('click', () => this.togglePlay());
    this.header.querySelector('.tl-pro-stop').addEventListener('click', () => this.stop());
    this.header.querySelector('.tl-pro-loop').addEventListener('click', (e) => {
      this.isLooping = !this.isLooping;
      e.currentTarget.classList.toggle('active', this.isLooping);
    });

    // Journey duration
    this.header.querySelector('.tl-pro-duration').addEventListener('change', (e) => {
      this.setTotalDuration(parseInt(e.target.value, 10));
    });

    // Zoom
    this.header.querySelector('.tl-pro-zoom-in').addEventListener('click', () => {
      this.pixelsPerSecond = Math.min(60, this.pixelsPerSecond * 1.3);
      this._render();
    });
    this.header.querySelector('.tl-pro-zoom-out').addEventListener('click', () => {
      this.pixelsPerSecond = Math.max(3, this.pixelsPerSecond / 1.3);
      this._render();
    });

    // Clip editing: drag to move, drag edges to resize
    this.tracksArea.addEventListener('mousedown', (e) => {
      const block = e.target.closest('.tl-pro-block');
      if (!block) return;
      const id = block.closest('.tl-pro-track')?.dataset.id;
      if (!id) return;
      e.preventDefault();
      e.stopPropagation();
      this.ensureTiming(id);
      const edge = e.target.closest('.tl-pro-block-edge');
      this._drag = {
        id,
        mode: edge ? (edge.classList.contains('tl-pro-block-left') ? 'left' : 'right') : 'move',
        startX: e.clientX,
        orig: { ...this.sourceTimings.get(id) },
      };
    });

    // Double-click: add keyframe on a lane, remove keyframe on a dot
    this.tracksArea.addEventListener('dblclick', (e) => {
      const id = e.target.closest('.tl-pro-track')?.dataset.id;
      if (!id) return;
      const kfEl = e.target.closest('.tl-pro-kf');
      if (kfEl) {
        const index = parseInt(kfEl.dataset.kfIndex, 10);
        if (this.undoManager) {
          const kf = this.keyframes.get(id)?.[index];
          if (kf) this.undoManager.execute(createRemoveKeyframeCommand(this, id, kf, index));
        } else {
          this.removeKeyframe(id, index);
        }
      } else if (e.target.closest('.tl-pro-track-lane')) {
        const rect = this.viewport.getBoundingClientRect();
        const time = (e.clientX - rect.left - this._headerW - this.scrollX) / this.pixelsPerSecond;
        const clampedTime = Math.round(Math.max(0, Math.min(this.totalDuration, time)) * 10) / 10;
        if (this.undoManager) {
          const kfs = this.keyframes.get(id) || [];
          const src = this.audioEngine.sources.get(id);
          if (src) {
            const kf = {
              time: clampedTime,
              x: src.x, y: src.y, z: src.z,
              volume: src.volume,
              easing: 'linear'
            };
            const insertIdx = kfs.findIndex(k => k.time > kf.time);
            const index = insertIdx === -1 ? kfs.length : insertIdx;
            this.undoManager.execute(createAddKeyframeCommand(this, id, kf, index));
          }
        } else {
          this.addKeyframe(id, clampedTime);
        }
      }
      this._render();
    });

    // Drag on timeline (scrub)
    let dragging = false;
    let wasPlaying = false;

    this.viewport.addEventListener('mousedown', (e) => {
      if (e.target.closest('.tl-pro-block') || e.target.closest('.tl-pro-track-header')) return;
      dragging = true;
      wasPlaying = this.isPlaying;
      this.pause();
      this._seekAtMouse(e);
    });

    window.addEventListener('mousemove', (e) => {
      if (this._drag) {
        this._updateClipDrag(e);
        return;
      }
      if (!dragging) return;
      const rect = this.viewport.getBoundingClientRect();
      if (e.clientX >= rect.left && e.clientX <= rect.right) {
        this._seekAtMouse(e);
      }
    });

    window.addEventListener('mouseup', () => {
      if (this._drag) {
        const d = this._drag;
        this._drag = null;
        const current = this.sourceTimings.get(d.id);
        if (current && (current.startTime !== d.orig.startTime || current.duration !== d.orig.duration) && this.undoManager) {
          const newTiming = { ...current };
          const oldTiming = { ...d.orig };
          this.sourceTimings.set(d.id, oldTiming);
          this.undoManager.execute(createClipTimingCommand(this, d.id, oldTiming, newTiming));
        }
        this._applyKeyframes();
        this._render();
      }
      if (dragging && wasPlaying) this.play();
      dragging = false;
    });

    // Scroll wheel: scroll horizontally, Cmd/Ctrl+scroll to zoom time
    this.viewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = this.viewport.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const timeAtMouse = (mouseX - this._headerW - this.scrollX) / this.pixelsPerSecond;

      if (e.metaKey || e.ctrlKey) {
        // Zoom time scale
        const factor = e.deltaY > 0 ? 0.9 : 1.1;
        const newPPS = Math.max(3, Math.min(60, this.pixelsPerSecond * factor));
        this.scrollX = mouseX - this._headerW - timeAtMouse * newPPS;
        this.pixelsPerSecond = newPPS;
      } else {
        // Pan / horizontal scroll
        this.scrollX -= e.deltaY;
      }
      this._clampScroll();
      this._render();
    }, { passive: false });

    // Touch: horizontal swipe to scroll
    let touchStartX = 0;
    let touchStartScrollX = 0;
    this.viewport.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartScrollX = this.scrollX;
      }
    }, { passive: true });
    this.viewport.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1) {
        const dx = touchStartX - e.touches[0].clientX;
        this.scrollX = touchStartScrollX + dx;
        this._clampScroll();
        this._render();
      }
    }, { passive: true });
  }

  _updateClipDrag(e) {
    const d = this._drag;
    const t = this.sourceTimings.get(d.id);
    if (!t) { this._drag = null; return; }
    const dt = (e.clientX - d.startX) / this.pixelsPerSecond;

    if (d.mode === 'move') {
      t.startTime = Math.round(Math.max(0, Math.min(this.totalDuration - d.orig.duration, d.orig.startTime + dt)));
    } else if (d.mode === 'right') {
      t.duration = Math.round(Math.max(1, Math.min(this.totalDuration - d.orig.startTime, d.orig.duration + dt)));
    } else {
      const origEnd = d.orig.startTime + d.orig.duration;
      const newStart = Math.round(Math.max(0, Math.min(origEnd - 1, d.orig.startTime + dt)));
      t.startTime = newStart;
      t.duration = origEnd - newStart;
    }
    this._render();
  }

  _clampScroll() {
    const totalWidth = this.totalDuration * this.pixelsPerSecond + 200;
    const viewportW = this.viewport.clientWidth;
    this.scrollX = Math.max(0, Math.min(this.scrollX, totalWidth - viewportW));
  }

  _seekAtMouse(e) {
    const rect = this.viewport.getBoundingClientRect();
    const x = e.clientX - rect.left;
    this.playheadTime = Math.max(0, (x - this._headerW - this.scrollX) / this.pixelsPerSecond);
    if (this.playheadTime > this.totalDuration) this.playheadTime = this.totalDuration;
    this._updatePlayhead();
    this._applyKeyframes();
  }

  togglePlay() {
    this.isPlaying ? this.pause() : this.play();
  }

  play() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this._lastFrameTime = performance.now();
    this.header.querySelector('.tl-pro-play').textContent = '⏸';
    this._loop();
  }

  pause() {
    this.isPlaying = false;
    this.header.querySelector('.tl-pro-play').textContent = '▶';
    if (this._animationFrame) {
      cancelAnimationFrame(this._animationFrame);
      this._animationFrame = null;
    }
    // Hand position control back to canvas automations
    for (const src of this.audioEngine.sources.values()) {
      if (src) src._timelineControlled = false;
    }
  }

  stop() {
    this.pause();
    this.playheadTime = 0;
    this._updatePlayhead();
    this._applyKeyframes();
  }

  /**
   * Change journey length, clamping playhead and clip timings into the new range.
   */
  setTotalDuration(seconds) {
    this.totalDuration = seconds;
    if (this.playheadTime > seconds) this.playheadTime = seconds;
    for (const t of this.sourceTimings.values()) {
      if (t.startTime >= seconds) t.startTime = Math.max(0, seconds - 1);
      t.duration = Math.min(t.duration, seconds - t.startTime);
    }
    this._clampScroll();
    this._updatePlayhead();
    this._syncDurationSelect();
    this._render();
  }

  _syncDurationSelect() {
    const sel = this.header.querySelector('.tl-pro-duration');
    if (!sel) return;
    if (![...sel.options].some(o => parseInt(o.value, 10) === this.totalDuration)) {
      const opt = document.createElement('option');
      opt.value = String(this.totalDuration);
      opt.textContent = `${Math.round(this.totalDuration / 60)} min`;
      sel.appendChild(opt);
    }
    sel.value = String(this.totalDuration);
  }

  _loop() {
    if (!this.isPlaying) return;
    const now = performance.now();
    const dt = (now - this._lastFrameTime) / 1000;
    this._lastFrameTime = now;

    this.playheadTime += dt;

    if (this.playheadTime >= this.totalDuration) {
      if (this.isLooping) {
        this.playheadTime = 0;
      } else {
        this.stop();
        return;
      }
    }

    this._updatePlayhead();
    this._applyKeyframes();
    this._autoScroll();

    this._animationFrame = requestAnimationFrame(() => this._loop());
  }

  _updatePlayhead() {
    const x = this.playheadTime * this.pixelsPerSecond + this.scrollX + this._headerW;
    this.playhead.style.left = `${x}px`;

    // Update time display
    const m = Math.floor(this.playheadTime / 60);
    const s = Math.floor(this.playheadTime % 60);
    this.header.querySelector('.tl-pro-current').textContent =
      `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

    const tm = Math.floor(this.totalDuration / 60);
    const ts = Math.floor(this.totalDuration % 60);
    this.header.querySelector('.tl-pro-total').textContent =
      `${String(tm).padStart(2, '0')}:${String(ts).padStart(2, '0')}`;
  }

  _autoScroll() {
    const viewportW = this.viewport.clientWidth;
    const playheadX = this.playheadTime * this.pixelsPerSecond + this.scrollX + this._headerW;

    // Auto-scroll if playhead near edge
    if (playheadX > viewportW - 100) {
      this.scrollX = -(this.playheadTime * this.pixelsPerSecond - viewportW + 150);
      this._render();
    } else if (playheadX < this._headerW + 50) {
      this.scrollX = -(this.playheadTime * this.pixelsPerSecond - 150);
      this._render();
    }
  }

  /**
   * Sample keyframes at a point in time, interpolating position and volume.
   */
  _sampleKeyframes(kfs, now) {
    const first = kfs[0];
    if (kfs.length === 1 || now <= first.time) {
      return { x: first.x, y: first.y, z: first.z, volume: first.volume };
    }
    const last = kfs[kfs.length - 1];
    if (now >= last.time) {
      return { x: last.x, y: last.y, z: last.z, volume: last.volume };
    }
    let prev = first;
    let next = last;
    for (let i = 0; i < kfs.length - 1; i++) {
      if (now >= kfs[i].time && now <= kfs[i + 1].time) {
        prev = kfs[i];
        next = kfs[i + 1];
        break;
      }
    }
    const span = next.time - prev.time;
    const t = span > 0 ? (now - prev.time) / span : 1;
    const eased = this._ease(t, prev.easing || 'linear');
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

  /**
   * Apply keyframes and clip timings to sources at the current playhead time.
   * Volume has a single owner here: keyframe volume if defined, otherwise the
   * source's own volume — gated by whether the clip window is active.
   */
  _applyKeyframes() {
    const now = this.playheadTime;

    for (const [id, src] of this.audioEngine.sources.entries()) {
      if (!src) continue;
      this.ensureTiming(id);
      const t = this.sourceTimings.get(id);
      const active = now >= t.startTime && now <= (t.startTime + t.duration);

      const kfs = this.keyframes.get(id);
      let kfVolume;
      if (kfs && kfs.length > 0) {
        const state = this._sampleKeyframes(kfs, now);
        this.audioEngine.updateSourcePosition(id, state.x, state.y, state.z);
        kfVolume = state.volume;
        // While the journey plays, keyframes own this source's position
        src._timelineControlled = this.isPlaying;
      } else {
        src._timelineControlled = false;
      }

      if (active && !src.isPlaying) {
        this.audioEngine.toggleSource(id, Math.max(0, now - t.startTime));
      }

      const targetVol = active ? (kfVolume !== undefined ? kfVolume : src.volume) : 0;
      if (src.gainNode && this.audioEngine.ctx) {
        src.gainNode.gain.setTargetAtTime(targetVol, this.audioEngine.ctx.currentTime, 0.05);
      }
    }
  }

  _ease(t, type) {
    switch (type) {
      case 'ease-in': return t * t;
      case 'ease-out': return 1 - (1 - t) * (1 - t);
      case 'ease-in-out': return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      default: return t;
    }
  }

  ensureTiming(id) {
    if (!this.sourceTimings.has(id)) {
      // New sounds span the whole journey by default
      this.sourceTimings.set(id, { startTime: 0, duration: this.totalDuration });
    }
  }

  /**
   * Add a keyframe for a source at the current time or specified time
   */
  addKeyframe(id, time, options = {}) {
    if (!this.keyframes.has(id)) {
      this.keyframes.set(id, []);
    }
    const kfs = this.keyframes.get(id);
    const src = this.audioEngine.sources.get(id);
    if (!src) return;

    const kf = {
      time: time !== undefined ? time : this.playheadTime,
      x: options.x !== undefined ? options.x : src.x,
      y: options.y !== undefined ? options.y : src.y,
      z: options.z !== undefined ? options.z : src.z,
      volume: options.volume !== undefined ? options.volume : src.volume,
      easing: options.easing || 'linear'
    };

    // Insert in sorted order
    const idx = kfs.findIndex(k => k.time > kf.time);
    if (idx === -1) {
      kfs.push(kf);
    } else {
      kfs.splice(idx, 0, kf);
    }
  }

  /**
   * Remove a keyframe by its index in the source's keyframe list.
   */
  removeKeyframe(id, index) {
    const kfs = this.keyframes.get(id);
    if (!kfs || index < 0 || index >= kfs.length) return;
    kfs.splice(index, 1);
    if (kfs.length === 0) this.keyframes.delete(id);
  }

  /**
   * Set predefined keyframes for a journey preset
   */
  setKeyframes(id, keyframes) {
    this.keyframes.set(id, keyframes.map(kf => ({
      time: kf.time || 0,
      x: kf.x || 0,
      y: kf.y || 0,
      z: kf.z || 0,
      volume: kf.volume !== undefined ? kf.volume : 0.5,
      easing: kf.easing || 'linear'
    })));
  }

  toggle() {
    this.visible = !this.visible;
    this.container.style.display = this.visible ? 'block' : 'none';
    if (this.visible) {
      this._render();
      this._updatePlayhead();
    } else {
      this.pause();
    }
    this._reflectVisibility();
  }

  show() { this.visible = true; this.container.style.display = 'block'; this._render(); this._reflectVisibility(); }
  hide() { this.visible = false; this.container.style.display = 'none'; this.pause(); this._reflectVisibility(); }

  // Mirror visibility to <body> so other floating panels can dodge the timeline dock
  _reflectVisibility() {
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.toggle('timeline-open', this.visible);
    }
  }

  _render() {
    if (!this.visible) return;
    const pps = this.pixelsPerSecond;
    const sx = this.scrollX;
    const colors = this.canvasGrid.themeColors;
    const emojiMap = this.canvasGrid.emojiMap || {};

    // Measure track header width so ruler/playhead/lanes share one coordinate system
    const headerEl = this.tracksArea.querySelector('.tl-pro-track-header');
    if (headerEl && headerEl.offsetWidth > 0) this._headerW = headerEl.offsetWidth;

    // Update zoom bar
    const zoomPercent = (pps - 3) / (60 - 3);
    this.header.querySelector('.tl-pro-zoom-fill').style.width = `${zoomPercent * 100}%`;
    this._syncDurationSelect();

    // Ruler
    let rulerHTML = '';
    const majorInt = pps > 20 ? 30 : (pps > 10 ? 60 : 120);
    const minorInt = majorInt / 6;

    for (let t = 0; t <= this.totalDuration; t += minorInt) {
      const isMajor = t % majorInt === 0;
      const left = t * pps + sx + this._headerW;
      if (left < -50 || left > this.viewport.clientWidth + 50) continue;

      const m = Math.floor(t / 60);
      const s = Math.floor(t % 60);
      const label = isMajor ? `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : '';

      rulerHTML += `<div class="tl-pro-tick ${isMajor ? 'tl-pro-tick-major' : ''}" style="left:${left}px">
        ${isMajor ? `<span class="tl-pro-tick-label">${label}</span>` : ''}
      </div>`;
    }
    this.ruler.innerHTML = rulerHTML;

    // Tracks
    const sources = Array.from(this.audioEngine.sources.entries());

    if (sources.length === 0) {
      this.emptyState.style.display = 'flex';
      this.tracksArea.innerHTML = '';
    } else {
      this.emptyState.style.display = 'none';
      let tracksHTML = '';

      sources.forEach(([id, src]) => {
        if (!src) return;
        this.ensureTiming(id);
        const t = this.sourceTimings.get(id);
        const color = colors[src.type] || colors.custom || '#999';
        const emoji = emojiMap[src.type] || '🎵';
        const left = t.startTime * pps + sx;
        const width = Math.max(40, t.duration * pps);
        const label = (src.name || '').substring(0, 20);
        const isActive = this.playheadTime >= t.startTime && this.playheadTime <= (t.startTime + t.duration);

        // Keyframe indicators
        const kfs = this.keyframes.get(id) || [];
        let keyframeDots = '';
        kfs.forEach((kf, ki) => {
          const kfX = kf.time * pps + sx;
          if (kfX >= left && kfX <= left + width) {
            keyframeDots += `<div class="tl-pro-kf" data-kf-index="${ki}" style="left:${kfX - left}px" title="${kf.time.toFixed(1)}s: (${kf.x.toFixed(1)}, ${kf.y.toFixed(1)}) — double-click to remove"></div>`;
          }
        });

        tracksHTML += `
          <div class="tl-pro-track" data-id="${id}">
            <div class="tl-pro-track-header">
              <span class="tl-pro-track-emoji">${emoji}</span>
              <span class="tl-pro-track-name">${label}</span>
            </div>
            <div class="tl-pro-track-lane">
              <div class="tl-pro-block ${isActive ? 'tl-pro-block-active' : ''}"
                   title="Drag to move, drag edges to resize, double-click lane for keyframe"
                   style="left:${left}px;width:${width}px;background:linear-gradient(90deg, ${color}33, ${color}66, ${color}33);border-color:${color}88">
                <div class="tl-pro-block-inner">
                  <span class="tl-pro-block-label">${t.startTime.toFixed(0)}s — ${(t.startTime + t.duration).toFixed(0)}s</span>
                </div>
                <div class="tl-pro-block-keyframes">${keyframeDots}</div>
                <div class="tl-pro-block-edge tl-pro-block-left"></div>
                <div class="tl-pro-block-edge tl-pro-block-right"></div>
              </div>
            </div>
          </div>
        `;
      });

      this.tracksArea.innerHTML = tracksHTML;
    }

    // Set width for scrolling
    const totalW = Math.max(this.viewport.clientWidth, this.totalDuration * pps + 200);
    this.ruler.style.width = totalW + 'px';
    this.tracksArea.style.width = totalW + 'px';
  }
}
