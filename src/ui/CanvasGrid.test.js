import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CanvasGrid } from './CanvasGrid.js';

function createMockCanvas() {
  const canvas = {
    width: 800, height: 600,
    getContext() {
      if (!this._ctx) {
        this._ctx = {
          fillRect: vi.fn(), clearRect: vi.fn(), beginPath: vi.fn(), closePath: vi.fn(),
          arc: vi.fn(), ellipse: vi.fn(), rect: vi.fn(), roundRect: vi.fn(),
          fill: vi.fn(), stroke: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(),
          save: vi.fn(), restore: vi.fn(), translate: vi.fn(), rotate: vi.fn(),
          scale: vi.fn(), setTransform: vi.fn(), setLineDash: vi.fn(),
          fillText: vi.fn(), measureText: () => ({ width: 10 }),
          createRadialGradient: () => ({ addColorStop: vi.fn() }),
          createLinearGradient: () => ({ addColorStop: vi.fn() }),
        };
      }
      return this._ctx;
    },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    addEventListener: vi.fn(),
    style: {},
  };
  return canvas;
}

function createMockAudioEngine() {
  return {
    sources: new Map(),
    getLeftRightLevels: () => ({ left: 0, right: 0 }),
    posture: 'standing',
    headTilt: 0,
    outputMode: 'hrtf',
    shoulderStrength: 0.5,
    pinnaStrength: 0.5,
    speakerPositions: null,
    editLayer: 'sources',
  };
}

describe('CanvasGrid coordinate transforms', () => {
  let canvas, engine, grid;

  beforeEach(() => {
    canvas = createMockCanvas();
    engine = createMockAudioEngine();
    vi.stubGlobal('window', { innerWidth: 800, innerHeight: 600, addEventListener: vi.fn(), devicePixelRatio: 1 });
    grid = new CanvasGrid(canvas, engine);
    // Set known dimensions
    grid.w = 800;
    grid.h = 600;
    grid.unitScale = 25;
  });

  it('should convert canvas center to audio origin', () => {
    const result = grid.canvasToAudioCoords(400, 300);
    expect(result.x).toBeCloseTo(0);
    expect(result.y).toBeCloseTo(0);
  });

  it('should convert audio origin to canvas center', () => {
    const result = grid.audioToCanvasCoords(0, 0);
    expect(result.x).toBeCloseTo(400);
    expect(result.y).toBeCloseTo(300);
  });

  it('should convert audio coords to canvas and back', () => {
    const audioPos = { x: 3, y: -2 };
    const canvasPos = grid.audioToCanvasCoords(audioPos.x, audioPos.y);
    const backToAudio = grid.canvasToAudioCoords(canvasPos.x, canvasPos.y);
    expect(backToAudio.x).toBeCloseTo(audioPos.x, 1);
    expect(backToAudio.y).toBeCloseTo(audioPos.y, 1);
  });

  it('should calculate node radius based on height', () => {
    expect(grid.getNodeRadius(0)).toBe(16);
    expect(grid.getNodeRadius(10)).toBe(24);
    expect(grid.getNodeRadius(-10)).toBe(8);
  });
});

describe('CanvasGrid _drawKeyframePath', () => {
  let canvas, engine, grid;

  beforeEach(() => {
    canvas = createMockCanvas();
    engine = createMockAudioEngine();
    vi.stubGlobal('window', { innerWidth: 800, innerHeight: 600, addEventListener: vi.fn(), devicePixelRatio: 1 });
    grid = new CanvasGrid(canvas, engine);
    grid.w = 800;
    grid.h = 600;
    grid.unitScale = 25;
  });

  it('does not throw when timeline is absent', () => {
    // timeline is undefined by default — must not throw
    expect(() => grid._drawKeyframePath()).not.toThrow();
  });

  it('does not throw when timeline has no keyframes for the selected node', () => {
    grid.selectedNodeId = 'node-1';
    grid.timeline = { keyframes: new Map() };
    expect(() => grid._drawKeyframePath()).not.toThrow();
  });
});

describe('CanvasGrid render loop', () => {
  let canvas, engine, grid;

  beforeEach(() => {
    canvas = createMockCanvas();
    engine = createMockAudioEngine();
    vi.stubGlobal('window', { innerWidth: 800, innerHeight: 600, addEventListener: vi.fn(), devicePixelRatio: 1 });
    grid = new CanvasGrid(canvas, engine);
  });

  it('paints once during construction so a hidden tab does not leave it blank', () => {
    expect(canvas.getContext().fillRect).toBeDefined();
    expect(grid._frame).toBe(0);
    // draw() ran in the constructor: the ground wash was filled at least once
    expect(grid.ctx.fillRect).toHaveBeenCalled();
  });

  it('keeps drawing while _isPaused is false, and stops when it is true', () => {
    grid.ctx.fillRect.mockClear();
    grid.draw();
    expect(grid.ctx.fillRect).toHaveBeenCalled();
    grid._isPaused = true;
    grid.ctx.fillRect.mockClear();
    grid.draw();
    expect(grid.ctx.fillRect).not.toHaveBeenCalled();
  });
});

