import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CanvasGrid } from './CanvasGrid.js';

function createMockCanvas() {
  const canvas = {
    width: 800, height: 600,
    getContext: () => ({
      fillRect: vi.fn(), beginPath: vi.fn(), arc: vi.fn(), fill: vi.fn(),
      stroke: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), save: vi.fn(),
      restore: vi.fn(), translate: vi.fn(), rotate: vi.fn(), setTransform: vi.fn(),
      createRadialGradient: () => ({ addColorStop: vi.fn() }),
      createLinearGradient: () => ({ addColorStop: vi.fn() }),
    }),
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
