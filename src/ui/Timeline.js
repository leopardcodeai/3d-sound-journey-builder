/**
 * Timeline Pro — Professional multitrack timeline for designing spatial sound journeys.
 * Features: Keyframe-based spatial animation, glass UI, play/loop/scrub, journey export.
 */
export class Timeline {
  constructor(container, audioEngine, canvasGrid) {
    this.container = container;
    this.audioEngine = audioEngine;
    this.canvasGrid = canvasGrid;
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
      <div style="opacity:0.6">Add sounds from the library to design your journey</div>
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

    // Zoom
    this.header.querySelector('.tl-pro-zoom-in').addEventListener('click', () => {
      this.pixelsPerSecond = Math.min(60, this.pixelsPerSecond * 1.3);
      this._render();
    });
    this.header.querySelector('.tl-pro-zoom-out').addEventListener('click', () => {
      this.pixelsPerSecond = Math.max(3, this.pixelsPerSecond / 1.3);
      this._render();
    });

    // Drag on timeline
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
      if (!dragging) return;
      const rect = this.viewport.getBoundingClientRect();
      if (e.clientX >= rect.left && e.clientX <= rect.right) {
        this._seekAtMouse(e);
      }
    });

    window.addEventListener('mouseup', () => {
      if (dragging && wasPlaying) this.play();
      dragging = false;
    });

    // Scroll wheel: scroll horizontally, Cmd/Ctrl+scroll to zoom time
    this.viewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = this.viewport.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const timeAtMouse = (mouseX - this.scrollX) / this.pixelsPerSecond;
      
      if (e.metaKey || e.ctrlKey) {
        // Zoom time scale
        const factor = e.deltaY > 0 ? 0.9 : 1.1;
        const newPPS = Math.max(3, Math.min(60, this.pixelsPerSecond * factor));
        this.scrollX = mouseX - timeAtMouse * newPPS;
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

  _clampScroll() {
    const totalWidth = this.totalDuration * this.pixelsPerSecond + 200;
    const viewportW = this.viewport.clientWidth;
    this.scrollX = Math.max(0, Math.min(this.scrollX, totalWidth - viewportW));
  }

  _seekAtMouse(e) {
    const rect = this.viewport.getBoundingClientRect();
    const x = e.clientX - rect.left;
    this.playheadTime = Math.max(0, (x - this.scrollX) / this.pixelsPerSecond);
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
  }

  stop() {
    this.pause();
    this.playheadTime = 0;
    this._updatePlayhead();
    this._applyKeyframes();
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
    const x = this.playheadTime * this.pixelsPerSecond + this.scrollX;
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
    const playheadX = this.playheadTime * this.pixelsPerSecond + this.scrollX;
    
    // Auto-scroll if playhead near edge
    if (playheadX > viewportW - 100) {
      this.scrollX = -(this.playheadTime * this.pixelsPerSecond - viewportW + 150);
      this._render();
    } else if (playheadX < 100) {
      this.scrollX = -(this.playheadTime * this.pixelsPerSecond - 150);
      this._render();
    }
  }

  /**
   * Apply keyframe positions to sources based on current playhead time
   */
  _applyKeyframes() {
    const now = this.playheadTime;
    
    for (const [id, kfs] of this.keyframes.entries()) {
      if (!kfs || kfs.length < 2) continue;
      
      // Find surrounding keyframes
      let prev = kfs[0];
      let next = kfs[kfs.length - 1];
      
      for (let i = 0; i < kfs.length - 1; i++) {
        if (now >= kfs[i].time && now <= kfs[i + 1].time) {
          prev = kfs[i];
          next = kfs[i + 1];
          break;
        }
      }
      
      if (now < kfs[0].time) {
        // Before first keyframe — use first position
        const kf = kfs[0];
        this.audioEngine.updateSourcePosition(id, kf.x, kf.y, kf.z);
        if (kf.volume !== undefined) this.audioEngine.updateSourceVolume(id, kf.volume);
      } else if (now > kfs[kfs.length - 1].time) {
        // After last keyframe — use last position
        const kf = kfs[kfs.length - 1];
        this.audioEngine.updateSourcePosition(id, kf.x, kf.y, kf.z);
        if (kf.volume !== undefined) this.audioEngine.updateSourceVolume(id, kf.volume);
      } else {
        // Interpolate between keyframes
        const t = (now - prev.time) / (next.time - prev.time);
        const eased = this._ease(t, prev.easing || 'linear');
        
        const x = prev.x + (next.x - prev.x) * eased;
        const y = prev.y + (next.y - prev.y) * eased;
        const z = prev.z + (next.z - prev.z) * eased;
        this.audioEngine.updateSourcePosition(id, x, y, z);
        
        if (prev.volume !== undefined && next.volume !== undefined) {
          const vol = prev.volume + (next.volume - prev.volume) * eased;
          this.audioEngine.updateSourceVolume(id, vol);
        }
      }
    }

    // Sync audio timing (mute/unmute based on sourceTimings)
    for (const [id, src] of this.audioEngine.sources.entries()) {
      this.ensureTiming(id);
      const t = this.sourceTimings.get(id);
      const active = now >= t.startTime && now <= (t.startTime + t.duration);
      
      if (!src._timelineVolume) src._timelineVolume = src.volume;
      
      if (active && !src.isPlaying) {
        this.audioEngine.toggleSource(id);
      }
      
      const targetVol = active ? (src._timelineVolume || src.volume) : 0;
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
      this.sourceTimings.set(id, { startTime: 0, duration: 60 });
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
  }

  show() { this.visible = true; this.container.style.display = 'block'; this._render(); }
  hide() { this.visible = false; this.container.style.display = 'none'; this.pause(); }

  _render() {
    if (!this.visible) return;
    const pps = this.pixelsPerSecond;
    const sx = this.scrollX;
    const colors = this.canvasGrid.themeColors;
    const emojiMap = this.canvasGrid.emojiMap || {};

    // Update zoom bar
    const zoomPercent = (pps - 3) / (60 - 3);
    this.header.querySelector('.tl-pro-zoom-fill').style.width = `${zoomPercent * 100}%`;

    // Ruler
    let rulerHTML = '';
    const majorInt = pps > 20 ? 30 : (pps > 10 ? 60 : 120);
    const minorInt = majorInt / 6;
    
    for (let t = 0; t <= this.totalDuration; t += minorInt) {
      const isMajor = t % majorInt === 0;
      const left = t * pps + sx;
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
      
      sources.forEach(([id, src], idx) => {
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
        kfs.forEach(kf => {
          const kfX = kf.time * pps + sx;
          if (kfX >= left && kfX <= left + width) {
            keyframeDots += `<div class="tl-pro-kf" style="left:${kfX - left}px" title="${kf.time.toFixed(1)}s: (${kf.x.toFixed(1)}, ${kf.y.toFixed(1)})" />`;
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