describe('CanvasGrid sizing', () => {
  it('measures its own box rather than the window', () => {
    const canvas = createMockCanvas();
    // The canvas sits below a 48 px top bar, so its box is shorter than the window.
    canvas.getBoundingClientRect = () => ({ left: 0, top: 48, width: 1000, height: 700 });
    const engine = createMockAudioEngine();
    vi.stubGlobal('window', { innerWidth: 1000, innerHeight: 748, addEventListener: vi.fn(), devicePixelRatio: 2 });
    const grid = new CanvasGrid(canvas, engine);
    expect(grid.w).toBe(1000);
    expect(grid.h).toBe(700);
    expect(canvas.width).toBe(2000);
    expect(canvas.height).toBe(1400);
    // The projected origin lands in the middle of the real box.
    const p = grid.project(0, 0, 0);
    expect(p.sx).toBeCloseTo(500);
    expect(p.sy).toBeCloseTo(350);
  });

  it('falls back to the window when the box has not been laid out', () => {
    const canvas = createMockCanvas();
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 0, height: 0 });
    const engine = createMockAudioEngine();
    vi.stubGlobal('window', { innerWidth: 640, innerHeight: 480, addEventListener: vi.fn(), devicePixelRatio: 1 });
    const grid = new CanvasGrid(canvas, engine);
    expect(grid.w).toBe(640);
    expect(grid.h).toBe(480);
  });

  it('round-trips a pointer position through the real box', () => {
    const canvas = createMockCanvas();
    canvas.getBoundingClientRect = () => ({ left: 0, top: 48, width: 1000, height: 700 });
    const engine = createMockAudioEngine();
    vi.stubGlobal('window', { innerWidth: 1000, innerHeight: 748, addEventListener: vi.fn(), devicePixelRatio: 1 });
    const grid = new CanvasGrid(canvas, engine);
    const world = grid.canvasToAudioCoords(700, 200, 0);
    const back = grid.audioToCanvasCoords(world.x, world.y, 0);
    expect(back.x).toBeCloseTo(700, 3);
    expect(back.y).toBeCloseTo(200, 3);
  });
});

describe('CanvasGrid label placement', () => {
  let canvas, engine, grid, ctx;

  beforeEach(() => {
    canvas = createMockCanvas();
    engine = createMockAudioEngine();
    vi.stubGlobal('window', { innerWidth: 800, innerHeight: 600, addEventListener: vi.fn(), devicePixelRatio: 1 });
    grid = new CanvasGrid(canvas, engine);
    grid._labelRects = [];
    ctx = canvas.getContext('2d');
  });

  it('keeps the first label on its wanted line', () => {
    expect(grid._placeLabel(ctx, 'Breath pacer', 200, 100, 12)).toBe(100);
  });

  it('pushes a colliding label onto the next free line', () => {
    grid._placeLabel(ctx, 'Breath pacer', 200, 100, 12);
    expect(grid._placeLabel(ctx, 'Alpha binaural', 204, 100, 12)).toBe(112);
  });

  it('drops a label once three lines are taken', () => {
    for (let i = 0; i < 3; i++) grid._placeLabel(ctx, `s${i}`, 200, 100, 12);
    expect(grid._placeLabel(ctx, 'fourth', 200, 100, 12)).toBeNull();
  });

  it('still draws a selected label when every line is taken', () => {
    for (let i = 0; i < 3; i++) grid._placeLabel(ctx, `s${i}`, 200, 100, 12);
    expect(grid._placeLabel(ctx, 'selected', 200, 100, 12, true)).toBe(100);
  });

  it('leaves labels alone when they do not overlap horizontally', () => {
    grid._placeLabel(ctx, 'left', 100, 100, 12);
    expect(grid._placeLabel(ctx, 'right', 400, 100, 12)).toBe(100);
  });

  it('measures text without measureText', () => {
    expect(grid._textWidth({}, 'abcd')).toBe(24);
  });
});

/**
 * With speakers on screen, a double click on one of them starts moving them
 * and a double click anywhere ends it. Moving is a mode because a speaker and
 * a sound can share a spot, and a drag has to know which it is taking.
 */
describe('speaker move mode by double click', () => {
  function gridWithSpeakers() {
    const engine = createMockAudioEngine();
    engine.outputMode = 'speakers';
    engine.speakerPositions = [{ x: 0, y: 4, z: 0, label: 'L' }, { x: 3, y: 4, z: 0, label: 'R' }];
    const changes = [];
    const grid = new CanvasGrid(createMockCanvas(), engine, { onEditLayerChanged: (l) => changes.push(l) });
    grid.draw = () => {};
    return { grid, engine, changes };
  }

  it('enters on a speaker and leaves on the next double click anywhere', () => {
    const { grid, changes } = gridWithSpeakers();
    const on = grid.project(0, 4, 0);
    grid.handleDoubleClick({ clientX: on.sx, clientY: on.sy });
    expect(grid.editLayer).toBe('speakers');
    grid.handleDoubleClick({ clientX: 5, clientY: 5 });
    expect(grid.editLayer).toBe('sources');
    expect(changes).toEqual(['speakers', 'sources']);
  });

  it('does nothing of the sort with headphones, where there is nothing to move', () => {
    const { grid, engine } = gridWithSpeakers();
    engine.outputMode = 'hrtf';
    const on = grid.project(0, 4, 0);
    grid.handleDoubleClick({ clientX: on.sx, clientY: on.sy });
    expect(grid.editLayer).toBe('sources');
  });
});
