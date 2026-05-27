import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Timeline } from './Timeline.js';

function createMockAudioEngine() {
  return {
    sources: new Map(),
    ctx: { currentTime: 0 },
    updateSourcePosition: vi.fn(),
    updateSourceVolume: vi.fn(),
    toggleSource: vi.fn(),
  };
}

function createMockCanvasGrid() {
  return {
    themeColors: { birds: '#10b981', campfire: '#ef4444', custom: '#f43f5e' },
    emojiMap: { birds: '🐦', campfire: '🪵' },
  };
}

describe('Timeline', () => {
  let container, audioEngine, canvasGrid, timeline;

  beforeEach(() => {
    // Use real jsdom elements - no mocking needed
    container = document.createElement('div');
    document.body.appendChild(container);
    
    audioEngine = createMockAudioEngine();
    canvasGrid = createMockCanvasGrid();
    
    timeline = new Timeline(container, audioEngine, canvasGrid);
  });

  describe('initialization', () => {
    it('should start with default values', () => {
      expect(timeline.visible).toBe(false);
      expect(timeline.isPlaying).toBe(false);
      expect(timeline.isLooping).toBe(true);
      expect(timeline.pixelsPerSecond).toBe(12);
      expect(timeline.totalDuration).toBe(600);
    });

    it('should build DOM structure', () => {
      expect(container.innerHTML).toBeDefined();
      expect(container.querySelector('.tl-pro-header')).toBeTruthy();
      expect(container.querySelector('.tl-pro-viewport')).toBeTruthy();
    });
  });

  describe('toggle visibility', () => {
    it('should toggle visible state', () => {
      timeline.toggle();
      expect(timeline.visible).toBe(true);
      timeline.toggle();
      expect(timeline.visible).toBe(false);
    });

    it('should pause when hidden', () => {
      timeline.visible = true;
      timeline.isPlaying = true;
      timeline.toggle();
      expect(timeline.isPlaying).toBe(false);
    });
  });

  describe('play/pause/stop', () => {
    it('should toggle play state', () => {
      timeline.togglePlay();
      expect(timeline.isPlaying).toBe(true);
      timeline.togglePlay();
      expect(timeline.isPlaying).toBe(false);
    });

    it('should stop and reset playhead', () => {
      timeline.playheadTime = 100;
      timeline.stop();
      expect(timeline.playheadTime).toBe(0);
      expect(timeline.isPlaying).toBe(false);
    });
  });

  describe('scrolling', () => {
    it('should clamp scrollX to valid range', () => {
      timeline.scrollX = -100;
      timeline._clampScroll();
      expect(timeline.scrollX).toBe(0);
    });

    it('should clamp scrollX to max width', () => {
      const maxScroll = timeline.totalDuration * timeline.pixelsPerSecond + 200 - timeline.viewport.clientWidth;
      timeline.scrollX = maxScroll + 500;
      timeline._clampScroll();
      expect(timeline.scrollX).toBeCloseTo(maxScroll, 0);
    });

    it('should accept valid scroll position', () => {
      timeline.scrollX = 100;
      timeline._clampScroll();
      expect(timeline.scrollX).toBe(100);
    });
  });

  describe('keyframes', () => {
    it('should set keyframes for a source', () => {
      const kfs = [
        { time: 0, x: 0, y: 0, z: 0, volume: 0.5 },
        { time: 60, x: 3, y: 2, z: 1, volume: 0.6 },
      ];
      timeline.setKeyframes('src1', kfs);
      expect(timeline.keyframes.has('src1')).toBe(true);
      expect(timeline.keyframes.get('src1').length).toBe(2);
    });

    it('should add keyframe in sorted order', () => {
      timeline.keyframes.set('src1', [
        { time: 60, x: 3, y: 0, z: 0, volume: 0.5 },
      ]);
      audioEngine.sources.set('src1', { x: 0, y: 0, z: 0, volume: 0.5 });
      timeline.playheadTime = 30;
      timeline.addKeyframe('src1', 30, { x: 1, y: 1 });
      const kfs = timeline.keyframes.get('src1');
      expect(kfs[0].time).toBe(30);
      expect(kfs[1].time).toBe(60);
    });
  });

  describe('timing', () => {
    it('should ensure timing entry exists', () => {
      timeline.ensureTiming('src1');
      expect(timeline.sourceTimings.has('src1')).toBe(true);
      const t = timeline.sourceTimings.get('src1');
      expect(t.startTime).toBe(0);
      expect(t.duration).toBe(60);
    });

    it('should not overwrite existing timing', () => {
      timeline.sourceTimings.set('src1', { startTime: 30, duration: 120 });
      timeline.ensureTiming('src1');
      const t = timeline.sourceTimings.get('src1');
      expect(t.startTime).toBe(30);
      expect(t.duration).toBe(120);
    });
  });

  describe('easing', () => {
    it('should return linear by default', () => {
      expect(timeline._ease(0.5, 'linear')).toBe(0.5);
    });

    it('should apply ease-in', () => {
      expect(timeline._ease(0.5, 'ease-in')).toBe(0.25);
    });

    it('should apply ease-out', () => {
      expect(timeline._ease(0.5, 'ease-out')).toBe(0.75);
    });
  });
});
