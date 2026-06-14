/**
 * CanvasGrid
 * Manages the interactive 2D/3D canvas rendering and drag-and-drop soundscape controls.
 */
export class CanvasGrid {
  /**
   * @param {HTMLCanvasElement} canvas - The canvas element
   * @param {SpatialAudioEngine} audioEngine - The audio engine instance
   * @param {Object} callbacks - Event callbacks (onNodeSelected, onNodeMoved)
   */
  constructor(canvas, audioEngine, callbacks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.audioEngine = audioEngine;
    this.callbacks = callbacks;

    // Responsive CSS-pixel dimensions (updated on resize)
    this.w = canvas.width || 500;
    this.h = canvas.height || 500;

    // Scale: maps Web Audio units (-10 to 10) to Canvas pixels
    this.unitScale = 25;

    // Selected node ID
    this.selectedNodeId = null;

    // Drag state
    this.draggedNodeId = null;
    this.dragOffset = { x: 0, y: 0 };

    // Mouse hover state
    this.hoveredNodeId = null;

    // Ripple animation trackers: id -> array of ripple objects
    this.ripples = new Map();

    // Fog particles system
    this.particles = [];
    this.particleCount = 60;

    // Automation state
    this.automations = new Map();

    // 3D camera
    this.viewMode = '2d';       // '2d' or '3d'
    this.camPitch = 30;          // tilt degrees 0–65 (default 30° isometric)
    this.camYaw = 0;            // rotation degrees -180..180
    this.camZoom = 1.3;         // zoom level 0.4–2.5 (default zoomed in more)
    this._targetPitch = 30;     // smooth transition target
    this._targetYaw = 0;
    this._targetZoom = 1.3;
    this._velPitch = 0;         // momentum velocity
    this._velYaw = 0;
    this._velZoom = 0;
    this._pinchDist = 0;        // touch tracking
    this._pinchZoom = 1.3;
    this._lastPinchMid = null;

    // View panning (2D/3D)
    this.panX = 0;
    this.panY = 0;
    this._targetPanX = 0;
    this._targetPanY = 0;
    this._velPanX = 0;
    this._velPanY = 0;
    this._isPanning = false;
    this._panStart = { x: 0, y: 0 };
    this._panStartOffset = { x: 0, y: 0 };
    this._isOrbiting = false;
    this._orbitStart = { x: 0, y: 0 };
    this._orbitStartYaw = 0;
    this._orbitStartPitch = 0;

    // Layer editing: 'sources' or 'speakers'
    this.editLayer = 'sources';
    this._draggedSpeakerIdx = -1;

    // Color definitions for sound types
    this.themeColors = {
      birds: '#10b981',     // Green
      train: '#f59e0b',     // Orange
      campfire: '#ef4444',  // Red
      rain: '#3b82f6',      // Blue
      thunder: '#8b5cf6',   // Purple
      waves: '#06b6d4',     // Cyan
      crickets: '#a3e635',  // Lime
      cafe: '#ec4899',      // Pink
      bell: '#a855f7',     // Purple
      gong: '#f97316',     // Orange
      'singing-bowl': '#14b8a6', // Teal
      'wind-chimes': '#38bdf8', // Sky blue
      city_traffic: '#f59e0b', // Orange
      city_park: '#22c55e',    // Green
      subway: '#6366f1',       // Indigo
      jungle_night: '#166534', // Dark green
      monkeys: '#ca8a04',      // Amber
      elephant: '#78716c',     // Warm gray
      leopard: '#eab308',      // Yellow
      jungle_river: '#0e7490', // Cyan
      tropical_birds: '#ec4899', // Pink
      ocean_deep: '#0e7490',    // Deep teal
      whales: '#6366f1',        // Indigo
      dolphins: '#06b6d4',      // Cyan
      underwater_ambient: '#0891b2', // Teal
      custom: '#f43f5e',     // Rose
      'instr_piano': '#e8e8e8',
      'instr_synth-pad': '#8b5cf6',
      'instr_bass': '#f59e0b',
      'instr_strings': '#ec4899',
      'instr_flute': '#06b6d4',
      'instr_bell-synth': '#fbbf24',
      'instr_drone': '#a855f7',
      'instr_arpeggio': '#22d3ee',
      'bw_alpha': '#7c3aed',
      'bw_beta': '#2563eb',
      'bw_theta': '#0891b2',
      'bw_delta': '#4f46e5',
      'bw_gamma': '#db2777',
      'music_speaker': '#f59e0b',
      bowl_c: '#ef4444', bowl_d: '#f97316', bowl_e: '#eab308',
      bowl_f: '#22c55e', bowl_g: '#3b82f6', bowl_a: '#8b5cf6', bowl_b: '#e2e8f0',
    };

    this.emojiMap = {
      birds: '🐦', train: '🚂', campfire: '🪵', rain: '🌧️', thunder: '⚡',
      waves: '🌊', crickets: '🦗', cafe: '☕', bell: '🔔', gong: '🪘',
      'singing-bowl': '🥣', 'wind-chimes': '🎐', city_traffic: '🚗',
      city_park: '🌳', subway: '🚇', jungle_night: '🌴', monkeys: '🐒',
      elephant: '🐘', leopard: '🐆', jungle_river: '🏞️', tropical_birds: '🦜',
      ocean_deep: '🌊', whales: '🐋', dolphins: '🐬', underwater_ambient: '🫧',
      custom: '🎵', 'instr_piano': '🎹', 'instr_synth-pad': '🎛️',
      'instr_bass': '🎸', 'instr_strings': '🎻', 'instr_flute': '🪈',
      'instr_bell-synth': '🔔', 'instr_drone': '🕉️', 'instr_arpeggio': '✨',
      'bw_alpha': '🧘', 'bw_beta': '⚡', 'bw_theta': '😴', 'bw_delta': '💤',
      'bw_gamma': '✨', 'music_speaker': '🎵',
      bowl_c: '🔴', bowl_d: '🟠', bowl_e: '🟡',
      bowl_f: '🟢', bowl_g: '🔵', bowl_a: '🟣', bowl_b: '⚪',
    };
    
    // Cached font string (avoids per-frame getComputedStyle calls)
    this._hudFont = null;

    // Page visibility state
    this._animationFrameId = null;
    this._isPaused = false;

    this.initParticles();
    this.initEvents();
    this.resize();
    this.startAnimation();

    window.addEventListener('resize', () => this.resize());
  }

  /** Lazily compute and cache the UI font string */
  _getUIFont() {
    if (!this._hudFont) {
      this._hudFont = getComputedStyle(document.body).fontFamily;
    }
    return this._hudFont;
  }

