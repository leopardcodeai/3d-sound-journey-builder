/**
 * CanvasGrid: the spatial view.
 * Renders the sound field (ground grid, listener, sources, motion paths,
 * speakers) through a real camera so 2D (top-down orthographic) and 3D
 * (tilted perspective orbit) are the same scene, and handles pointer input:
 * select, drag on the ground plane, lift (height), pan, orbit, zoom, pinch.
 *
 * Coordinates: world metres (x right, y forward, z up). Screen space comes
 * from Camera.project; pointer positions go back through Camera.screenToPlane.
 */
import { Camera } from './Camera.js';
import { getSound, buildColorMap } from '../data/SoundLibrary.js';
import { drawGlyph } from './Icons.js';

const raf = (fn) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(fn) : setTimeout(fn, 16));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const FIELD_RADIUS = 10;
const ACCENT = '#f26f3b';
const ACCENT_RGB = '242, 111, 59';

export class CanvasGrid {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {SpatialAudioEngine} audioEngine
   * @param {Object} callbacks onNodeSelected, onNodeMoved, onNodeDragEnd, onNodeDropped, onNodeActivated, onViewChanged
   */
  constructor(canvas, audioEngine, callbacks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.audioEngine = audioEngine;
    this.callbacks = callbacks;

    this.w = canvas.width || 500;
    this.h = canvas.height || 500;
    this._baseScale = Math.min(this.w, this.h) / 22;
    this.unitScale = 25;

    this.selectedNodeId = null;
    this.draggedNodeId = null;
    this.hoveredNodeId = null;

    this.ripples = new Map();
    this.automations = new Map();
    this._levels = new Map();

    // Camera state (animated toward targets)
    this.viewMode = '2d';
    this.camPitch = 90; this._targetPitch = 90;
    this.camYaw = 0;    this._targetYaw = 0;
    this.camZoom = 1.3; this._targetZoom = 1.3;
    this.persp = 0;     this._targetPersp = 0;
    this._velPitch = 0; this._velYaw = 0; this._velZoom = 0;
    this.panX = 0; this.panY = 0; this._targetPanX = 0; this._targetPanY = 0;
    this.camera = new Camera({ distance: 26 });

    // Interaction state
    this._pointers = new Map();
    this._gesture = null;   // 'drag' | 'lift' | 'pan' | 'orbit' | 'pinch' | 'speaker'
    this._gestureData = null;
    this._isPanning = false;
    this._isOrbiting = false;
    this._draggedSpeakerIdx = -1;
    this.editLayer = 'sources';
    this._dragStartPos = null;

    // Presentation
    this.themeColors = buildColorMap();
    this.emojiMap = {};
    this.timeline = null;
    this.showLabels = true;
    this.showGrid = true;
    this.showPaths = true;
    this.shoulderWidth = 1;
    this.pinnaSize = 1;
    this._hudFont = null;
    this._monoFont = null;
    this._hitRegions = [];

    this._isPaused = false;
    this._animationFrameId = null;
    this._frame = 0;

    this.initEvents();
    this.resize();
    this.draw();           // paint once even if the loop starts throttled
    this.startAnimation();
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('resize', () => this.resize());
    }
    // The canvas box also changes without a window resize: a panel opening, the
    // timeline dock, an orientation change. ResizeObserver catches those.
    if (typeof ResizeObserver === 'function') {
      this._resizeObserver = new ResizeObserver(() => this.resize());
      this._resizeObserver.observe(this.canvas);
    }
  }

  // ---------------------------------------------------------------------
  // Fonts, colours, sizing
  // ---------------------------------------------------------------------

  _uiFont() {
    if (!this._hudFont) {
      try { this._hudFont = getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif'; }
      catch (e) { this._hudFont = 'system-ui, sans-serif'; }
    }
    return this._hudFont;
  }

  _mono() {
    if (!this._monoFont) this._monoFont = '"SF Mono", Menlo, Consolas, monospace';
    return this._monoFont;
  }

  /** Text width with a fallback, because jsdom's canvas stub has no measureText. */
  _textWidth(ctx, text) {
    if (!ctx.measureText) return String(text).length * 6;
    const m = ctx.measureText(text);
    return (m && Number.isFinite(m.width)) ? m.width : String(text).length * 6;
  }

  /**
   * Finds a free line for a centred label and reserves it. Two sources can sit
   * almost on top of each other (head-locked ones share one arc), and their
   * labels then overprint into an unreadable run of words.
   *
   * Tries the wanted line first, then two lines below it. Returns the y to draw
   * at, or null when every line is taken. A selected or hovered label is drawn
   * regardless: hiding what the user is pointing at is worse than an overlap.
   */
  _placeLabel(ctx, text, cx, y, lineHeight, priority = false) {
    if (!this._labelRects) this._labelRects = [];
    const half = this._textWidth(ctx, text) / 2 + 3;
    for (let i = 0; i < 3; i++) {
      const ty = y + i * lineHeight;
      const rect = { x0: cx - half, x1: cx + half, y0: ty, y1: ty + lineHeight };
      const hit = this._labelRects.some(o =>
        rect.x0 < o.x1 && rect.x1 > o.x0 && rect.y0 < o.y1 && rect.y1 > o.y0);
      if (!hit) { this._labelRects.push(rect); return ty; }
    }
    if (priority) {
      this._labelRects.push({ x0: cx - half, x1: cx + half, y0: y, y1: y + lineHeight });
      return y;
    }
    return null;
  }

  _withAlpha(color, alpha) {
    if (!color) return `rgba(0,0,0,${alpha})`;
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    if (color.startsWith('rgba')) {
      const parts = color.match(/[\d.]+/g);
      if (parts && parts.length >= 3) return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
      return color;
    }
    if (color.startsWith('rgb')) return color.replace('rgb', 'rgba').replace(')', `, ${alpha})`);
    return color;
  }

  colorFor(type) {
    return this.themeColors[type] || getSound(type).color || this.themeColors.custom;
  }

  /**
   * Size the backing store to the canvas's own box, not the window. The canvas
   * sits below the top bar, so the two differ, and using the window would
   * stretch every drawing and put pointer coordinates out by that difference.
   */
  resize() {
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    const rect = this.canvas.getBoundingClientRect ? this.canvas.getBoundingClientRect() : null;
    const w = rect && rect.width > 0 ? rect.width : ((typeof window !== 'undefined' && window.innerWidth) || 500);
    const h = rect && rect.height > 0 ? rect.height : ((typeof window !== 'undefined' && window.innerHeight) || 500);
    this.w = w;
    this.h = h;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    if (this.ctx && this.ctx.setTransform) this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._baseScale = Math.min(this.w, this.h) / 22;
    this.unitScale = this._baseScale * this.camZoom;
    this._hudFont = null;
    // Resizing clears the backing store, so repaint rather than wait a frame.
    if (this._frame > 0) this.draw();
  }

  /** Node radius in px for a height (kept for older callers and tests). */
  getNodeRadius(z) {
    return 16 + z * 0.8;
  }

  /** Screen radius of a node given its projection factor. */
  _nodeRadius(src, k) {
    const depthScale = this.unitScale > 0 ? k / this.unitScale : 1;
    const base = 15 * clamp(depthScale, 0.6, 1.6);
    const heightCue = this.persp < 0.5 ? 1 + clamp(src.z || 0, -10, 10) * 0.025 : 1;
    return clamp(base * heightCue, 8, 30);
  }

  // ---------------------------------------------------------------------
  // Camera & coordinates
  // ---------------------------------------------------------------------

  _syncCamera() {
    this.camera.set({
      yaw: this.camYaw, pitch: this.camPitch, persp: this.persp,
      scale: this.unitScale, cx: this.w / 2 + this.panX, cy: this.h / 2 + this.panY,
    });
  }

  project(x, y, z = 0) {
    this._syncCamera();
    return this.camera.project(x, y, z);
  }

  /** World -> screen (x/y in px). Height optional. */
  audioToCanvasCoords(ax, ay, az = 0) {
    const p = this.project(ax, ay, az);
    return { x: p.sx, y: p.sy, k: p.k, depth: p.depth };
  }

  /** Screen -> world on the plane z = z0. */
  canvasToAudioCoords(cx, cy, z0 = 0) {
    this._syncCamera();
    const r = this.camera.screenToPlane(cx, cy, z0);
    return r ? { x: r.x, y: r.y } : { x: 0, y: 0 };
  }

  /**
   * Head-locked sources have no place in the field, so they are parked on a
   * short arc behind the listener, far enough out not to cover the figure.
   */
  _headLockedSlot(src) {
    const locked = [...this.audioEngine.sources.values()].filter(s => s.spatial === false);
    const i = Math.max(0, locked.indexOf(src));
    const n = Math.max(1, locked.length);
    const spread = Math.min(0.62, 2.4 / n);
    const angle = -Math.PI / 2 + (i - (n - 1) / 2) * spread;
    const radius = 3.1 + (n > 2 ? 0.4 : 0);
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, z: 0 };
  }

  _sourceWorldPos(src) {
    if (src.spatial === false) return this._headLockedSlot(src);
    return { x: src.x, y: src.y, z: src.z || 0 };
  }

  /** Sources sorted far -> near (painter's algorithm). */
  _depthSortedSources() {
    const entries = [...this.audioEngine.sources.entries()];
    this._syncCamera();
    return entries
      .map(entry => {
        const p = this._sourceWorldPos(entry[1]);
        return { entry, depth: this.camera.project(p.x, p.y, p.z).depth };
      })
      .sort((a, b) => b.depth - a.depth)
      .map(o => o.entry);
  }

  getNodeAtPosition(cx, cy) {
    const sorted = this._depthSortedSources().reverse(); // nearest first
    for (const [id, src] of sorted) {
      const p = this._sourceWorldPos(src);
      const pr = this.project(p.x, p.y, p.z);
      const r = this._nodeRadius(src, pr.k);
      if (Math.hypot(cx - pr.sx, cy - pr.sy) <= r + 4) return id;
    }
    return null;
  }

  _getSpeakerAtPosition(cx, cy) {
    const positions = this.audioEngine.speakerPositions;
    if (!positions) return -1;
    for (let i = 0; i < positions.length; i++) {
      const p = this.project(positions[i].x, positions[i].y, positions[i].z || 0);
      if (Math.hypot(cx - p.sx, cy - p.sy) <= 14) return i;
    }
    return -1;
  }

  setViewMode(mode) {
    this.viewMode = mode === '3d' ? '3d' : '2d';
    this.resetView();
    if (this.callbacks.onViewChanged) this.callbacks.onViewChanged(this.viewMode);
  }

  resetView() {
    const is3d = this.viewMode === '3d';
    this._targetPersp = is3d ? 1 : 0;
    this.flyTo(is3d ? 36 : 90, 0, 1.3, 0, 0, 550);
  }

  flyTo(pitch, yaw, zoom, panX = 0, panY = 0, duration = 600) {
    const s = { pitch: this._targetPitch, yaw: this._targetYaw, zoom: this._targetZoom, panX: this._targetPanX, panY: this._targetPanY };
    const start = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    this._targetPersp = this.viewMode === '3d' ? 1 : 0;
    const animate = () => {
      const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      const t = Math.min(1, (now - start) / duration);
      const e = 1 - Math.pow(1 - t, 3);
      this._targetPitch = s.pitch + (pitch - s.pitch) * e;
      this._targetYaw = s.yaw + (yaw - s.yaw) * e;
      this._targetZoom = s.zoom + (zoom - s.zoom) * e;
      this._targetPanX = s.panX + (panX - s.panX) * e;
      this._targetPanY = s.panY + (panY - s.panY) * e;
      if (t < 1) raf(animate);
    };
    raf(animate);
  }

  zoomAt(cx, cy, factor) {
    const newZoom = clamp(this._targetZoom * factor, 0.35, 3.2);
    const f = newZoom / this._targetZoom;
    const centerX = this.w / 2 + this._targetPanX;
    const centerY = this.h / 2 + this._targetPanY;
    this._targetPanX = (cx - (cx - centerX) * f) - this.w / 2;
    this._targetPanY = (cy - (cy - centerY) * f) - this.h / 2;
    this._targetZoom = newZoom;
  }

  _smoothCamera() {
    const dt = 0.016;
    const friction = 0.88;
    const stiffness = 0.2;
    const is3d = this.viewMode === '3d';

    this._targetPitch += this._velPitch * dt;
    this._targetYaw += this._velYaw * dt;
    this._targetZoom *= 1 + this._velZoom * dt;
    this._velPitch *= friction; this._velYaw *= friction; this._velZoom *= friction;

    this._targetPitch = is3d ? clamp(this._targetPitch, 14, 89) : 90;
    this._targetZoom = clamp(this._targetZoom, 0.35, 3.2);

    this.camPitch += (this._targetPitch - this.camPitch) * stiffness;
    this.camYaw += (this._targetYaw - this.camYaw) * stiffness;
    this.camZoom += (this._targetZoom - this.camZoom) * stiffness;
    this.persp += (this._targetPersp - this.persp) * 0.1;
    this.panX += (this._targetPanX - this.panX) * stiffness;
    this.panY += (this._targetPanY - this.panY) * stiffness;

    this.unitScale = this._baseScale * this.camZoom;
  }

  // ---------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------

  initEvents() {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => this.handlePointerDown(e));
    c.addEventListener('pointermove', (e) => this.handlePointerMove(e));
    c.addEventListener('pointerup', (e) => this.handlePointerUp(e));
    c.addEventListener('pointercancel', (e) => this.handlePointerUp(e));
    c.addEventListener('pointerleave', () => { if (!this._gesture) { this.hoveredNodeId = null; this._setCursor('default'); } });
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('pointerup', (e) => { if (this._gesture) this.handlePointerUp(e); });
    }
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('dblclick', (e) => this.handleDoubleClick(e));

    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = c.getBoundingClientRect ? c.getBoundingClientRect() : { left: 0, top: 0 };
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      if (e.shiftKey) {
        this._targetPanX -= (e.deltaX || e.deltaY) * 0.6;
        this._targetPanY -= (e.deltaX ? e.deltaY : 0) * 0.6;
      } else if ((e.metaKey || e.ctrlKey) && this.viewMode === '3d') {
        this._targetYaw += e.deltaX * 0.25;
        this._targetPitch = clamp(this._targetPitch - e.deltaY * 0.2, 14, 89);
      } else {
        const factor = e.deltaY > 0 ? 0.94 : 1.06;
        this.zoomAt(cx, cy, factor);
      }
    }, { passive: false });

    // Drag & drop from the library
    c.addEventListener('dragover', (e) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; });
    c.addEventListener('drop', (e) => {
      e.preventDefault();
      const type = e.dataTransfer ? e.dataTransfer.getData('text/plain') : '';
      if (!type) return;
      const rect = c.getBoundingClientRect();
      const pos = this.canvasToAudioCoords(e.clientX - rect.left, e.clientY - rect.top, 0);
      if (this.callbacks.onNodeDropped) {
        this.callbacks.onNodeDropped(type, clamp(pos.x, -FIELD_RADIUS, FIELD_RADIUS), clamp(pos.y, -FIELD_RADIUS, FIELD_RADIUS));
      }
    });

    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('visibilitychange', () => {
        this._isPaused = !!document.hidden;
        if (!this._isPaused) { this.resize(); this.draw(); }
      });
    }
  }

  _setCursor(v) { if (this.canvas.style) this.canvas.style.cursor = v; }

  _local(e) {
    const rect = this.canvas.getBoundingClientRect ? this.canvas.getBoundingClientRect() : { left: 0, top: 0 };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  handlePointerDown(e) {
    const { x: cx, y: cy } = this._local(e);
    this._pointers.set(e.pointerId ?? 'mouse', { x: cx, y: cy, clientX: e.clientX, clientY: e.clientY });
    try { this.canvas.setPointerCapture && this.canvas.setPointerCapture(e.pointerId); } catch (err) { /* not supported */ }

    if (this._pointers.size === 2) {
      this._startPinch();
      return;
    }

    if (e.button === 2 || e.button === 1) {
      e.preventDefault();
      this._startCameraGesture(e, e.button === 1 ? 'pan' : (this.viewMode === '3d' ? 'orbit' : 'pan'));
      return;
    }

    if (this.editLayer === 'speakers') {
      const idx = this._getSpeakerAtPosition(cx, cy);
      if (idx >= 0) {
        this._draggedSpeakerIdx = idx;
        this._gesture = 'speaker';
        this._setCursor('grabbing');
      }
      return;
    }

    const nodeId = this.getNodeAtPosition(cx, cy);
    if (nodeId) {
      const node = this.audioEngine.sources.get(nodeId);
      this.selectedNodeId = nodeId;
      if (this.callbacks.onNodeSelected) this.callbacks.onNodeSelected(node);
      if (node.spatial === false) { this._gesture = null; return; } // head-locked: select only

      this.draggedNodeId = nodeId;
      const lift = e.altKey || e.metaKey || e.ctrlKey;
      this._gesture = lift ? 'lift' : 'drag';
      const plane = this.canvasToAudioCoords(cx, cy, node.z || 0);
      const vpm = this.camera.verticalPixelsPerMetre(node.x, node.y, node.z || 0);
      this._gestureData = {
        offsetX: node.x - plane.x, offsetY: node.y - plane.y,
        startZ: node.z || 0, startClientY: e.clientY,
        pxPerMetre: Math.abs(vpm) > 4 ? vpm : this.unitScale * 0.8,
      };
      this._dragStartPos = { x: node.x, y: node.y, z: node.z || 0 };
      this._setCursor(lift ? 'ns-resize' : 'grabbing');
      return;
    }

    // Empty space: deselect and move the camera
    if (this.selectedNodeId !== null) {
      this.selectedNodeId = null;
      if (this.callbacks.onNodeSelected) this.callbacks.onNodeSelected(null);
    }
    this._startCameraGesture(e, this.viewMode === '3d' && !e.shiftKey ? 'orbit' : 'pan');
  }

  _startCameraGesture(e, kind) {
    this._gesture = kind;
    this._isPanning = kind === 'pan';
    this._isOrbiting = kind === 'orbit';
    this._gestureData = {
      startX: e.clientX, startY: e.clientY,
      panX: this._targetPanX, panY: this._targetPanY,
      yaw: this._targetYaw, pitch: this._targetPitch,
    };
    this._setCursor(kind === 'orbit' ? 'all-scroll' : 'move');
  }

  _startPinch() {
    const [a, b] = [...this._pointers.values()];
    this.draggedNodeId = null;
    this._gesture = 'pinch';
    this._gestureData = {
      dist: Math.hypot(a.x - b.x, a.y - b.y),
      angle: Math.atan2(a.y - b.y, a.x - b.x),
      mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      zoom: this._targetZoom, yaw: this._targetYaw,
      panX: this._targetPanX, panY: this._targetPanY,
    };
  }

  handlePointerMove(e) {
    const { x: cx, y: cy } = this._local(e);
    const key = e.pointerId ?? 'mouse';
    if (this._pointers.has(key)) this._pointers.set(key, { x: cx, y: cy, clientX: e.clientX, clientY: e.clientY });

    if (this._gesture === 'pinch') {
      if (this._pointers.size < 2) return;
      const [a, b] = [...this._pointers.values()];
      const d = this._gestureData;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (d.dist > 10) this._targetZoom = clamp(d.zoom * (dist / d.dist), 0.35, 3.2);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      this._targetPanX = d.panX + (mid.x - d.mid.x);
      this._targetPanY = d.panY + (mid.y - d.mid.y);
      if (this.viewMode === '3d') {
        const angle = Math.atan2(a.y - b.y, a.x - b.x);
        this._targetYaw = d.yaw + ((angle - d.angle) * 180) / Math.PI;
      }
      return;
    }

    if (this._gesture === 'orbit') {
      const d = this._gestureData;
      const dx = e.clientX - d.startX, dy = e.clientY - d.startY;
      this._targetYaw = d.yaw + dx * 0.4;
      this._targetPitch = clamp(d.pitch - dy * 0.3, 14, 89);
      return;
    }
    if (this._gesture === 'pan') {
      const d = this._gestureData;
      this._targetPanX = d.panX + (e.clientX - d.startX);
      this._targetPanY = d.panY + (e.clientY - d.startY);
      return;
    }

    if (this._gesture === 'speaker' && this._draggedSpeakerIdx >= 0) {
      const sp = this.audioEngine.speakerPositions?.[this._draggedSpeakerIdx];
      if (sp) {
        const pos = this.canvasToAudioCoords(cx, cy, 0);
        sp.x = clamp(pos.x, -FIELD_RADIUS, FIELD_RADIUS);
        sp.y = clamp(pos.y, -FIELD_RADIUS, FIELD_RADIUS);
        const cfg = this.audioEngine._speakerConfig;
        if (cfg && cfg.customSpeakers[this._draggedSpeakerIdx]) {
          cfg.customSpeakers[this._draggedSpeakerIdx].x = sp.x;
          cfg.customSpeakers[this._draggedSpeakerIdx].y = sp.y;
        }
        this.audioEngine.setOutputMode(this.audioEngine.outputMode, this.audioEngine.speakerPositions, this.audioEngine.channelCount);
      }
      return;
    }

    if (this.draggedNodeId && (this._gesture === 'drag' || this._gesture === 'lift')) {
      const node = this.audioEngine.sources.get(this.draggedNodeId);
      if (!node) { this.draggedNodeId = null; this._gesture = null; return; }
      const d = this._gestureData;
      const lift = this._gesture === 'lift' || e.altKey || e.metaKey || e.ctrlKey;
      if (lift) {
        const dz = (d.startClientY - e.clientY) / d.pxPerMetre;
        const z = clamp(d.startZ + dz, -FIELD_RADIUS, FIELD_RADIUS);
        this.audioEngine.updateSourcePosition(this.draggedNodeId, node.x, node.y, z);
        this._showZIndicator(e.clientX, e.clientY, z);
        this._setCursor('ns-resize');
      } else {
        const plane = this.canvasToAudioCoords(cx, cy, node.z || 0);
        const x = clamp(plane.x + d.offsetX, -FIELD_RADIUS, FIELD_RADIUS);
        const y = clamp(plane.y + d.offsetY, -FIELD_RADIUS, FIELD_RADIUS);
        this.audioEngine.updateSourcePosition(this.draggedNodeId, x, y);
        const auto = this.automations.get(this.draggedNodeId);
        if (auto) {
          auto.angle = Math.atan2(y, x);
          auto.radius = clamp(Math.hypot(x, y), 1, 9.5);
          if (auto.type === 'breathe') { auto.baseX = x; auto.baseY = y; }
        }
        this._setCursor('grabbing');
      }
      if (this.callbacks.onNodeMoved) this.callbacks.onNodeMoved(node);
      return;
    }

    // Hover
    const id = this.getNodeAtPosition(cx, cy);
    this.hoveredNodeId = id;
    this._setCursor(id ? 'pointer' : 'default');
  }

  handlePointerUp(e) {
    const key = e && e.pointerId !== undefined ? e.pointerId : 'mouse';
    this._pointers.delete(key);
    if (this._gesture === 'pinch') {
      if (this._pointers.size < 2) { this._gesture = null; this._gestureData = null; }
      return;
    }
    if (this.draggedNodeId && this._dragStartPos) {
      const node = this.audioEngine.sources.get(this.draggedNodeId);
      if (node) {
        const o = this._dragStartPos;
        const moved = o.x !== node.x || o.y !== node.y || o.z !== node.z;
        if (moved && this.callbacks.onNodeDragEnd) {
          this.callbacks.onNodeDragEnd(this.draggedNodeId, o.x, o.y, o.z, node.x, node.y, node.z);
        }
      }
    }
    this.draggedNodeId = null;
    this._dragStartPos = null;
    this._draggedSpeakerIdx = -1;
    this._isPanning = false;
    this._isOrbiting = false;
    this._gesture = null;
    this._gestureData = null;
    this._pointers.clear();
    this._hideZIndicator();
    this._setCursor('default');
  }

  handleDoubleClick(e) {
    const { x: cx, y: cy } = this._local(e);
    const id = this.getNodeAtPosition(cx, cy);
    if (id) {
      if (this.callbacks.onNodeActivated) this.callbacks.onNodeActivated(this.audioEngine.sources.get(id));
      return;
    }
    this.zoomAt(cx, cy, 1.5);
  }

  // Legacy names kept for external callers
  handleMouseDown(e) { return this.handlePointerDown(e); }
  handleMouseMove(e) { return this.handlePointerMove(e); }
  handleMouseUp(e) { return this.handlePointerUp(e || {}); }

  _showZIndicator(clientX, clientY, z) {
    if (typeof document === 'undefined') return;
    const el = document.getElementById('z-indicator');
    if (!el) return;
    el.style.display = 'block';
    el.style.left = `${clientX + 14}px`;
    el.style.top = `${clientY - 10}px`;
    el.textContent = `Z ${z >= 0 ? '+' : ''}${z.toFixed(1)} m`;
  }

  _hideZIndicator() {
    if (typeof document === 'undefined') return;
    const el = document.getElementById('z-indicator');
    if (el) el.style.display = 'none';
  }

  // ---------------------------------------------------------------------
  // Automations (motion)
  // ---------------------------------------------------------------------

  setAutomation(id, type, enabled = true, options = {}) {
    if (!enabled) { this.automations.delete(id); return; }
    const node = this.audioEngine.sources.get(id);
    if (!node) return;
    const radius = Math.hypot(node.x, node.y) || 5;
    const entry = {
      type,
      speed: options.speed || 0.015,
      radius: clamp(options.radius || radius, 1.5, 9.5),
      angle: options.angle !== undefined ? options.angle : Math.atan2(node.y, node.x),
      direction: 1,
    };
    if (type === 'breathe') {
      entry.baseX = options.baseX !== undefined ? options.baseX : node.x;
      entry.baseY = options.baseY !== undefined ? options.baseY : node.y;
      entry.baseVol = options.baseVol !== undefined ? options.baseVol : node.volume;
    } else if (type === 'drift') {
      entry.driftTarget = null;
      entry.driftTimeout = 0;
    }
    this.automations.set(id, entry);
  }

  updatePhysics() {
    if (this._isPaused) return;
    const time = Date.now() * 0.001;

    for (const [id, auto] of this.automations.entries()) {
      const node = this.audioEngine.sources.get(id);
      if (!node) { this.automations.delete(id); continue; }
      if (node._timelineControlled || node.spatial === false) continue;

      if (auto.type === 'orbit') {
        auto.angle += auto.speed;
        this.audioEngine.updateSourcePosition(id, auto.radius * Math.cos(auto.angle), auto.radius * Math.sin(auto.angle));
      } else if (auto.type === 'pingpong') {
        this.audioEngine.updateSourcePosition(id, auto.radius * Math.sin(time * auto.speed * 8), node.y);
      } else if (auto.type === 'drift') {
        if (!auto.driftTarget || Date.now() > auto.driftTimeout) {
          auto.driftTarget = { x: (Math.random() - 0.5) * auto.radius * 2, y: (Math.random() - 0.5) * auto.radius * 2 };
          auto.driftTimeout = Date.now() + 2000 + Math.random() * 3000;
        }
        const dx = auto.driftTarget.x - node.x, dy = auto.driftTarget.y - node.y;
        if (Math.hypot(dx, dy) > 0.1) {
          this.audioEngine.updateSourcePosition(id, clamp(node.x + dx * auto.speed * 0.5, -10, 10), clamp(node.y + dy * auto.speed * 0.5, -10, 10));
        }
      } else if (auto.type === 'breathe') {
        auto.angle += auto.speed;
        const breathe = 1 + 0.3 * Math.sin(auto.angle * 2);
        this.audioEngine.updateSourcePosition(id, clamp(auto.baseX * breathe, -10, 10), clamp(auto.baseY * breathe, -10, 10));
        if (auto.baseVol === undefined) auto.baseVol = node.volume;
        const volMod = 0.5 + 0.5 * Math.sin(auto.angle * 2);
        this.audioEngine.updateSourceVolume(id, auto.baseVol * (0.7 + 0.3 * volMod));
      }
      if (this.selectedNodeId === id && this.callbacks.onNodeMoved) this.callbacks.onNodeMoved(node);
    }

    // Levels and ripples
    for (const [id, node] of this.audioEngine.sources.entries()) {
      const raw = node.isPlaying && this.audioEngine.getSourceLevel ? this.audioEngine.getSourceLevel(id) : 0;
      const prev = this._levels.get(id) || 0;
      const lv = prev + (raw - prev) * (raw > prev ? 0.35 : 0.08);
      this._levels.set(id, lv);
      if (!this.ripples.has(id)) this.ripples.set(id, []);
      const rips = this.ripples.get(id);
      if (node.isPlaying && rips.length < 4 && Math.random() < 0.01 + lv * 0.12) {
        rips.push({ radius: 0, alpha: 0.35 + lv * 0.4, speed: 0.5 + lv * 0.8 });
      }
      for (let i = rips.length - 1; i >= 0; i--) {
        const r = rips[i];
        r.radius += r.speed;
        r.alpha -= 0.006;
        if (r.alpha <= 0) rips.splice(i, 1);
      }
    }
    for (const id of this.ripples.keys()) if (!this.audioEngine.sources.has(id)) this.ripples.delete(id);
  }

  // ---------------------------------------------------------------------
  // Render loop
  // ---------------------------------------------------------------------

  startAnimation() {
    // The browser already throttles requestAnimationFrame for a hidden tab, so
    // `_isPaused` (set on visibilitychange) is the only gate needed here.
    // Reading document.hidden per frame would leave the canvas blank whenever
    // the page happens to load while it is not on screen.
    const loop = () => {
      if (!this._isPaused) {
        this._smoothCamera();
        this.updatePhysics();
        this.draw();
        this._frame++;
      }
      this._animationFrameId = raf(loop);
    };
    this._animationFrameId = raf(loop);
  }

  draw() {
    if (this._isPaused || !this.ctx) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.fillStyle = 'rgba(11, 10, 10, 0.9)';
    ctx.fillRect(0, 0, this.w, this.h);

    // Vignette
    if (ctx.createRadialGradient) {
      const vg = ctx.createRadialGradient(this.w / 2, this.h / 2, Math.min(this.w, this.h) * 0.25, this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.75);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.45)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, this.w, this.h);
    }

    this._syncCamera();
    this._hitRegions = [];
    this._labelRects = [];
    if (this.showGrid) this.drawGround();
    this.drawListener();
    this.drawSpeakers();
    if (this.showPaths) { this._drawAutomationPath(); this._drawKeyframePath(); }
    this.drawEmitters();
    this._drawHUD();
  }

  // ---- ground ----

  _fog(depth) {
    if (this.persp < 0.05) return 1;
    return clamp(1 - (depth / 70) * this.persp, 0.3, 1);
  }

  _strokeWorldPoly(points, closed = false) {
    const ctx = this.ctx;
    ctx.beginPath();
    points.forEach((p, i) => {
      const s = this.camera.project(p[0], p[1], p[2] || 0);
      if (i === 0) ctx.moveTo(s.sx, s.sy); else ctx.lineTo(s.sx, s.sy);
    });
    if (closed) ctx.closePath();
    ctx.stroke();
  }

  _ringPoints(r, z = 0, n = 72) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      pts.push([Math.cos(a) * r, Math.sin(a) * r, z]);
    }
    return pts;
  }

  drawGround() {
    const ctx = this.ctx;
    const cam = this.camera;
    ctx.lineWidth = 1;

    // Ground plane wash (3D)
    if (this.persp > 0.05 && ctx.fill) {
      ctx.fillStyle = `rgba(255, 244, 232, ${0.018 * this.persp})`;
      ctx.beginPath();
      this._ringPoints(FIELD_RADIUS, 0, 96).forEach((p, i) => { const s = cam.project(p[0], p[1], 0); if (i === 0) ctx.moveTo(s.sx, s.sy); else ctx.lineTo(s.sx, s.sy); });
      ctx.closePath();
      ctx.fill();
    }

    // Rings
    for (let r = 1; r <= FIELD_RADIUS; r++) {
      const major = r % 5 === 0;
      const depth = cam.project(0, r, 0).depth;
      ctx.strokeStyle = `rgba(255, 246, 236, ${(major ? 0.11 : 0.045) * this._fog(depth)})`;
      ctx.lineWidth = major ? 1 : 0.75;
      this._strokeWorldPoly(this._ringPoints(r), true);
    }

    // Spokes every 30 degrees
    for (let a = 0; a < 360; a += 30) {
      const rad = (a * Math.PI) / 180;
      const cardinal = a % 90 === 0;
      ctx.strokeStyle = `rgba(255, 246, 236, ${cardinal ? 0.08 : 0.035})`;
      ctx.lineWidth = cardinal ? 1 : 0.75;
      this._strokeWorldPoly([[Math.cos(rad) * 0.9, Math.sin(rad) * 0.9, 0], [Math.cos(rad) * FIELD_RADIUS, Math.sin(rad) * FIELD_RADIUS, 0]]);
    }

    // Distance ticks and labels along +X
    ctx.font = `10px ${this._mono()}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (let r = 2; r <= FIELD_RADIUS; r += 2) {
      const s = cam.project(r, 0, 0);
      const fog = this._fog(s.depth);
      ctx.fillStyle = `rgba(255, 246, 236, ${0.38 * fog})`;
      const text = `${r} m`;
      // Drop a ring label that would be cut off by the canvas edge. A clipped
      // "8" reads as a different number, which is worse than no label.
      if (s.sx + 5 + this._textWidth(ctx, text) > this.w - 4) continue;
      ctx.fillText(text, s.sx + 5, s.sy - 8);
    }

    // Cardinal labels
    ctx.font = `600 9px ${this._uiFont()}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255, 246, 236, 0.32)';
    const lab = [['FRONT', 0, FIELD_RADIUS + 0.9], ['BACK', 0, -FIELD_RADIUS - 0.9], ['RIGHT', FIELD_RADIUS + 1.2, 0], ['LEFT', -FIELD_RADIUS - 1.2, 0]];
    for (const [text, x, y] of lab) {
      const s = cam.project(x, y, 0);
      ctx.fillText(text, s.sx, s.sy);
    }

    // Centre crosshair
    const o = cam.project(0, 0, 0);
    ctx.strokeStyle = 'rgba(255, 246, 236, 0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(o.sx - 14, o.sy); ctx.lineTo(o.sx - 5, o.sy);
    ctx.moveTo(o.sx + 5, o.sy); ctx.lineTo(o.sx + 14, o.sy);
    ctx.moveTo(o.sx, o.sy - 14); ctx.lineTo(o.sx, o.sy - 5);
    ctx.moveTo(o.sx, o.sy + 5); ctx.lineTo(o.sx, o.sy + 14);
    ctx.stroke();
  }

  // ---- listener ----

  drawListener() {
    const ctx = this.ctx;
    const cam = this.camera;
    const levels = this.audioEngine.getLeftRightLevels ? this.audioEngine.getLeftRightLevels() : { left: 0, right: 0 };
    const posture = this.audioEngine.posture || 'standing';
    const tilt = ((this.audioEngine.headTilt || 0) * Math.PI) / 180;
    const outputMode = this.audioEngine.outputMode || 'hrtf';
    const headphones = outputMode === 'hrtf';

    // Figure geometry in metres, top-down. Head centre at (0, 0).
    let head = { x: 0, y: 0, r: 0.3 };
    let body = [];
    let earL = { x: -0.32, y: 0 }, earR = { x: 0.32, y: 0 };
    let nose = [[0, 0.3], [0, 0.55]];
    if (posture === 'lying-back') {
      head = { x: 0, y: 0.75, r: 0.3 };
      body = [[-0.42, 0.35], [0.42, 0.35], [0.3, -1.4], [-0.3, -1.4]];
      earL = { x: -0.32, y: 0.75 }; earR = { x: 0.32, y: 0.75 };
      nose = [[0, 1.05], [0, 1.25]];
    } else if (posture === 'lying-side') {
      head = { x: 0.75, y: 0, r: 0.3 };
      body = [[0.35, 0.36], [0.35, -0.36], [-1.4, -0.26], [-1.4, 0.26]];
      earL = { x: 0.75, y: 0.32 }; earR = { x: 0.75, y: -0.32 };
      nose = [[1.05, 0], [1.25, 0]];
    } else {
      body = [[-0.62 * this.shoulderWidth, -0.28], [0.62 * this.shoulderWidth, -0.28]];
    }

    const rot = (p) => {
      const c = Math.cos(tilt), s = Math.sin(tilt);
      const dx = p[0] - head.x, dy = p[1] - head.y;
      return [head.x + dx * c - dy * s, head.y + dx * s + dy * c, 0];
    };

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Body: kept quieter than the head so the head reads as the listener.
    if (body.length) {
      ctx.strokeStyle = 'rgba(255, 246, 236, 0.3)';
      ctx.fillStyle = 'rgba(255, 246, 236, 0.03)';
      ctx.lineWidth = 1.2;
      if (body.length > 2 && ctx.fill) {
        ctx.beginPath();
        body.forEach((p, i) => { const s = cam.project(p[0], p[1], 0); if (i === 0) ctx.moveTo(s.sx, s.sy); else ctx.lineTo(s.sx, s.sy); });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        this._strokeWorldPoly(body.map(p => [p[0], p[1], 0]));
      }
    }

    // Head (filled ellipse via projected ring)
    const headPts = this._ringPoints(head.r, 0, 36).map(p => rot([p[0] + head.x, p[1] + head.y]));
    ctx.fillStyle = '#0f1013';
    ctx.strokeStyle = 'rgba(255, 246, 236, 0.75)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    headPts.forEach((p, i) => { const s = cam.project(p[0], p[1], 0); if (i === 0) ctx.moveTo(s.sx, s.sy); else ctx.lineTo(s.sx, s.sy); });
    ctx.closePath();
    if (ctx.fill) ctx.fill();
    ctx.stroke();

    // Facing tick
    ctx.strokeStyle = 'rgba(255, 246, 236, 0.75)';
    this._strokeWorldPoly(nose.map(rot));

    // Ears / headphone cups with level glow
    const maxLevel = Math.max(levels.left || 0, levels.right || 0);
    for (const [ear, lv] of [[earL, levels.left || 0], [earR, levels.right || 0]]) {
      const e = cam.project(...rot([ear.x, ear.y]));
      const rr = Math.max(3, 0.1 * e.k);
      if (lv > 0.02 && ctx.createRadialGradient) {
        const g = ctx.createRadialGradient(e.sx, e.sy, rr, e.sx, e.sy, rr + 10 + lv * 26);
        g.addColorStop(0, `rgba(${ACCENT_RGB}, ${0.35 * lv})`);
        g.addColorStop(1, `rgba(${ACCENT_RGB}, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(e.sx, e.sy, rr + 10 + lv * 26, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = lv > 0.02 ? `rgba(${ACCENT_RGB}, ${0.35 + lv * 0.6})` : 'rgba(255, 246, 236, 0.12)';
      ctx.strokeStyle = headphones ? `rgba(${ACCENT_RGB}, 0.85)` : 'rgba(255, 246, 236, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(e.sx, e.sy, rr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }

    // Headphone band
    if (headphones) {
      const band = [];
      const from = posture === 'lying-side' ? -Math.PI / 2 : Math.PI;
      for (let i = 0; i <= 18; i++) {
        const a = from + (i / 18) * Math.PI;
        band.push(rot([head.x + Math.cos(a) * 0.4, head.y + Math.sin(a) * 0.4]));
      }
      ctx.strokeStyle = `rgba(${ACCENT_RGB}, 0.7)`;
      ctx.lineWidth = 2;
      this._strokeWorldPoly(band);
    }

    // Level ring around the head
    if (maxLevel > 0.02) {
      const s = cam.project(head.x, head.y, 0);
      const rr = 0.55 * s.k + maxLevel * 0.35 * s.k;
      ctx.strokeStyle = `rgba(${ACCENT_RGB}, ${0.18 + maxLevel * 0.35})`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(s.sx, s.sy, rr, 0, Math.PI * 2); ctx.stroke();
    }
  }

  // ---- speakers ----

  drawSpeakers() {
    const mode = this.audioEngine.outputMode || 'hrtf';
    if (mode === 'hrtf') return;
    const positions = this.audioEngine.speakerPositions;
    if (!positions || positions.length === 0) return;
    const ctx = this.ctx;
    const editing = this.editLayer === 'speakers';
    positions.forEach((sp, i) => {
      const p = this.project(sp.x, sp.y, sp.z || 0);
      const dragging = this._draggedSpeakerIdx === i;
      ctx.fillStyle = dragging ? `rgba(${ACCENT_RGB}, 0.3)` : `rgba(${ACCENT_RGB}, 0.1)`;
      ctx.strokeStyle = editing ? '#ff8b59' : ACCENT;
      ctx.lineWidth = editing ? 2 : 1.2;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(p.sx - 13, p.sy - 9, 26, 18, 4); else ctx.rect(p.sx - 13, p.sy - 9, 26, 18);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = ACCENT;
      ctx.font = `9px ${this._mono()}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(sp.label || `S${i + 1}`, p.sx, p.sy);
    });
  }

  // ---- paths ----

  _drawAutomationPath() {
    if (!this.selectedNodeId) return;
    const auto = this.automations.get(this.selectedNodeId);
    const src = this.audioEngine.sources.get(this.selectedNodeId);
    if (!auto || !src) return;
    const ctx = this.ctx;
    const color = this.colorFor(src.type);
    ctx.save();
    ctx.setLineDash([3, 5]);
    ctx.strokeStyle = this._withAlpha(color, 0.35);
    ctx.lineWidth = 1;
    if (auto.type === 'orbit') {
      this._strokeWorldPoly(this._ringPoints(auto.radius, src.z || 0), true);
    } else if (auto.type === 'pingpong') {
      this._strokeWorldPoly([[-auto.radius, src.y, src.z || 0], [auto.radius, src.y, src.z || 0]]);
    } else if (auto.type === 'breathe') {
      const r = Math.hypot(auto.baseX, auto.baseY);
      this._strokeWorldPoly(this._ringPoints(r * 0.7, src.z || 0), true);
      this._strokeWorldPoly(this._ringPoints(r * 1.3, src.z || 0), true);
    } else if (auto.type === 'drift') {
      this._strokeWorldPoly(this._ringPoints(auto.radius, src.z || 0), true);
    }
    ctx.restore();
  }

  _drawKeyframePath() {
    if (!this.timeline || !this.selectedNodeId) return;
    const kfs = this.timeline.keyframes && this.timeline.keyframes.get ? this.timeline.keyframes.get(this.selectedNodeId) : null;
    if (!kfs || kfs.length < 2) return;
    const src = this.audioEngine.sources && this.audioEngine.sources.get ? this.audioEngine.sources.get(this.selectedNodeId) : null;
    if (src && src.spatial === false) return;
    const color = src ? this.colorFor(src.type) : '#ffffff';
    const ctx = this.ctx;
    ctx.save();
    this._syncCamera();
    ctx.setLineDash([5, 6]);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = this._withAlpha(color, 0.45);
    this._strokeWorldPoly(kfs.map(k => [k.x, k.y, k.z || 0]));
    ctx.setLineDash([]);
    ctx.font = `9px ${this._mono()}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    kfs.forEach((k, i) => {
      const s = this.camera.project(k.x, k.y, k.z || 0);
      const d = i === 0 ? 5 : 4;
      ctx.fillStyle = this._withAlpha(color, i === 0 ? 0.85 : 0.6);
      ctx.beginPath();
      ctx.moveTo(s.sx, s.sy - d); ctx.lineTo(s.sx + d, s.sy); ctx.lineTo(s.sx, s.sy + d); ctx.lineTo(s.sx - d, s.sy);
      ctx.closePath();
      ctx.fill();
      if (ctx.fillText) {
        ctx.fillStyle = 'rgba(255, 246, 236, 0.45)';
        ctx.fillText(formatTime(k.time), s.sx + 7, s.sy - 7);
      }
    });
    ctx.restore();
  }

  // ---- emitters ----

  drawEmitters() {
    const ctx = this.ctx;
    const cam = this.camera;
    const now = Date.now();
    const timing = this.timeline && this.timeline.sourceTimings;
    const playhead = this.timeline ? this.timeline.playheadTime : 0;

    for (const [id, src] of this._depthSortedSources()) {
      const wp = this._sourceWorldPos(src);
      const p = cam.project(wp.x, wp.y, wp.z);
      const g = cam.project(wp.x, wp.y, 0);
      const color = this.colorFor(src.type);
      const def = getSound(src.type);
      const isSelected = this.selectedNodeId === id;
      const isHovered = this.hoveredNodeId === id;
      const headLocked = src.spatial === false;
      const r = this._nodeRadius(src, p.k);
      const fog = this._fog(p.depth);
      const level = this._levels.get(id) || 0;

      let inactive = false;
      if (timing && timing.get && timing.get(id)) {
        const t = timing.get(id);
        inactive = playhead < t.startTime || playhead > t.startTime + t.duration;
      }
      const baseAlpha = (inactive ? 0.4 : 1) * fog;

      // Ground shadow + stalk
      if (!headLocked) {
        const zAbs = Math.abs(wp.z);
        if (this.persp > 0.05 || zAbs > 0.05) {
          ctx.fillStyle = `rgba(0, 0, 0, ${0.35 * baseAlpha})`;
          ctx.beginPath();
          if (ctx.ellipse) ctx.ellipse(g.sx, g.sy, r * 0.9, r * 0.9 * (0.25 + 0.75 * (1 - this.persp * 0.6)), 0, 0, Math.PI * 2);
          else ctx.arc(g.sx, g.sy, r * 0.6, 0, Math.PI * 2);
          ctx.fill();
        }
        if (this.persp > 0.05 && zAbs > 0.05) {
          ctx.strokeStyle = this._withAlpha(color, 0.4 * baseAlpha);
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 3]);
          ctx.beginPath(); ctx.moveTo(g.sx, g.sy); ctx.lineTo(p.sx, p.sy); ctx.stroke();
          ctx.setLineDash([]);
          ctx.strokeStyle = this._withAlpha(color, 0.6 * baseAlpha);
          ctx.beginPath(); ctx.moveTo(g.sx - 4, g.sy); ctx.lineTo(g.sx + 4, g.sy); ctx.moveTo(g.sx, g.sy - 3); ctx.lineTo(g.sx, g.sy + 3); ctx.stroke();
        }
      }

      // Ripples
      const rips = this.ripples.get(id) || [];
      for (const rp of rips) {
        ctx.strokeStyle = this._withAlpha(color, rp.alpha * 0.6 * baseAlpha);
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(p.sx, p.sy, r + rp.radius, 0, Math.PI * 2); ctx.stroke();
      }

      // Level halo
      if (level > 0.02 && ctx.createRadialGradient) {
        const hr = r * (1.6 + level * 1.2);
        const grad = ctx.createRadialGradient(p.sx, p.sy, r * 0.8, p.sx, p.sy, hr);
        grad.addColorStop(0, this._withAlpha(color, 0.28 * level * baseAlpha));
        grad.addColorStop(1, this._withAlpha(color, 0));
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(p.sx, p.sy, hr, 0, Math.PI * 2); ctx.fill();
      }

      // Selection ring + brackets
      if (isSelected) {
        const pulse = 0.5 + 0.5 * Math.sin(now * 0.004);
        ctx.strokeStyle = `rgba(${ACCENT_RGB}, ${0.35 + pulse * 0.3})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(p.sx, p.sy, r + 7, 0, Math.PI * 2); ctx.stroke();
        const b = r + 12, l = 6;
        ctx.strokeStyle = `rgba(${ACCENT_RGB}, 0.9)`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(p.sx - b, p.sy - b + l); ctx.lineTo(p.sx - b, p.sy - b); ctx.lineTo(p.sx - b + l, p.sy - b);
        ctx.moveTo(p.sx + b - l, p.sy - b); ctx.lineTo(p.sx + b, p.sy - b); ctx.lineTo(p.sx + b, p.sy - b + l);
        ctx.moveTo(p.sx - b, p.sy + b - l); ctx.lineTo(p.sx - b, p.sy + b); ctx.lineTo(p.sx - b + l, p.sy + b);
        ctx.moveTo(p.sx + b - l, p.sy + b); ctx.lineTo(p.sx + b, p.sy + b); ctx.lineTo(p.sx + b, p.sy + b - l);
        ctx.stroke();
      }

      // Node body
      ctx.fillStyle = headLocked ? '#15161a' : '#111215';
      ctx.strokeStyle = this._withAlpha(color, (isSelected || isHovered ? 1 : 0.8) * baseAlpha);
      ctx.lineWidth = isSelected ? 2 : 1.4;
      if (!src.isPlaying) ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.setLineDash([]);

      // Volume gauge
      const vol = clamp(src.volume || 0, 0, 1);
      if (vol > 0) {
        ctx.strokeStyle = this._withAlpha(color, 0.95 * baseAlpha);
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.sx, p.sy, r + 3.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * vol); ctx.stroke();
      }

      // Glyph
      ctx.strokeStyle = src.isPlaying ? this._withAlpha(color, baseAlpha) : this._withAlpha(color, 0.4 * baseAlpha);
      drawGlyph(ctx, def.glyph || 'file', p.sx, p.sy, r * 1.15, 1.5);

      // Lock badge for head-locked sources
      if (headLocked) {
        ctx.fillStyle = '#15161a';
        ctx.beginPath(); ctx.arc(p.sx + r * 0.75, p.sy - r * 0.75, 6, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255, 246, 236, 0.7)';
        drawGlyph(ctx, 'lock', p.sx + r * 0.75, p.sy - r * 0.75, 8, 1.4);
      }

      // Labels
      if (this.showLabels && ctx.fillText) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.font = `500 11px ${this._uiFont()}`;
        const priority = isSelected || isHovered;
        const name = src.name || src.type;
        const ly = this._placeLabel(ctx, name, p.sx, p.sy + r + 8, 12, priority);
        if (ly !== null) {
          ctx.fillStyle = `rgba(255, 246, 236, ${(priority ? 0.9 : 0.62) * baseAlpha})`;
          ctx.fillText(name, p.sx, ly);
          if (priority) {
            ctx.font = `10px ${this._mono()}`;
            ctx.fillStyle = `rgba(255, 246, 236, ${0.45 * baseAlpha})`;
            ctx.fillText(this._readout(src), p.sx, ly + 14);
          }
        }
      }

      this._hitRegions.push({ id, sx: p.sx, sy: p.sy, r });
    }
  }

  _readout(src) {
    if (src.spatial === false) {
      const beat = src.params && src.params.beat !== undefined ? src.params.beat : src._bwFreq;
      return beat !== undefined ? `head-locked · ${Number(beat).toFixed(1)} Hz` : 'head-locked';
    }
    const dist = Math.hypot(src.x, src.y, src.z || 0);
    let s = `${dist.toFixed(1)} m`;
    if (Math.abs(src.z || 0) > 0.05) s += ` · ${src.z > 0 ? '+' : ''}${src.z.toFixed(1)} m`;
    if (src.params && src.params.beat !== undefined) s += ` · ${Number(src.params.beat).toFixed(1)} Hz`;
    else if (src.params && src.params.freq !== undefined) s += ` · ${Number(src.params.freq).toFixed(0)} Hz`;
    return s;
  }

  // ---- HUD (screen space) ----

  _drawHUD() {
    const ctx = this.ctx;
    if (!ctx.fillText) return;
    const pad = 16;
    const y = this.h - 22;
    ctx.font = `10px ${this._mono()}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255, 246, 236, 0.38)';
    const parts = [`ZOOM ${Math.round(this.camZoom * 100)}%`];
    if (this.viewMode === '3d') parts.push(`YAW ${fmtDeg(this.camYaw)}`, `PITCH ${fmtDeg(this.camPitch)}`);
    ctx.fillText(parts.join('   '), pad, y);

    // Scale bar (2 m) bottom-right
    const barW = 2 * this.unitScale;
    const bx = this.w - pad - barW;
    ctx.strokeStyle = 'rgba(255, 246, 236, 0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx, y); ctx.lineTo(bx + barW, y);
    ctx.moveTo(bx, y - 4); ctx.lineTo(bx, y + 4);
    ctx.moveTo(bx + barW, y - 4); ctx.lineTo(bx + barW, y + 4);
    ctx.stroke();
    ctx.textAlign = 'right';
    ctx.fillText('2 m', bx - 8, y);

    // Axis gizmo (3D)
    if (this.viewMode === '3d' && this.persp > 0.1) {
      const ox = pad + 22, oy = this.h - 62;
      const len = 18;
      const axes = [['X', 1, 0, 0, 'rgba(255, 110, 110, 0.8)'], ['Y', 0, 1, 0, 'rgba(120, 220, 140, 0.8)'], ['Z', 0, 0, 1, 'rgba(120, 170, 255, 0.8)']];
      ctx.textAlign = 'center';
      for (const [name, x, yv, z, col] of axes) {
        const c = this.camera.toCamera(x, yv, z);
        const ex = ox + c.right * len, ey = oy - c.up * len;
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.fillStyle = col;
        ctx.fillText(name, ox + c.right * (len + 9), oy - c.up * (len + 9));
      }
      ctx.fillStyle = 'rgba(255, 246, 236, 0.6)';
      ctx.beginPath(); ctx.arc(ox, oy, 2, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function fmtDeg(v) {
  const d = Math.round(((v % 360) + 360) % 360);
  return `${String(d).padStart(3, '0')}°`;
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
