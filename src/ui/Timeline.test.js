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

    it('reflects visibility onto <body> so other panels can dodge the dock', () => {
      document.body.classList.remove('timeline-open');
      timeline.show();
      expect(document.body.classList.contains('timeline-open')).toBe(true);
      timeline.hide();
      expect(document.body.classList.contains('timeline-open')).toBe(false);
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

    it('renders each source\'s keyframe dots only in its own track', () => {
      audioEngine.sources.set('src1', { type: 'birds', name: 'A', x: 0, y: 0, z: 0, volume: 0.5 });
      audioEngine.sources.set('src2', { type: 'campfire', name: 'B', x: 0, y: 0, z: 0, volume: 0.5 });
      timeline.setKeyframes('src1', [
        { time: 0, x: 0, y: 0, z: 0, volume: 0.5 },
        { time: 60, x: 1, y: 1, z: 0, volume: 0.5 },
      ]);
      timeline.setKeyframes('src2', [
        { time: 30, x: 0, y: 0, z: 0, volume: 0.5 },
        { time: 90, x: 1, y: 1, z: 0, volume: 0.5 },
        { time: 150, x: 2, y: 2, z: 0, volume: 0.5 },
      ]);
      timeline.visible = true;
      timeline._render();

      const track1 = container.querySelector('.tl-pro-track[data-id="src1"]');
      const track2 = container.querySelector('.tl-pro-track[data-id="src2"]');
      // Malformed (self-closing) dot divs would nest later tracks inside earlier
      // ones, inflating these counts. Each track must hold only its own dots.
      expect(track1.querySelectorAll('.tl-pro-kf').length).toBe(2);
      expect(track2.querySelectorAll('.tl-pro-kf').length).toBe(3);
    });
  });

  describe('timing', () => {
    it('should ensure timing entry exists spanning the whole journey', () => {
      timeline.ensureTiming('src1');
      expect(timeline.sourceTimings.has('src1')).toBe(true);
      const t = timeline.sourceTimings.get('src1');
      expect(t.startTime).toBe(0);
      expect(t.duration).toBe(timeline.totalDuration);
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

  describe('removeKeyframe', () => {
    it('should remove a keyframe by index and drop empty lists', () => {
      timeline.setKeyframes('src1', [
        { time: 0, x: 0, y: 0, z: 0, volume: 0.5 },
        { time: 60, x: 3, y: 2, z: 1, volume: 0.6 },
      ]);
      timeline.removeKeyframe('src1', 0);
      expect(timeline.keyframes.get('src1').length).toBe(1);
      expect(timeline.keyframes.get('src1')[0].time).toBe(60);
      timeline.removeKeyframe('src1', 0);
      expect(timeline.keyframes.has('src1')).toBe(false);
    });

    it('should ignore invalid indices', () => {
      timeline.setKeyframes('src1', [{ time: 0, x: 0, y: 0, z: 0, volume: 0.5 }]);
      timeline.removeKeyframe('src1', 5);
      timeline.removeKeyframe('missing', 0);
      expect(timeline.keyframes.get('src1').length).toBe(1);
    });
  });

  describe('setTotalDuration', () => {
    it('should clamp playhead and clip timings into the new range', () => {
      timeline.sourceTimings.set('src1', { startTime: 200, duration: 400 });
      timeline.playheadTime = 500;
      timeline.setTotalDuration(300);
      expect(timeline.totalDuration).toBe(300);
      expect(timeline.playheadTime).toBe(300);
      const t = timeline.sourceTimings.get('src1');
      expect(t.startTime).toBe(200);
      expect(t.duration).toBe(100);
    });
  });

  describe('keyframe playback (_applyKeyframes)', () => {
    function addSource(id, overrides = {}) {
      const src = {
        id, type: 'birds', name: id,
        x: 0, y: 0, z: 0, volume: 0.5, isPlaying: true,
        gainNode: { gain: { setTargetAtTime: vi.fn() } },
        ...overrides,
      };
      audioEngine.sources.set(id, src);
      return src;
    }

    it('applies a single keyframe position', () => {
      addSource('src1');
      timeline.setKeyframes('src1', [{ time: 0, x: 2, y: 3, z: 1, volume: 0.4 }]);
      timeline.playheadTime = 10;
      timeline._applyKeyframes();
      expect(audioEngine.updateSourcePosition).toHaveBeenCalledWith('src1', 2, 3, 1);
    });

    it('drives the gain from interpolated keyframe volume', () => {
      const src = addSource('src1');
      timeline.sourceTimings.set('src1', { startTime: 0, duration: 600 });
      timeline.setKeyframes('src1', [
        { time: 0, x: 0, y: 0, z: 0, volume: 0.0 },
        { time: 10, x: 0, y: 0, z: 0, volume: 1.0 },
      ]);
      timeline.playheadTime = 5;
      timeline._applyKeyframes();
      const calls = src.gainNode.gain.setTargetAtTime.mock.calls;
      expect(calls.length).toBe(1);
      expect(calls[0][0]).toBeCloseTo(0.5);
    });

    it('mutes sources outside their clip window', () => {
      const src = addSource('src1');
      timeline.sourceTimings.set('src1', { startTime: 100, duration: 50 });
      timeline.playheadTime = 0;
      timeline._applyKeyframes();
      const calls = src.gainNode.gain.setTargetAtTime.mock.calls;
      expect(calls[calls.length - 1][0]).toBe(0);
    });

    it('uses the source volume when no keyframes define one', () => {
      const src = addSource('src1', { volume: 0.7 });
      timeline.sourceTimings.set('src1', { startTime: 0, duration: 600 });
      timeline.playheadTime = 10;
      timeline._applyKeyframes();
      const calls = src.gainNode.gain.setTargetAtTime.mock.calls;
      expect(calls[calls.length - 1][0]).toBeCloseTo(0.7);
    });

    it('passes elapsed clip time as offset when activating a mid-journey source', () => {
      const src = addSource('src2', { isPlaying: false });
      // Clip starts at t=30, duration 60; playhead is at t=45 (15s into the clip)
      timeline.sourceTimings.set('src2', { startTime: 30, duration: 60 });
      timeline.playheadTime = 45;
      timeline._applyKeyframes();
      expect(audioEngine.toggleSource).toHaveBeenCalledWith('src2', 15);
    });

    it('marks keyframed sources as timeline-controlled only while playing', () => {
      const src = addSource('src1');
      timeline.setKeyframes('src1', [
        { time: 0, x: 0, y: 0, z: 0, volume: 0.5 },
        { time: 10, x: 1, y: 1, z: 0, volume: 0.5 },
      ]);
      timeline.isPlaying = true;
      timeline._applyKeyframes();
      expect(src._timelineControlled).toBe(true);
      timeline.pause();
      expect(src._timelineControlled).toBe(false);
    });
  });
});