  /** Safely add/replace alpha on any color format (hex, rgb, rgba) */
  _withAlpha(color, alpha) {
    if (!color) return `rgba(0,0,0,${alpha})`;
    // Hex to rgba
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    // rgba - replace existing alpha
    if (color.startsWith('rgba')) {
      return color.replace(/rgba\([^)]+\)/, (match) => {
        const parts = match.match(/[\d.]+/g);
        if (parts && parts.length >= 3) {
          return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
        }
        return match;
      });
    }
    // rgb - add alpha
    if (color.startsWith('rgb')) {
      return color.replace('rgb', 'rgba').replace(')', `, ${alpha})`);
    }
    return color;
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    this.w = window.innerWidth || 500;
    this.h = window.innerHeight || 500;
    this.canvas.width = this.w * dpr;
    this.canvas.height = this.h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.unitScale = Math.min(this.w, this.h) / 22;
    this._hudFont = null; // invalidate cached font on resize
    // Re-init particles to fill new canvas area
    this.initParticles();
  }

  /**
   * Initialize fog particles
   */
  initParticles() {
    this.particles = [];
    for (let i = 0; i < this.particleCount; i++) {
      this.particles.push({
        x: Math.random() * this.w,
        y: Math.random() * this.h,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.2,
        size: 1 + Math.random() * 2,
        opacity: 0.04 + Math.random() * 0.08,
      });
    }
  }

  /**
   * Update and wrap fog particles
   */
  updateParticles() {
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      // Wrap around edges
      if (p.x < -5) p.x = this.w + 5;
      if (p.x > this.w + 5) p.x = -5;
      if (p.y < -5) p.y = this.h + 5;
      if (p.y > this.h + 5) p.y = -5;
    }
  }

  /**
   * Draw fog particles
   */
  drawParticles() {
    for (const p of this.particles) {
      this.ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  /**
   * Initialize canvas mouse and drag-drop event listeners
   */
  initEvents() {
    this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    window.addEventListener('mouseup', () => this.handleMouseUp());
    
    // Drag & Drop presets from library
    this.canvas.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });
    
    this.canvas.addEventListener('drop', (e) => {
      e.preventDefault();
      const type = e.dataTransfer.getData('text/plain');
      if (type) {
        const rect = this.canvas.getBoundingClientRect();
        const canvasX = e.clientX - rect.left;
        const canvasY = e.clientY - rect.top;
        const audioPos = this.canvasToAudioCoords(canvasX, canvasY);
        
        if (this.callbacks.onNodeDropped) {
          this.callbacks.onNodeDropped(type, audioPos.x, audioPos.y);
        }
      }
    });

    // Context menu disabled (we use right-click for orbit)
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Page visibility: pause animation when tab is hidden
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this._isPaused = true;
      } else {
        this._isPaused = false;
        this.draw();
      }
    });

    // Scroll: zoom (2D+3D), shift+scroll = pan
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.shiftKey) {
        // Pan with shift+scroll
        this._targetPanX -= e.deltaX * 0.5 / this.camZoom;
        this._targetPanY -= e.deltaY * 0.5 / this.camZoom;
      } else if (this.viewMode === '3d' && (e.metaKey || e.ctrlKey)) {
        // Orbit with cmd+scroll (3D)
        this._velPitch += e.deltaY * 0.008;
        this._velYaw += e.deltaX * 0.008;
        this._velPitch = Math.max(-3, Math.min(3, this._velPitch));
        this._velYaw = Math.max(-3, Math.min(3, this._velYaw));
      } else {
        // Zoom
        const zoomFactor = e.deltaY > 0 ? 0.95 : 1.05;
        this._targetZoom *= zoomFactor;
        this._targetZoom = Math.max(0.3, Math.min(3.0, this._targetZoom));
      }
    }, { passive: false });

    // Touch: pinch-to-zoom (2D+3D) + two-finger rotate (3D only)
    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        this._pinchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        this._pinchZoom = this.camZoom; // snap to current visual zoom
        this._targetZoom = this.camZoom;
        this._lastPinchMid = {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2
        };
        if (this.viewMode === '3d') {
          this._lastPinchAngle = Math.atan2(
            e.touches[0].clientY - e.touches[1].clientY,
            e.touches[0].clientX - e.touches[1].clientX
          );
          this._pinchYaw = this._targetYaw;
        }
      }
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const newDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        if (this._pinchDist < 10) return;
        const rawScale = newDist / this._pinchDist;
        const boostedScale = 1 + (rawScale - 1) * 5.0; // 5x sensitivity
        const tz = Math.max(0.4, Math.min(2.5, this._pinchZoom * boostedScale));
        this._targetZoom = tz;
        this.camZoom = tz;

        if (this.viewMode === '3d') {
          const newAngle = Math.atan2(
            e.touches[0].clientY - e.touches[1].clientY,
            e.touches[0].clientX - e.touches[1].clientX
          );
          const angleDelta = (newAngle - this._lastPinchAngle) * (180 / Math.PI);
          this._targetYaw += angleDelta;
          this._lastPinchAngle = newAngle;
        }
      }
    }, { passive: false });

    // Double-click: smooth zoom in (2D+3D)
    this.canvas.addEventListener('dblclick', (e) => {
      const newZoom = Math.min(2.5, this._targetZoom * 1.5);
      this.flyTo(this._targetPitch, this._targetYaw, newZoom, 0, 0, 350);
    });
  }

  /**
   * Convert Canvas coordinates (pixels) to Web Audio space (-10 to 10)
   * Accounts for pan and zoom
   */
  canvasToAudioCoords(cx, cy) {
    const centerX = this.w / 2 + this.panX;
    const centerY = this.h / 2 + this.panY;

    return {
      x: (cx - centerX) / this.unitScale,
      y: (centerY - cy) / this.unitScale // positive y is up/forward
    };
  }

  /**
   * Convert Web Audio space (-10 to 10) to Canvas coordinates (pixels)
   * Accounts for pan and zoom
   */
  audioToCanvasCoords(ax, ay) {
    const centerX = this.w / 2 + this.panX;
    const centerY = this.h / 2 + this.panY;

    return {
      x: centerX + (ax * this.unitScale),
      y: centerY - (ay * this.unitScale) // positive y is up/forward
    };
  }

  /**
   * Find node under mouse cursor
   */
  getNodeAtPosition(cx, cy) {
    for (const [id, src] of this.audioEngine.sources.entries()) {
      const pos = this.audioToCanvasCoords(src.x, src.y);
      const dist = Math.hypot(cx - pos.x, cy - pos.y);
      const radius = this.getNodeRadius(src.z);
      if (dist <= radius + 5) {
        return id;
      }
    }
    return null;
  }

  /** Find speaker under cursor */
  _getSpeakerAtPosition(cx, cy) {
    const positions = this.audioEngine.speakerPositions;
    if (!positions) return -1;
    for (let i = 0; i < positions.length; i++) {
      const pos = this.audioToCanvasCoords(positions[i].x, positions[i].y);
      if (Math.hypot(cx - pos.x, cy - pos.y) <= 14) return i;
    }
    return -1;
  }

  /**
   * Calculate node radius based on height Z (-10 to 10)
   */
  getNodeRadius(z) {
    // Standard height (0) has radius 16.
    // Height -10 has radius 8, height +10 has radius 26.
    return 16 + (z * 0.8);
  }

  handleMouseDown(e) {
    const rect = this.canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    // Right-click (button 2): Orbit (3D) or Pan (2D)
    if (e.button === 2) {
      e.preventDefault();
      this._isOrbiting = true;
      this._orbitStart = { x: e.clientX, y: e.clientY };
      this._orbitStartYaw = this._targetYaw;
      this._orbitStartPitch = this._targetPitch;
      this.canvas.style.cursor = this.viewMode === '3d' ? 'all-scroll' : 'move';
      return;
    }

    // Middle-click (button 1): Pan
    if (e.button === 1) {
      e.preventDefault();
      this._isPanning = true;
      this._panStart = { x: e.clientX, y: e.clientY };
      this._panStartOffset = { x: this._targetPanX, y: this._targetPanY };
      this.canvas.style.cursor = 'move';
      return;
    }

    // Speaker edit mode: handle speaker dragging
    if (this.editLayer === 'speakers') {
      const spIdx = this._getSpeakerAtPosition(cx, cy);
      if (spIdx >= 0) {
        this._draggedSpeakerIdx = spIdx;
        this.canvas.style.cursor = 'grabbing';
        return;
      }
      return;
    }
    
    const nodeId = this.getNodeAtPosition(cx, cy);
    
    if (nodeId) {
      this.draggedNodeId = nodeId;
      this.selectedNodeId = nodeId;
      
      const node = this.audioEngine.sources.get(nodeId);
      const pos = this.audioToCanvasCoords(node.x, node.y);
      this.dragOffset = { x: cx - pos.x, y: cy - pos.y };
      this._dragStartY = e.clientY;
      this._dragStartZ = node ? node.z : 0;
      this._dragStartPos = node ? { x: node.x, y: node.y, z: node.z } : null;
      
      if (this.callbacks.onNodeSelected) {
        this.callbacks.onNodeSelected(node);
      }
    } else {
      // Clicked empty space: start panning
      this._isPanning = true;
      this._panStart = { x: e.clientX, y: e.clientY };
      this._panStartOffset = { x: this._targetPanX, y: this._targetPanY };
      this.canvas.style.cursor = 'move';
      
      // Deselect
      this.selectedNodeId = null;
      if (this.callbacks.onNodeSelected) {
        this.callbacks.onNodeSelected(null);
      }
    }
  }

  handleMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    // Orbit (right-click drag)
    if (this._isOrbiting) {
      const dx = e.clientX - this._orbitStart.x;
      const dy = e.clientY - this._orbitStart.y;
      if (this.viewMode === '3d') {
        this._targetYaw = this._orbitStartYaw + dx * 0.5;
        this._targetPitch = Math.max(2, Math.min(68, this._orbitStartPitch - dy * 0.5));
      } else {
        // In 2D, right-click also pans
        this._targetPanX = this._panStartOffset.x + dx;
        this._targetPanY = this._panStartOffset.y + dy;
      }
      return;
    }

    // Pan (middle-click or left-click on empty)
    if (this._isPanning) {
      const dx = e.clientX - this._panStart.x;
      const dy = e.clientY - this._panStart.y;
      this._targetPanX = this._panStartOffset.x + dx;
      this._targetPanY = this._panStartOffset.y + dy;
      return;
    }

    // Speaker dragging
    if (this._draggedSpeakerIdx >= 0) {
      const audioCoords = this.canvasToAudioCoords(cx, cy);
      const sp = this.audioEngine.speakerPositions?.[this._draggedSpeakerIdx];
      if (sp) {
        sp.x = Math.max(-10, Math.min(10, audioCoords.x));
        sp.y = Math.max(-10, Math.min(10, audioCoords.y));
        if (this.audioEngine._speakerConfig) {
          this.audioEngine._speakerConfig.customSpeakers[this._draggedSpeakerIdx].x = sp.x;
          this.audioEngine._speakerConfig.customSpeakers[this._draggedSpeakerIdx].y = sp.y;
        }
        this.audioEngine.setOutputMode(this.audioEngine.outputMode, this.audioEngine.speakerPositions, this.audioEngine.channelCount);
      }
      this.canvas.style.cursor = 'grabbing';
      return;
    }
    
    if (this.draggedNodeId) {
      // Command+drag (Mac) / Ctrl+drag (Win): adjust Z height
      if ((e.metaKey || e.ctrlKey) && this.draggedNodeId) {
        this.canvas.style.cursor = 'row-resize';
        const node = this.audioEngine.sources.get(this.draggedNodeId);
        if (node) {
          const deltaY = (this._dragStartY - e.clientY) * 0.1;
          const newZ = Math.max(-10, Math.min(10, this._dragStartZ + deltaY));
          this.audioEngine.updateSourcePosition(this.draggedNodeId, node.x, node.y, newZ);

          const zIndicator = document.getElementById('z-indicator');
          if (zIndicator) {
            zIndicator.style.display = 'block';
            zIndicator.style.left = e.clientX + 'px';
            zIndicator.style.top = e.clientY + 'px';
            zIndicator.textContent = `Z: ${newZ.toFixed(1)}m`;
          }

          if (this.callbacks.onNodeMoved) {
            this.callbacks.onNodeMoved(node);
          }
        }
        return;
      }

      // Dragging a node
      this.canvas.style.cursor = 'grabbing';
      
      const targetCx = cx - this.dragOffset.x;
      const targetCy = cy - this.dragOffset.y;
      
      const audioCoords = this.canvasToAudioCoords(targetCx, targetCy);
      audioCoords.x = Math.max(-10, Math.min(10, audioCoords.x));
      audioCoords.y = Math.max(-10, Math.min(10, audioCoords.y));
      
      this.audioEngine.updateSourcePosition(this.draggedNodeId, audioCoords.x, audioCoords.y);
      
      if (this.automations.has(this.draggedNodeId)) {
        const auto = this.automations.get(this.draggedNodeId);
        auto.angle = Math.atan2(audioCoords.y, audioCoords.x);
        auto.radius = Math.hypot(audioCoords.x, audioCoords.y);
      }
      
      if (this.callbacks.onNodeMoved) {
        const node = this.audioEngine.sources.get(this.draggedNodeId);
        this.callbacks.onNodeMoved(node);
      }
    } else {
      // Just moving mouse
      const nodeId = this.getNodeAtPosition(cx, cy);
      if (nodeId) {
        this.canvas.style.cursor = 'pointer';
        this.hoveredNodeId = nodeId;
      } else {
        this.canvas.style.cursor = this._isPanning || this._isOrbiting ? 'move' : 'default';
        this.hoveredNodeId = null;
      }
    }
  }

  handleMouseUp() {
    if (this.draggedNodeId && this._dragStartPos) {
      const node = this.audioEngine.sources.get(this.draggedNodeId);
      if (node) {
        const oldPos = this._dragStartPos;
        const newPos = { x: node.x, y: node.y, z: node.z };
        const hasMoved = oldPos.x !== newPos.x || oldPos.y !== newPos.y || oldPos.z !== newPos.z;
        if (hasMoved && this.callbacks.onNodeDragEnd) {
          this.callbacks.onNodeDragEnd(this.draggedNodeId, oldPos.x, oldPos.y, oldPos.z, newPos.x, newPos.y, newPos.z);
        }
      }
    }
    this.draggedNodeId = null;
    this._dragStartPos = null;
    this._draggedSpeakerIdx = -1;
    this._isPanning = false;
    this._isOrbiting = false;
    const zIndicator = document.getElementById('z-indicator');
    if (zIndicator) zIndicator.style.display = 'none';
    this._zIndicator = null;
    this.canvas.style.cursor = 'default';
  }

  /**
   * Configure node automation pathing
   */
  setAutomation(id, type, enabled = true, options = {}) {
    if (!enabled) {
      this.automations.delete(id);
      return;
    }
    
    const node = this.audioEngine.sources.get(id);
    if (!node) return;
    
    const speed = options.speed || 0.015;
    const radius = Math.hypot(node.x, node.y) || 5;
    const angle = Math.atan2(node.y, node.x);
    
    const entry = {
      type,
      speed,
      radius: Math.max(1.5, Math.min(9, radius)),
      angle,
      direction: 1 // for ping-pong
    };

    if (type === 'breathe') {
      entry.baseX = node.x;
      entry.baseY = node.y;
      entry.baseVol = node.volume;
    } else if (type === 'drift') {
      entry.driftTarget = null;
      entry.driftTimeout = 0;
    }

    this.automations.set(id, entry);
  }

  /**
   * Run the rendering and physics animation loops
   */
  startAnimation() {
    const loop = () => {
      if (!this._isPaused && !document.hidden) {
        this._smoothCamera();
        this.updatePhysics();
        this.updateParticles();
        this.draw();
      }
      this._animationFrameId = requestAnimationFrame(loop);
    };
    this._animationFrameId = requestAnimationFrame(loop);
  }

  /** Smoothly interpolate camera with momentum/inertia */
  _smoothCamera() {
    const dt = 0.016;
    const friction = 0.88;
    const stiffness = 0.22;

    this._targetPitch += this._velPitch * dt;
    this._targetYaw += this._velYaw * dt;
    this._targetZoom *= 1 + this._velZoom * dt;

    this._velPitch *= friction;
    this._velYaw *= friction;
    this._velZoom *= friction;

    this._targetPitch = Math.max(2, Math.min(68, this._targetPitch));
    this._targetZoom = Math.max(0.3, Math.min(3.0, this._targetZoom));

    this.camPitch += (this._targetPitch - this.camPitch) * stiffness;
    this.camYaw += (this._targetYaw - this.camYaw) * stiffness;
    this.camZoom += (this._targetZoom - this.camZoom) * stiffness;
    
    // Smooth pan
    this.panX += (this._targetPanX - this.panX) * stiffness;
    this.panY += (this._targetPanY - this.panY) * stiffness;
    
    this.unitScale = (Math.min(this.w, this.h) / 22) * this.camZoom;
  }

  /** Smooth fly-to animation for camera */
  flyTo(pitch, yaw, zoom, panX = 0, panY = 0, duration = 600) {
    const startPitch = this._targetPitch;
    const startYaw = this._targetYaw;
    const startZoom = this._targetZoom;
    const startPanX = this._targetPanX;
    const startPanY = this._targetPanY;
    const start = performance.now();

    const animate = (now) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      const ease = 1 - Math.pow(1 - t, 3);

      this._targetPitch = startPitch + (pitch - startPitch) * ease;
      this._targetYaw = startYaw + (yaw - startYaw) * ease;
      this._targetZoom = startZoom + (zoom - startZoom) * ease;
      this._targetPanX = startPanX + (panX - startPanX) * ease;
      this._targetPanY = startPanY + (panY - startPanY) * ease;

      if (t < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }

  /** Reset view to default */
  resetView() {
    this.flyTo(
      this.viewMode === '3d' ? 30 : 0,
      0,
      1.3,
      0, 0, // reset pan
      400
    );
  }

  /** Zoom toward a specific point on canvas */
  zoomAt(cx, cy, factor) {
    const newZoom = Math.max(0.4, Math.min(2.5, this._targetZoom * factor));
    this._targetZoom = newZoom;
  }

  /**
   * Calculate automated movement paths and audio update logic
   */
  updatePhysics() {
    if (this._isPaused) return;
    const time = Date.now() * 0.001;
    
    for (const [id, auto] of this.automations.entries()) {
      const node = this.audioEngine.sources.get(id);
      if (!node) {
        this.automations.delete(id);
        continue;
      }

      // While a timeline journey is playing, its keyframes own this source
      if (node._timelineControlled) continue;

      if (auto.type === 'orbit') {
        // Orbit listener in circular path
        auto.angle += auto.speed;
        const x = auto.radius * Math.cos(auto.angle);
        const y = auto.radius * Math.sin(auto.angle);
        
        this.audioEngine.updateSourcePosition(id, x, y);
        if (this.selectedNodeId === id && this.callbacks.onNodeMoved) {
          this.callbacks.onNodeMoved(node);
        }
      } else if (auto.type === 'pingpong') {
        // Slide left and right
        const amplitude = auto.radius;
        const x = amplitude * Math.sin(time * auto.speed * 8);
        const y = node.y; // Keep current depth
        
        this.audioEngine.updateSourcePosition(id, x, y);
        if (this.selectedNodeId === id && this.callbacks.onNodeMoved) {
          this.callbacks.onNodeMoved(node);
        }
      } else if (auto.type === 'drift') {
        // Gentle random walk: slowly move in random directions
        if (!auto.driftTarget || Date.now() > auto.driftTimeout) {
          auto.driftTarget = {
            x: (Math.random() - 0.5) * auto.radius * 2,
            y: (Math.random() - 0.5) * auto.radius * 2
          };
          auto.driftTimeout = Date.now() + 2000 + Math.random() * 3000;
        }
        const dx = auto.driftTarget.x - node.x;
        const dy = auto.driftTarget.y - node.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0.1) {
          const nx = node.x + dx * auto.speed * 0.5;
          const ny = node.y + dy * auto.speed * 0.5;
          this.audioEngine.updateSourcePosition(id, 
            Math.max(-10, Math.min(10, nx)),
            Math.max(-10, Math.min(10, ny))
          );
        }
        if (this.selectedNodeId === id && this.callbacks.onNodeMoved) {
          this.callbacks.onNodeMoved(node);
        }
      } else if (auto.type === 'breathe') {
        // Expand and contract from center like breathing
        auto.angle += auto.speed;
        const breathe = 1 + 0.3 * Math.sin(auto.angle * 2);
        const x = auto.baseX * breathe;
        const y = auto.baseY * breathe;
        this.audioEngine.updateSourcePosition(id, 
          Math.max(-10, Math.min(10, x)),
          Math.max(-10, Math.min(10, y))
        );
        // Modulate volume too for breathing effect — modulate around the captured
        // base volume; updateSourceVolume mutates node.volume, so using node.volume
        // here would compound the modulation into silence
        if (auto.baseVol === undefined) auto.baseVol = node.volume;
        const volMod = 0.5 + 0.5 * Math.sin(auto.angle * 2);
        this.audioEngine.updateSourceVolume(id, auto.baseVol * (0.7 + 0.3 * volMod));
        if (this.selectedNodeId === id && this.callbacks.onNodeMoved) {
          this.callbacks.onNodeMoved(node);
        }
      }
    }
    
    // Update visual sound wave ripples
    for (const [id, node] of this.audioEngine.sources.entries()) {
      if (!node.isPlaying) continue;
      
      // Initialize ripple array
      if (!this.ripples.has(id)) {
        this.ripples.set(id, []);
      }
      
      const nodeRipples = this.ripples.get(id);
      
      // Add ripple based on volume
      const maxRipples = Math.ceil(node.volume * 5);
      if (nodeRipples.length < maxRipples && Math.random() < 0.04) {
        nodeRipples.push({
          radius: this.getNodeRadius(node.z),
          opacity: 0.8,
          speed: 0.8 + (node.volume * 0.8)
        });
      }
      
      // Update existing ripples
      for (let i = nodeRipples.length - 1; i >= 0; i--) {
        const r = nodeRipples[i];
        r.radius += r.speed;
        r.opacity -= 0.015;
        
        // Remove dead ripples
        if (r.opacity <= 0) {
          nodeRipples.splice(i, 1);
        }
      }
    }
  }

  /**
   * Main render canvas frame function
   */
  draw() {
    if (this._isPaused) return;
    // Clear, then lay a translucent warm wash so the leopard backdrop (a layer
    // behind the canvas element) reads through as ambient wallpaper.
    this.ctx.clearRect(0, 0, this.w, this.h);
    this.ctx.fillStyle = 'rgba(26, 22, 20, 0.78)';
    this.ctx.fillRect(0, 0, this.w, this.h);

    // Subtle fog gradient from bottom
    const fogGrad = this.ctx.createLinearGradient(0, this.h * 0.6, 0, this.h);
    fogGrad.addColorStop(0, 'rgba(40, 28, 20, 0)');
    fogGrad.addColorStop(1, 'rgba(40, 28, 20, 0.32)');
    this.ctx.fillStyle = fogGrad;
    this.ctx.fillRect(0, 0, this.w, this.h);

    // Center glow for listener position
    const cx = this.w / 2;
    const cy = this.h / 2;
    const centerGlow = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, this.unitScale * 3);
    centerGlow.addColorStop(0, 'rgba(255, 210, 170, 0.05)');
    centerGlow.addColorStop(1, 'rgba(255, 210, 170, 0)');
    this.ctx.fillStyle = centerGlow;
    this.ctx.fillRect(0, 0, this.w, this.h);

    // Draw fog particles (behind grid)
    this.drawParticles();

    if (this.viewMode === '3d') {
      const pitchRad = this.camPitch * Math.PI / 180;
      const yawRad = this.camYaw * Math.PI / 180;
      const zoom = this.camZoom;

      this.ctx.save();
      this.ctx.translate(cx, cy);
      // Isometric projection: yaw rotates horizontally, pitch tilts vertically, zoom scales
      this.ctx.transform(
        zoom * Math.cos(yawRad), zoom * Math.sin(yawRad) * 0.35,
        -zoom * Math.sin(yawRad) * 0.35, zoom * (0.7 + 0.3 * Math.cos(pitchRad)),
        0, 0
      );
      this.ctx.translate(-cx, -cy);
    }
    
    this.drawGrid();
    this.drawTrails();
    this._drawKeyframePath();
    this.drawListener();
    this.drawEmitters();
    this.drawSpeakers();

    if (this.viewMode === '3d') {
      this.ctx.restore();
    }

    this._drawZoomHUD();
    if (this.viewMode === '3d') {
      this._draw3DAxisWidget();
    }
  }

  /** Draw 3D axis indicator widget (bottom-left) */
  _draw3DAxisWidget() {
    const ox = 46, oy = this.h - 50;
    const len = 22;
    const time = Date.now() * 0.001;
    const pulse = 0.7 + Math.sin(time * 2) * 0.15;

    this.ctx.save();
    
    // X-axis (red)
    this.ctx.strokeStyle = `rgba(255,60,60,${pulse})`;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(ox, oy);
    this.ctx.lineTo(ox + len, oy);
    this.ctx.stroke();
    this.ctx.fillStyle = 'rgba(255,255,255,0.5)';
    this.ctx.font = '9px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('X', ox + len + 10, oy + 4);
    
    // Y-axis (green)
    this.ctx.strokeStyle = `rgba(60,255,60,${pulse})`;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(ox, oy);
    this.ctx.lineTo(ox, oy - len);
    this.ctx.stroke();
    this.ctx.fillText('Y', ox, oy - len - 8);
    
    // Z-axis (blue)
    this.ctx.strokeStyle = `rgba(60,140,255,${pulse})`;
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([2, 2]);
    this.ctx.beginPath();
    this.ctx.moveTo(ox, oy);
    this.ctx.lineTo(ox + len * 0.35, oy - len * 0.85);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
    this.ctx.fillText('Z', ox + len * 0.35 + 10, oy - len * 0.85 + 4);
    
    // Origin dot
    this.ctx.fillStyle = 'rgba(255,255,255,0.6)';
    this.ctx.beginPath();
    this.ctx.arc(ox, oy, 3, 0, Math.PI * 2);
    this.ctx.fill();
    
    this.ctx.restore();
  }

  /** Draw zoom/controls HUD overlay (2D + 3D) */
  _drawZoomHUD() {
    const pad = 14;
    const y = this.h - 32;
    const font = '10px ' + this._getUIFont();

    this.ctx.font = font;
    this.ctx.textAlign = 'left';
    this.ctx.fillStyle = 'rgba(255,255,255,0.35)';
    this.ctx.fillText(`${Math.round(this.camZoom * 100)}%`, pad, y + 8);

    if (this.viewMode === '3d') {
      this.ctx.textAlign = 'right';
      this.ctx.fillStyle = 'rgba(255,255,255,0.35)';
      this.ctx.fillText(`↕${Math.round(this.camPitch)}°  ↻${Math.round(this.camYaw)}°`, this.w - pad, y + 8);

      this.ctx.textAlign = 'center';
      this.ctx.fillStyle = 'rgba(255,255,255,0.18)';
      this.ctx.font = '9px ' + this._getUIFont();
      this.ctx.fillText('⌘+scroll orbit · scroll/pinch/dblclick zoom', this.w / 2, y + 8);
    } else {
      this.ctx.textAlign = 'center';
      this.ctx.fillStyle = 'rgba(255,255,255,0.18)';
      this.ctx.font = '9px ' + this._getUIFont();
      this.ctx.fillText('scroll/pinch/dblclick zoom', this.w / 2, y + 8);
    }
  }

  /**
   * Draw the visual background grid — Technical spatial display
   */
  drawGrid() {
    const w = this.w;
    const h = this.h;
    const cx = w / 2 + this.panX;
    const cy = h / 2 + this.panY;
    const time = Date.now() * 0.0005;
    
    // 3D mode: perspective grid lines
    if (this.viewMode === '3d') {
      this.ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      this.ctx.lineWidth = 0.5;
      this.ctx.setLineDash([1, 3]);
      const step = this.unitScale;
      for (let i = -12; i <= 12; i++) {
        const y = cy - i * step * 0.35;
        this.ctx.beginPath();
        this.ctx.moveTo(0, y);
        this.ctx.lineTo(w, y);
        this.ctx.stroke();
      }
      this.ctx.setLineDash([]);
    }
    
    // Concentric distance rings — clearly visible
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    this.ctx.lineWidth = 1;
    for (let r = 1; r <= 10; r++) {
      const baseRadius = r * this.unitScale;
      const pulse = Math.sin(time * 0.5 + r * 0.3) * 0.02 + 1;
      const radius = baseRadius * pulse;
      
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      this.ctx.stroke();
      
      // Distance labels every 2 meters
      if (r % 2 === 0) {
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        this.ctx.font = '9px -apple-system, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`${r}m`, cx + radius + 8, cy - 2);
      }
    }
    
    // Cardinal crosshairs — solid and visible
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(cx, 0);
    this.ctx.lineTo(cx, h);
    this.ctx.stroke();
    this.ctx.beginPath();
    this.ctx.moveTo(0, cy);
    this.ctx.lineTo(w, cy);
    this.ctx.stroke();
    
    // Axis tick marks every unit
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    this.ctx.lineWidth = 0.5;
    for (let i = -10; i <= 10; i++) {
      if (i === 0) continue;
      const tickLen = 3;
      const pos = i * this.unitScale;
      // X-axis ticks
      this.ctx.beginPath();
      this.ctx.moveTo(cx + pos, cy - tickLen);
      this.ctx.lineTo(cx + pos, cy + tickLen);
      this.ctx.stroke();
      // Y-axis ticks
      this.ctx.beginPath();
      this.ctx.moveTo(cx - tickLen, cy - pos);
      this.ctx.lineTo(cx + tickLen, cy - pos);
      this.ctx.stroke();
    }
    
    // Compass Labels
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.30)';
    this.ctx.font = 'bold 10px -apple-system, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('FRONT', cx, cy - this.unitScale * 10 - 8);
    this.ctx.fillText('BACK', cx, cy + this.unitScale * 10 + 16);
    this.ctx.textAlign = 'left';
    this.ctx.fillText('LEFT', cx - this.unitScale * 10 - 32, cy + 4);
    this.ctx.textAlign = 'right';
    this.ctx.fillText('RIGHT', cx + this.unitScale * 10 + 32, cy + 4);
    
    // Center indicator
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    this.ctx.fill();
  }

  /**
   * Draw soft, glowing trail lines from sounds to listener
   */
  drawTrails() {
    const cx = this.w / 2;
    const cy = this.h / 2;
    
    for (const [id, src] of this.audioEngine.sources.entries()) {
      if (!src.isPlaying) continue;
      
      const pos = this.audioToCanvasCoords(src.x, src.y);
      const color = this.themeColors[src.type] || this.themeColors.custom;
      const isSelected = this.selectedNodeId === id;
      const isHovered = this.hoveredNodeId === id;
      
      // Only apply shadow for selected/hovered sources
      if (isSelected || isHovered) {
        this.ctx.shadowColor = color;
        this.ctx.shadowBlur = 4;
      }
      this.ctx.strokeStyle = this._withAlpha(color, 0.12);
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.moveTo(cx, cy);
      this.ctx.lineTo(pos.x, pos.y);
      this.ctx.stroke();
      this.ctx.shadowBlur = 0;
      
      // Inner bright line
      this.ctx.strokeStyle = this._withAlpha(color, 0.08);
      this.ctx.lineWidth = 0.8;
      this.ctx.beginPath();
      this.ctx.moveTo(cx, cy);
      this.ctx.lineTo(pos.x, pos.y);
      this.ctx.stroke();
    }
  }

  /**
   * Draw the listener figure at center — always fixed in center.
   * Schematic/technical blueprint style. Shows headphones or speakers.
   */
  drawListener() {
    const cx = this.w / 2;
    const cy = this.h / 2;
    const levels = this.audioEngine.getLeftRightLevels();
    const posture = this.audioEngine.posture;
    const headTilt = this.audioEngine.headTilt;
    const tiltRad = (headTilt * Math.PI) / 180;
    const outputMode = this.audioEngine.outputMode || 'hrtf';

    this.ctx.save();
    this.ctx.translate(cx, cy);

    // Schematic style — blueprint/cad look
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    if (posture === 'standing') {
      this._drawSchematicStanding(levels, tiltRad, outputMode);
    } else if (posture === 'lying-back') {
      this._drawSchematicLyingBack(levels, tiltRad, outputMode);
    } else {
      this._drawSchematicLyingSide(levels, tiltRad, outputMode);
    }

    this.ctx.restore();
  }

  /**
   * Schematic standing figure — blueprint/technical style
   */
  _drawSchematicStanding(levels, tiltRad, outputMode) {
    const isHeadphones = outputMode === 'hrtf' || !outputMode;
    const primaryColor = isHeadphones ? 'rgba(255, 139, 89, 0.8)' : 'rgba(0, 204, 102, 0.8)';
    const secondaryColor = isHeadphones ? 'rgba(242, 111, 59, 0.5)' : 'rgba(0, 153, 51, 0.5)';
    
    this.ctx.save();
    this.ctx.rotate(tiltRad);
    
    // Technical blueprint outline — body as simple geometric shapes
    this.ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    this.ctx.lineWidth = 1.2;
    this.ctx.fillStyle = 'rgba(255,255,255,0.04)';
    
    // Body — rounded rectangle (torso)
    this.ctx.beginPath();
    this.ctx.roundRect(-10, -18, 20, 36, 6);
    this.ctx.fill();
    this.ctx.stroke();
    
    // Shoulders line
    this.ctx.beginPath();
    this.ctx.moveTo(-16, -8);
    this.ctx.lineTo(16, -8);
    this.ctx.stroke();
    
    // Head — circle with tech styling
    this.ctx.beginPath();
    this.ctx.arc(0, -28, 12, 0, Math.PI * 2);
    this.ctx.fillStyle = 'rgba(255,255,255,0.06)';
    this.ctx.fill();
    this.ctx.stroke();
    
    // Direction indicator (arrow pointing forward/up)
    this.ctx.fillStyle = 'rgba(255,255,255,0.5)';
    this.ctx.beginPath();
    this.ctx.moveTo(0, -42);
    this.ctx.lineTo(-3, -36);
    this.ctx.lineTo(3, -36);
    this.ctx.closePath();
    this.ctx.fill();
    
    // Ears / Headphone or Speaker indicators
    const earGlowL = levels.left > 0.03;
    const earGlowR = levels.right > 0.03;
    
    if (isHeadphones) {
      // Headphone arch
      this.ctx.strokeStyle = primaryColor;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(0, -28, 18, Math.PI * 0.8, Math.PI * 0.2, true);
      this.ctx.stroke();
      
      // Left ear cup
      this.ctx.fillStyle = earGlowL ? secondaryColor : 'rgba(255,255,255,0.08)';
      this.ctx.beginPath();
      this.ctx.arc(-14, -28, 4, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.strokeStyle = earGlowL ? primaryColor : 'rgba(255,255,255,0.2)';
      this.ctx.stroke();
      
      // Right ear cup
      this.ctx.fillStyle = earGlowR ? secondaryColor : 'rgba(255,255,255,0.08)';
      this.ctx.beginPath();
      this.ctx.arc(14, -28, 4, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.strokeStyle = earGlowR ? primaryColor : 'rgba(255,255,255,0.2)';
      this.ctx.stroke();
    } else {
      // Speaker indicators — small triangles at ears
      this.ctx.fillStyle = earGlowL ? primaryColor : 'rgba(255,255,255,0.15)';
      this.ctx.beginPath();
      this.ctx.moveTo(-18, -28);
      this.ctx.lineTo(-14, -31);
      this.ctx.lineTo(-14, -25);
      this.ctx.closePath();
      this.ctx.fill();
      
      this.ctx.fillStyle = earGlowR ? primaryColor : 'rgba(255,255,255,0.15)';
      this.ctx.beginPath();
      this.ctx.moveTo(18, -28);
      this.ctx.lineTo(14, -31);
      this.ctx.lineTo(14, -25);
      this.ctx.closePath();
      this.ctx.fill();
    }
    
    // Audio level rings
    const maxLevel = Math.max(levels.left, levels.right);
    if (maxLevel > 0.02) {
      const time = Date.now() * 0.005;
      const ringR = 24 + maxLevel * 8 + Math.sin(time) * 2;
      
      this.ctx.strokeStyle = primaryColor;
      this.ctx.lineWidth = 1.5;
      this.ctx.globalAlpha = 0.3 + maxLevel * 0.4;
      this.ctx.beginPath();
      this.ctx.arc(0, -28, ringR, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.globalAlpha = 1;
      
      // Pulsing glow
      const glowGrad = this.ctx.createRadialGradient(0, -28, 15, 0, -28, ringR + 4);
      glowGrad.addColorStop(0, 'rgba(0,0,0,0)');
      glowGrad.addColorStop(0.5, this._withAlpha(primaryColor, 0.15));
      glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
      this.ctx.fillStyle = glowGrad;
      this.ctx.beginPath();
      this.ctx.arc(0, -28, ringR + 4, 0, Math.PI * 2);
      this.ctx.fill();
    }
    
    // Label: H (headphones) or S (speakers)
    this.ctx.fillStyle = 'rgba(255,255,255,0.4)';
    this.ctx.font = 'bold 8px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(isHeadphones ? '🎧' : '🔊', 0, 8);
    
    this.ctx.restore();
  }

  /**
   * Schematic lying-on-back figure
   */
  _drawSchematicLyingBack(levels, tiltRad, outputMode) {
    const isHeadphones = outputMode === 'hrtf' || !outputMode;
    const primaryColor = isHeadphones ? 'rgba(255, 139, 89, 0.8)' : 'rgba(0, 204, 102, 0.8)';
    const earGlowL = levels.left > 0.03;
    const earGlowR = levels.right > 0.03;
    
    this.ctx.save();
    this.ctx.rotate(tiltRad);
    
    // Body horizontal — simple rounded rect
    this.ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    this.ctx.lineWidth = 1.2;
    this.ctx.fillStyle = 'rgba(255,255,255,0.04)';
    
    this.ctx.beginPath();
    this.ctx.roundRect(-40, -10, 80, 20, 8);
    this.ctx.fill();
    this.ctx.stroke();
    
    // Head at top
    this.ctx.beginPath();
    this.ctx.arc(44, 0, 10, 0, Math.PI * 2);
    this.ctx.fillStyle = 'rgba(255,255,255,0.06)';
    this.ctx.fill();
    this.ctx.stroke();
    
    // Direction arrow
    this.ctx.fillStyle = 'rgba(255,255,255,0.5)';
    this.ctx.beginPath();
    this.ctx.moveTo(56, 0);
    this.ctx.lineTo(50, -3);
    this.ctx.lineTo(50, 3);
    this.ctx.closePath();
    this.ctx.fill();
    
    // Ears
    if (isHeadphones) {
      this.ctx.strokeStyle = primaryColor;
      this.ctx.lineWidth = 1.5;
      this.ctx.beginPath();
      this.ctx.arc(44, 0, 14, Math.PI * 0.3, -Math.PI * 0.3, true);
      this.ctx.stroke();
      
      this.ctx.fillStyle = earGlowL ? 'rgba(255, 139, 89,0.3)' : 'rgba(255,255,255,0.08)';
      this.ctx.beginPath();
      this.ctx.arc(40, -10, 3, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.fillStyle = earGlowR ? 'rgba(255, 139, 89,0.3)' : 'rgba(255,255,255,0.08)';
      this.ctx.beginPath();
      this.ctx.arc(40, 10, 3, 0, Math.PI * 2);
      this.ctx.fill();
    } else {
      this.ctx.fillStyle = earGlowL ? primaryColor : 'rgba(255,255,255,0.15)';
      this.ctx.beginPath();
      this.ctx.moveTo(38, -12);
      this.ctx.lineTo(42, -10);
      this.ctx.lineTo(42, -14);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.fillStyle = earGlowR ? primaryColor : 'rgba(255,255,255,0.15)';
      this.ctx.beginPath();
      this.ctx.moveTo(38, 12);
      this.ctx.lineTo(42, 10);
      this.ctx.lineTo(42, 14);
      this.ctx.closePath();
      this.ctx.fill();
    }
    
    // Label
    this.ctx.fillStyle = 'rgba(255,255,255,0.4)';
    this.ctx.font = 'bold 8px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(isHeadphones ? '🎧' : '🔊', 0, 6);
    
    this.ctx.restore();
  }

  /**
   * Schematic lying-on-side figure
   */
  _drawSchematicLyingSide(levels, tiltRad, outputMode) {
    const isHeadphones = outputMode === 'hrtf' || !outputMode;
    const primaryColor = isHeadphones ? 'rgba(255, 139, 89, 0.8)' : 'rgba(0, 204, 102, 0.8)';
    const earGlow = levels.left > 0.03;
    
    this.ctx.save();
    this.ctx.rotate(tiltRad);
    
    // Body vertical — rounded rect
    this.ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    this.ctx.lineWidth = 1.2;
    this.ctx.fillStyle = 'rgba(255,255,255,0.04)';
    
    this.ctx.beginPath();
    this.ctx.roundRect(-8, -35, 16, 70, 6);
    this.ctx.fill();
    this.ctx.stroke();
    
    // Head at top
    this.ctx.beginPath();
    this.ctx.arc(0, -42, 10, 0, Math.PI * 2);
    this.ctx.fillStyle = 'rgba(255,255,255,0.06)';
    this.ctx.fill();
    this.ctx.stroke();
    
    // Direction arrow (facing right)
    this.ctx.fillStyle = 'rgba(255,255,255,0.5)';
    this.ctx.beginPath();
    this.ctx.moveTo(14, -42);
    this.ctx.lineTo(8, -45);
    this.ctx.lineTo(8, -39);
    this.ctx.closePath();
    this.ctx.fill();
    
    // Ear (single, on top side)
    if (isHeadphones) {
      this.ctx.strokeStyle = primaryColor;
      this.ctx.lineWidth = 1.5;
      this.ctx.beginPath();
      this.ctx.arc(0, -42, 14, -Math.PI * 0.7, Math.PI * 0.7, false);
      this.ctx.stroke();
      
      this.ctx.fillStyle = earGlow ? 'rgba(255, 139, 89,0.3)' : 'rgba(255,255,255,0.08)';
      this.ctx.beginPath();
      this.ctx.arc(0, -54, 3.5, 0, Math.PI * 2);
      this.ctx.fill();
    } else {
      this.ctx.fillStyle = earGlow ? primaryColor : 'rgba(255,255,255,0.15)';
      this.ctx.beginPath();
      this.ctx.moveTo(-4, -56);
      this.ctx.lineTo(0, -54);
      this.ctx.lineTo(0, -58);
      this.ctx.closePath();
      this.ctx.fill();
    }
    
    // Label
    this.ctx.fillStyle = 'rgba(255,255,255,0.4)';
    this.ctx.font = 'bold 8px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(isHeadphones ? '🎧' : '🔊', 0, 12);
    
    this.ctx.restore();
  }

  /**
   * Draw a glass-style figure with common pattern: save/translate, body, head, ears, visualizer, restore.
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} config
   * @param {Object} config.tint - Color palette {body, outline, earFill, glow}
   * @param {Object} config.groundShadow - {x, y, rx, ry} for ground shadow ellipse
   * @param {Function} config.drawBody - Callback to draw body parts (ctx, tint) => void
   * @param {Object} config.head - {x, y, rx, ry, rotation, faceDrawFn}
   * @param {Array} config.ears - Array of {x, y, rx, ry, levelKey} for each ear
   * @param {Object} config.visualizer - {radius, arcStart, arcSweep} for audio visualizer
   * @param {Array} config.levelBars - Array of {x, y, levelKey, width} for ear level bars
   */
  _drawGlassFigure(ctx, config) {
    const { tint, groundShadow, drawBody, head, ears, visualizer, levelBars } = config;
    const levels = this.audioEngine.getLeftRightLevels();

    ctx.save();

    // Ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.20)';
    ctx.beginPath();
    ctx.ellipse(groundShadow.x, groundShadow.y, groundShadow.rx, groundShadow.ry, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body parts (caller-defined)
    drawBody(ctx, tint);

    // Head section
    ctx.save();
    ctx.translate(head.x, head.y);
    ctx.rotate(head.rotation);

    // Head shape
    ctx.fillStyle = '#1c1c1e';
    ctx.strokeStyle = tint.outline;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, head.rx, head.ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Face features (caller-defined)
    if (head.faceDrawFn) {
      head.faceDrawFn(ctx, tint);
    }

    // Ears
    for (const ear of ears) {
      const levelValue = levels[ear.levelKey] || 0;
      ctx.fillStyle = tint.earFill;
      ctx.strokeStyle = levelValue > 0.03 ? 'rgba(242, 111, 59, 0.6)' : tint.outline;
      ctx.beginPath();
      ctx.ellipse(ear.x, ear.y, ear.rx, ear.ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Headphone arch
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, visualizer.radius - 2, visualizer.arcStart, visualizer.arcStart + visualizer.arcSweep, visualizer.arcCounterClockwise);
    ctx.stroke();

    // Audio visualizer
    const maxLevel = Math.max(levels.left, levels.right);
    if (maxLevel > 0.02) {
      ctx.strokeStyle = 'rgba(242, 111, 59, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = 'rgba(242, 111, 59, 0.4)';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(0, 0, visualizer.radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * maxLevel);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Glow
      const pulseR = visualizer.radius + maxLevel * 5;
      const glowGrad = ctx.createRadialGradient(0, 0, visualizer.radius - 2, 0, 0, pulseR);
      glowGrad.addColorStop(0, 'rgba(242, 111, 59, 0)');
      glowGrad.addColorStop(0.7, `rgba(242, 111, 59, ${maxLevel * 0.15})`);
      glowGrad.addColorStop(1, 'rgba(242, 111, 59, 0)');
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(0, 0, pulseR, 0, Math.PI * 2);
      ctx.fill();
    }

    // Ear level bars
    for (const bar of levelBars) {
      const levelValue = levels[bar.levelKey] || 0;
      if (levelValue > 0.03) {
        const barH = Math.min(levelValue * bar.maxHeight, bar.maxHeight);
        ctx.fillStyle = levelValue > 0.3 ? 'rgba(242, 111, 59, 0.8)' : 'rgba(255,255,255,0.12)';
        ctx.fillRect(bar.x, bar.y - barH / 2, bar.width, Math.max(barH, 1));
      }
    }

    ctx.restore(); // head rotation
    ctx.restore(); // main
  }

  /**
   * Draw realistic lying-on-back figure (supine)
   */
  _drawLyingBackFigure(levels, tiltRad) {
    const tint = {
      body: 'rgba(100,160,240,0.12)',
      outline: 'rgba(135,200,255,0.30)',
      earFill: 'rgba(100,160,240,0.10)',
      glow: 'rgba(100,160,240,0.06)'
    };

    this._drawGlassFigure(this.ctx, {
      tint,
      groundShadow: { x: 0, y: 8, rx: 75, ry: 14 },
      drawBody: (ctx, tint) => {
        ctx.fillStyle = tint.body;
        ctx.strokeStyle = tint.outline;
        ctx.lineWidth = 1.3;

        // Left leg
        ctx.beginPath();
        ctx.moveTo(-50, 8);
        ctx.lineTo(-55, 8);
        ctx.lineTo(-58, 6);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(-60, 5, 4, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Right leg
        ctx.beginPath();
        ctx.moveTo(50, 8);
        ctx.lineTo(55, 8);
        ctx.lineTo(58, 6);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(60, 5, 4, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Hips
        ctx.beginPath();
        ctx.ellipse(-45, 8, 7, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(45, 8, 7, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Waist
        ctx.beginPath();
        ctx.roundRect(-38, 2, 76, 12, 6);
        ctx.fill();
        ctx.stroke();

        // Chest
        ctx.beginPath();
        ctx.roundRect(-32, -6, 64, 12, 8);
        ctx.fill();
        ctx.stroke();

        // Shoulders
        ctx.beginPath();
        ctx.ellipse(-30, -6, 10, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(30, -6, 10, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Left arm
        ctx.beginPath();
        ctx.moveTo(-30, -6);
        ctx.lineTo(-38, 4);
        ctx.lineTo(-38, 14);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(-38, 16, 3.5, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Right arm
        ctx.beginPath();
        ctx.moveTo(30, -6);
        ctx.lineTo(38, 4);
        ctx.lineTo(38, 14);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(38, 16, 3.5, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Neck
        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.lineTo(0, -12);
        ctx.stroke();
      },
      head: {
        x: 0, y: -20, rx: 11, ry: 13, rotation: tiltRad,
        faceDrawFn: (ctx, tint) => {
          ctx.fillStyle = tint.outline;
          ctx.beginPath();
          ctx.arc(0, -12, 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          ctx.beginPath();
          ctx.arc(-4, -7, 1, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(4, -7, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      },
      ears: [
        { x: -14, y: 0, rx: 3, ry: 5.5, levelKey: 'left' },
        { x: 14, y: 0, rx: 3, ry: 5.5, levelKey: 'right' }
      ],
      visualizer: { radius: 22, arcStart: Math.PI * 0.85, arcSweep: Math.PI * 0.7, arcCounterClockwise: true },
      levelBars: [
        { x: -20, y: 0, levelKey: 'left', width: 2, maxHeight: 22 },
        { x: 18, y: 0, levelKey: 'right', width: 2, maxHeight: 22 }
      ]
    });
  }

  /**
   * Draw realistic lying-on-side figure (lateral)
   */
  _drawLyingSideFigure(levels, tiltRad) {
    const tint = {
      body: 'rgba(220,170,40,0.12)',
      outline: 'rgba(255,200,100,0.30)',
      earFill: 'rgba(220,170,40,0.10)',
      glow: 'rgba(220,170,40,0.06)'
    };

    this._drawGlassFigure(this.ctx, {
      tint,
      groundShadow: { x: 0, y: 52, rx: 22, ry: 5 },
      drawBody: (ctx, tint) => {
        ctx.fillStyle = tint.body;
        ctx.strokeStyle = tint.outline;
        ctx.lineWidth = 1.3;

        // Left leg (lower, bent)
        ctx.beginPath();
        ctx.moveTo(-3, 42);
        ctx.lineTo(-4, 50);
        ctx.lineTo(-2, 56);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(-1, 58, 3, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Right leg (upper, straight-ish)
        ctx.beginPath();
        ctx.moveTo(3, 42);
        ctx.lineTo(4, 52);
        ctx.lineTo(6, 58);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(7, 60, 3, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Hips
        ctx.beginPath();
        ctx.ellipse(0, 38, 8, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Waist
        ctx.beginPath();
        ctx.roundRect(-7, 24, 14, 14, 5);
        ctx.fill();
        ctx.stroke();

        // Chest
        ctx.beginPath();
        ctx.roundRect(-9, 10, 18, 16, 7);
        ctx.fill();
        ctx.stroke();

        // Lower arm
        ctx.beginPath();
        ctx.moveTo(-8, 16);
        ctx.lineTo(-12, 24);
        ctx.lineTo(-8, 32);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(-7, 34, 3, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Upper arm
        ctx.beginPath();
        ctx.moveTo(8, 14);
        ctx.lineTo(12, 22);
        ctx.lineTo(10, 30);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(9, 32, 3, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Neck
        ctx.beginPath();
        ctx.moveTo(0, 6);
        ctx.lineTo(0, 2);
        ctx.stroke();
      },
      head: {
        x: 0, y: -6, rx: 10, ry: 12, rotation: -Math.PI / 2 + tiltRad,
        faceDrawFn: (ctx, tint) => {
          ctx.fillStyle = tint.outline;
          ctx.beginPath();
          ctx.moveTo(9, -2);
          ctx.lineTo(13, -1);
          ctx.lineTo(9, 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          ctx.beginPath();
          ctx.arc(5, -4, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      },
      ears: [
        { x: 0, y: -14, rx: 3, ry: 5.5, levelKey: 'left' }
      ],
      visualizer: { radius: 20, arcStart: Math.PI * 0.2, arcSweep: Math.PI * 0.6, arcCounterClockwise: false },
      levelBars: [
        { x: -2, y: -18, levelKey: 'left', width: 2, maxHeight: 20 }
      ]
    });
  }

  /**
   * Draw sound sources with glow effects and soft wave ripples
   */
  /**
   * Order sources back-to-front so nearer nodes overlap farther ones
   * (painter's algorithm). Depth uses the projected screen-Y: in 3D this
   * matches the iso transform's vertical mapping, in 2D it's just lower = nearer.
   */
  _depthSortedSources() {
    const entries = [...this.audioEngine.sources.entries()];
    const cx = this.w / 2;
    const cy = this.h / 2;
    let b = 0;
    let d = 1;
    if (this.viewMode === '3d') {
      const yawRad = this.camYaw * Math.PI / 180;
      const pitchRad = this.camPitch * Math.PI / 180;
      const zoom = this.camZoom;
      b = zoom * Math.sin(yawRad) * 0.35;
      d = zoom * (0.7 + 0.3 * Math.cos(pitchRad));
    }
    return entries
      .map(entry => {
        const pos = this.audioToCanvasCoords(entry[1].x, entry[1].y);
        return { entry, depth: b * (pos.x - cx) + d * (pos.y - cy) };
      })
      .sort((a, z) => a.depth - z.depth)
      .map(o => o.entry);
  }

  drawEmitters() {
    for (const [id, src] of this._depthSortedSources()) {
      const pos = this.audioToCanvasCoords(src.x, src.y);
      const color = this.themeColors[src.type] || this.themeColors.custom;
      const isSelected = this.selectedNodeId === id;
      const isHovered = this.hoveredNodeId === id;
      const radius = this.getNodeRadius(src.z);
      
      const emoji = this.emojiMap[src.type] || this.emojiMap.custom;

      // Calculate visual position with Z offset
      const heightOffset = src.z * 0.8;
      const nodeY = pos.y - heightOffset;
      const shadowY = pos.y + 12;

      // 0. 3D mode elevation stalk
      if (this.viewMode === '3d') {
        const stalkLen = src.z * this.unitScale * 0.15;
        const groundY = pos.y + Math.abs(stalkLen);
        const topY = pos.y - Math.max(0, stalkLen);
        const bottomY = pos.y + Math.max(0, -stalkLen);

        // Ground shadow
        this.ctx.fillStyle = 'rgba(0,0,0,0.2)';
        this.ctx.beginPath();
        this.ctx.ellipse(pos.x, groundY, radius * 0.7, 3, 0, 0, Math.PI * 2);
        this.ctx.fill();

        // Gradient stalk
        if (Math.abs(stalkLen) > 2) {
          const grad = this.ctx.createLinearGradient(pos.x, topY, pos.x, bottomY);
          grad.addColorStop(0, `rgba(255,255,255,0.02)`);
          grad.addColorStop(0.5, `rgba(255,255,255,0.12)`);
          grad.addColorStop(1, `rgba(255,255,255,0.02)`);
          this.ctx.strokeStyle = grad;
          this.ctx.lineWidth = 2;
          this.ctx.beginPath();
          this.ctx.moveTo(pos.x, topY);
          this.ctx.lineTo(pos.x, bottomY);
          this.ctx.stroke();
        }

        // Z height label
        const zText = `${src.z > 0 ? '+' : ''}${src.z.toFixed(1)}m`;
        this.ctx.font = '9px ' + this._getUIFont();
        const tw = this.ctx.measureText(zText).width;
        const labelY = stalkLen > 0 ? topY - 10 : bottomY + 12;
        this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
        this.ctx.beginPath();
        this.ctx.roundRect(pos.x - tw / 2 - 5, labelY - 8, tw + 10, 15, 6);
        this.ctx.fill();
        this.ctx.fillStyle = 'rgba(255,255,255,0.5)';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(zText, pos.x, labelY + 4);
      }

      // 1. Soft ground shadow (diffuse, elliptical)
      const shadowRadius = Math.max(5, radius - (src.z * 0.6));
      const shadowGrad = this.ctx.createRadialGradient(pos.x, shadowY, 0, pos.x, shadowY, shadowRadius * 1.5);
      shadowGrad.addColorStop(0, `rgba(0, 0, 0, ${0.25 - src.z * 0.02})`);
      shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      this.ctx.fillStyle = shadowGrad;
      this.ctx.beginPath();
      this.ctx.ellipse(pos.x, shadowY, shadowRadius * 1.5, shadowRadius * 0.4, 0, 0, Math.PI * 2);
      this.ctx.fill();

      // 2. Z-Height connection line (gradient, not dashed)
      if (Math.abs(src.z) > 0.5) {
        const lineGrad = this.ctx.createLinearGradient(pos.x, nodeY, pos.x, shadowY);
        lineGrad.addColorStop(0, `rgba(255, 255, 255, 0.08)`);
        lineGrad.addColorStop(0.5, `rgba(255, 255, 255, 0.15)`);
        lineGrad.addColorStop(1, `rgba(255, 255, 255, 0.05)`);
        this.ctx.strokeStyle = lineGrad;
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();
        this.ctx.moveTo(pos.x, nodeY);
        this.ctx.lineTo(pos.x, shadowY);
        this.ctx.stroke();
      }

      // 3. Glow ripples (soft, luminous waves)
      const ripples = this.ripples.get(id) || [];
      for (const r of ripples) {
        const rippleGrad = this.ctx.createRadialGradient(pos.x, nodeY, r.radius * 0.8, pos.x, nodeY, r.radius * 1.1);
        rippleGrad.addColorStop(0, `rgba(0, 0, 0, 0)`);
        rippleGrad.addColorStop(0.5, this._withAlpha(color, r.opacity * 0.4));
        rippleGrad.addColorStop(1, `rgba(0, 0, 0, 0)`);
        
        this.ctx.fillStyle = rippleGrad;
        this.ctx.beginPath();
        this.ctx.arc(pos.x, nodeY, r.radius * 1.1, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Inner bright ring
        this.ctx.strokeStyle = this._withAlpha(color, r.opacity * 0.6);
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.arc(pos.x, nodeY, r.radius, 0, Math.PI * 2);
        this.ctx.stroke();
      }

      // 4. Outer glow ring
      if (isSelected || isHovered) {
        const glowRadius = radius + (isSelected ? 10 : 6);
        const glowOpacity = isSelected ? 0.3 : 0.15;
        const glowColor = isSelected ? 'rgba(242, 111, 59' : this._withAlpha(color, 0).replace(/, 0\)$/, '');
        const glowGrad = this.ctx.createRadialGradient(pos.x, nodeY, radius, pos.x, nodeY, glowRadius + 5);
        glowGrad.addColorStop(0, `${glowColor}, 0)`);
        glowGrad.addColorStop(0.5, `${glowColor}, ${glowOpacity})`);
        glowGrad.addColorStop(1, `${glowColor}, 0)`);
        this.ctx.fillStyle = glowGrad;
        this.ctx.beginPath();
        this.ctx.arc(pos.x, nodeY, glowRadius + 5, 0, Math.PI * 2);
        this.ctx.fill();
      }

      // 5. Selected pulse ring
      if (isSelected) {
        const pulseTime = Date.now() * 0.003;
        const pulseRadius = radius + 8 + Math.sin(pulseTime) * 3;
        this.ctx.strokeStyle = `rgba(242, 111, 59, ${0.2 + Math.sin(pulseTime) * 0.1})`;
        this.ctx.lineWidth = 1.5;
        this.ctx.shadowColor = 'rgba(242, 111, 59, 0.3)';
        this.ctx.shadowBlur = 10;
        this.ctx.beginPath();
        this.ctx.arc(pos.x, nodeY, pulseRadius, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;
      }
      
      // 6. Node circle
      this.ctx.fillStyle = '#1c1c1e';
      this.ctx.strokeStyle = isSelected ? 'rgba(242, 111, 59, 0.8)' : (isHovered ? 'rgba(255, 255, 255, 0.5)' : color);
      this.ctx.lineWidth = isSelected ? 2 : 1;
      this.ctx.beginPath();
      this.ctx.arc(pos.x, nodeY, radius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();
      
      // 7. Emoji with soft shadow for depth
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = `${radius * 1.1}px -apple-system, sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      this.ctx.shadowBlur = 4;
      this.ctx.fillText(emoji, pos.x, nodeY);
      this.ctx.shadowBlur = 0;
      
      // 8. Pause badge
      if (!src.isPlaying) {
        this.ctx.fillStyle = 'rgba(28, 28, 30, 0.85)';
        this.ctx.beginPath();
        this.ctx.arc(pos.x + radius - 4, nodeY - radius + 4, 6, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.fillStyle = '#ff453a';
        this.ctx.font = '7px -apple-system, sans-serif';
        this.ctx.fillText('⏸', pos.x + radius - 4, nodeY - radius + 4);
      }
      
      // 9. Label with soft shadow
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      this.ctx.font = '9px -apple-system, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      this.ctx.shadowBlur = 3;
      this.ctx.fillText(src.name, pos.x, nodeY - radius - 6);
      this.ctx.shadowBlur = 0;

      // Z height label
      if (Math.abs(src.z) > 0.3) {
        this.ctx.fillStyle = 'rgba(255,255,255,0.45)';
        this.ctx.font = '8px ' + this._getUIFont();
        this.ctx.fillText(`${src.z > 0 ? '+' : ''}${src.z.toFixed(1)}m`, pos.x, nodeY - radius - 17);
      }
    }
  }

  drawSpeakers() {
    const config = this.audioEngine.speakerConfig || {};
    const mode = this.audioEngine.outputMode || 'hrtf';

    if (mode === 'hrtf') {
      const cp = this.audioToCanvasCoords(0, 0);
      this.ctx.font = '22px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('🎧', cp.x, cp.y);
      return;
    }

    const positions = this.audioEngine.speakerPositions;
    if (!positions || positions.length === 0) return;

    positions.forEach((sp, i) => {
      const pos = this.audioToCanvasCoords(sp.x, sp.y);
      const isEditMode = this.editLayer === 'speakers';
      const isDragging = this._draggedSpeakerIdx === i;

      this.ctx.fillStyle = isDragging ? 'rgba(242, 111, 59, 0.30)' : 'rgba(242, 111, 59, 0.12)';
      this.ctx.strokeStyle = isEditMode ? '#ff8b59' : '#f26f3b';
      this.ctx.lineWidth = isEditMode ? 2 : 1.5;
      this.ctx.beginPath();
      this.ctx.roundRect(pos.x - 12, pos.y - 9, 24, 18, 5);
      this.ctx.fill();
      this.ctx.stroke();

      this.ctx.fillStyle = isEditMode ? '#ff8b59' : '#f26f3b';
      this.ctx.font = '9px -apple-system, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(sp.label, pos.x, pos.y + 4);

      if (sp.angle !== undefined) {
        this.ctx.strokeStyle = 'rgba(242, 111, 59, 0.15)';
        this.ctx.setLineDash([2, 3]);
        this.ctx.beginPath();
        this.ctx.moveTo(pos.x, pos.y);
        const rad = sp.angle * Math.PI / 180;
        this.ctx.lineTo(pos.x + Math.sin(rad) * 18, pos.y - Math.cos(rad) * 18);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
      }
    });

    for (const [id, src] of this.audioEngine.sources.entries()) {
      if (!src.isPlaying) continue;
      const sp = this.audioToCanvasCoords(src.x, src.y);
      const color = this.themeColors[src.type] || this.themeColors.custom;

      let nearest = null, nearestDist = Infinity;
      positions.forEach(p => {
        const rp = this.audioToCanvasCoords(p.x, p.y);
        const d = Math.hypot(sp.x - rp.x, sp.y - rp.y);
        if (d < nearestDist) { nearestDist = d; nearest = rp; }
      });

      if (nearest) {
        this.ctx.strokeStyle = color;
        this.ctx.globalAlpha = 0.12;
        this.ctx.lineWidth = 0.8;
        this.ctx.setLineDash([3, 5]);
        this.ctx.beginPath();
        this.ctx.moveTo(sp.x, sp.y);
        this.ctx.lineTo(nearest.x, nearest.y);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        this.ctx.globalAlpha = 1;
      }
    }
  }

  /**
   * Draw the keyframe movement path for the currently selected node.
   * Renders a dashed polyline through each keyframe position plus a dot
   * per keyframe, using the node's theme colour at reduced opacity so it
   * sits subtly behind the emitter node without cluttering the view.
   */
  _drawKeyframePath() {
    // Guard: needs timeline, a selection, and at least 2 keyframes
    if (!this.timeline) return;
    if (!this.selectedNodeId) return;

    const kfs = this.timeline.keyframes && this.timeline.keyframes.get
      ? this.timeline.keyframes.get(this.selectedNodeId)
      : null;
    if (!kfs || kfs.length < 2) return;

    // Determine the colour from the selected source's type
    const src = this.audioEngine.sources && this.audioEngine.sources.get
      ? this.audioEngine.sources.get(this.selectedNodeId)
      : null;
    const type = src ? src.type : null;
    const color = (type && this.themeColors[type]) ? this.themeColors[type] : '#ffffff';

    const ctx = this.ctx;
    ctx.save();

    // --- Dashed polyline ---
    ctx.beginPath();
    ctx.setLineDash([5, 6]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = this._withAlpha(color, 0.35);

    for (let i = 0; i < kfs.length; i++) {
      const kf = kfs[i];
      const pos = this.audioToCanvasCoords(kf.x, kf.y);
      // Apply the same z-based vertical offset used when drawing nodes
      const screenY = pos.y - (kf.z || 0) * 0.8;

      if (i === 0) {
        ctx.moveTo(pos.x, screenY);
      } else {
        ctx.lineTo(pos.x, screenY);
      }
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // --- Dots at each keyframe position ---
    for (let i = 0; i < kfs.length; i++) {
      const kf = kfs[i];
      const pos = this.audioToCanvasCoords(kf.x, kf.y);
      const screenY = pos.y - (kf.z || 0) * 0.8;

      const isFirst = i === 0;
      const dotRadius = isFirst ? 4.5 : 3;
      const dotAlpha = isFirst ? 0.7 : 0.55;

      ctx.beginPath();
      ctx.arc(pos.x, screenY, dotRadius, 0, Math.PI * 2);
      ctx.fillStyle = this._withAlpha(color, dotAlpha);
      ctx.fill();

      // Thin border ring for contrast
      ctx.strokeStyle = this._withAlpha(color, dotAlpha * 0.5);
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    ctx.restore();
  }
}
