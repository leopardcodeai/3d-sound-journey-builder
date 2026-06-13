import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SpatialAudioEngine } from './AudioEngine.js';

// --- Web Audio API Mock Factories ---
// Each factory returns a NEW object so that modifications by the engine
// do not leak between calls (the engine mutates .gain.value, .frequency.value, etc.).

function createMockGainNode() {
  return {
    gain: { setValueAtTime: vi.fn(), cancelScheduledValues: vi.fn(), linearRampToValueAtTime: vi.fn(), value: 0.8 },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
}

function createMockPannerNode() {
  return {
    panningModel: '',
    distanceModel: '',
    refDistance: 1.0,
    maxDistance: 10000,
    rolloffFactor: 1.2,
    positionX: { setValueAtTime: vi.fn() },
    positionY: { setValueAtTime: vi.fn() },
    positionZ: { setValueAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
}

function createMockBiquadFilter() {
  return {
    type: '',
    Q: { value: 1.0 },
    gain: { value: 0, setValueAtTime: vi.fn() },
    frequency: { value: 1000, setValueAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
}

function createMockBufferSource() {
  return {
    buffer: null,
    loop: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
}

function createMockAnalyser() {
  return {
    fftSize: 1024,
    connect: vi.fn(),
    disconnect: vi.fn(),
    getByteTimeDomainData: vi.fn(),
  };
}

function createMockChannelSplitter() {
  return { connect: vi.fn(), disconnect: vi.fn() };
}

function createMockChannelMerger() {
  return { connect: vi.fn(), disconnect: vi.fn() };
}

function createMockOscillator() {
  return {
    type: '',
    frequency: { value: 440 },
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
}

function createMockListener() {
  return {
    forwardX: { setValueAtTime: vi.fn() },
    forwardY: { setValueAtTime: vi.fn() },
    forwardZ: { setValueAtTime: vi.fn() },
    upX: { setValueAtTime: vi.fn() },
    upY: { setValueAtTime: vi.fn() },
    upZ: { setValueAtTime: vi.fn() },
  };
}

function createMockAudioBuffer(channels = 1, length = 44100, sampleRate = 44100) {
  return {
    numberOfChannels: channels,
    length,
    sampleRate,
    duration: length / sampleRate,
    getChannelData: () => new Float32Array(length),
  };
}

// Build a fresh mock context each time `new AudioContext()` is called.
function createMockContext() {
  const listener = createMockListener();
  const ctx = {
    createGain: vi.fn(createMockGainNode),
    createPanner: vi.fn(createMockPannerNode),
    createBiquadFilter: vi.fn(createMockBiquadFilter),
    createBufferSource: vi.fn(createMockBufferSource),
    createAnalyser: vi.fn(createMockAnalyser),
    createChannelSplitter: vi.fn(createMockChannelSplitter),
    createChannelMerger: vi.fn(createMockChannelMerger),
    createOscillator: vi.fn(createMockOscillator),
    createBuffer: vi.fn(createMockAudioBuffer),
    decodeAudioData: vi.fn(() => Promise.resolve(createMockAudioBuffer())),
    currentTime: 0,
    sampleRate: 44100,
    state: 'running',
    listener,
    destination: {},
    resume: vi.fn(() => Promise.resolve()),
    close: vi.fn(() => Promise.resolve()),
  };
  return ctx;
}

// Stub globals before importing the engine
vi.stubGlobal('AudioContext', class {
  constructor() {
    return createMockContext();
  }
});
vi.stubGlobal('webkitAudioContext', class {
  constructor() {
    return createMockContext();
  }
});

// Suppress console output during tests
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

describe('SpatialAudioEngine', () => {
  let engine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new SpatialAudioEngine();
  });

  describe('initialization', () => {
    it('should not be initialized by default', () => {
      expect(engine.isInitialized).toBe(false);
    });

    it('should create AudioContext on init', () => {
      engine.init();
      expect(engine.isInitialized).toBe(true);
      expect(engine.ctx).toBeDefined();
    });

    it('should not reinitialize if already initialized', () => {
      engine.init();
      const ctx = engine.ctx;
      engine.init();
      expect(engine.ctx).toBe(ctx);
    });

    it('should set up master gain and analysers', () => {
      engine.init();
      expect(engine.masterGain).toBeDefined();
      expect(engine.leftAnalyser).toBeDefined();
      expect(engine.rightAnalyser).toBeDefined();
      expect(engine.masterGain.gain.setValueAtTime).toHaveBeenCalledWith(0.8, 0);
    });
  });

  describe('master volume', () => {
    beforeEach(() => engine.init());

    it('should set master volume', () => {
      engine.setMasterVolume(0.5);
      expect(engine._lastVolume).toBe(0.5);
    });

    it('should toggle mute', () => {
      const result = engine.toggleMasterMute();
      expect(result).toBe(true);
      expect(engine._muted).toBe(true);
    });

    it('should unmute and restore volume', () => {
      engine.toggleMasterMute();
      engine.toggleMasterMute();
      expect(engine._muted).toBe(false);
    });
  });

  describe('listener pose', () => {
    beforeEach(() => engine.init());

    it('should update standing pose', () => {
      engine.updateListenerPose('standing', 0);
      expect(engine.posture).toBe('standing');
      expect(engine.headTilt).toBe(0);
    });

    it('should apply lying-back preset', () => {
      engine.applyPosturePreset('lying-back');
      expect(engine.posture).toBe('lying-back');
      expect(engine.shoulderStrength).toBe(0.8);
      expect(engine.pinnaStrength).toBe(0.4);
    });

    it('should apply lying-side preset', () => {
      engine.applyPosturePreset('lying-side');
      expect(engine.posture).toBe('lying-side');
      expect(engine.headTilt).toBe(-45);
    });
  });

  describe('source management', () => {
    beforeEach(() => {
      engine.init();
      const buf = createMockAudioBuffer(1, 44100, 44100);
      engine.addAudioBuffer('test_sound', buf);
    });

    it('should add a source', () => {
      const src = engine.addSource('test1', 'test_sound', 'Test', 1, 2, 0, 0.5);
      expect(src).toBeDefined();
      expect(src.id).toBe('test1');
      expect(engine.sources.size).toBe(1);
    });

    it('should remove a source', () => {
      engine.addSource('test1', 'test_sound', 'Test', 1, 2, 0, 0.5);
      engine.removeSource('test1');
      expect(engine.sources.size).toBe(0);
    });

    it('should return null for missing buffer', () => {
      const src = engine.addSource('test2', 'nonexistent', 'Test', 0, 0, 0, 0.5);
      expect(src).toBe(null);
    });

    it('should update source position', () => {
      engine.addSource('test1', 'test_sound', 'Test', 1, 2, 0, 0.5);
      engine.updateSourcePosition('test1', 3, 4, 2);
      const src = engine.sources.get('test1');
      expect(src.x).toBe(3);
      expect(src.y).toBe(4);
      expect(src.z).toBe(2);
    });

    it('should update source volume', () => {
      engine.addSource('test1', 'test_sound', 'Test', 0, 0, 0, 0.5);
      engine.updateSourceVolume('test1', 0.8);
      const src = engine.sources.get('test1');
      expect(src.volume).toBe(0.8);
    });
  });

  describe('getLeftRightLevels', () => {
    it('should return zeros when not initialized', () => {
      const levels = engine.getLeftRightLevels();
      expect(levels).toEqual({ left: 0, right: 0 });
    });
  });

  describe('destroy', () => {
    beforeEach(() => engine.init());

    it('should close context and clear sources', () => {
      const buf = createMockAudioBuffer(1, 100, 44100);
      engine.addAudioBuffer('test', buf);
      engine.addSource('t1', 'test', 'T', 0, 0, 0, 0.5);
      engine.destroy();
      expect(engine.isInitialized).toBe(false);
      expect(engine.sources.size).toBe(0);
    });
  });

  describe('toggleSource offset', () => {
    beforeEach(() => {
      engine.init();
      // buffer duration = 44100/44100 = 1 second
      const buf = createMockAudioBuffer(1, 44100, 44100);
      engine.addAudioBuffer('snd', buf);
    });

    it('starts with offset=0 by default (start called with (0, 0))', () => {
      engine.addSource('s1', 'snd', 'S', 0, 0, 0, 0.5);
      const src = engine.sources.get('s1');
      // addSource leaves isPlaying=true; toggle off first
      engine.toggleSource('s1');
      expect(src.isPlaying).toBe(false);

      // Toggle back on without offset
      engine.toggleSource('s1');
      expect(src.isPlaying).toBe(true);
      expect(src.sourceNode.start).toHaveBeenCalledWith(0, 0);
    });

    it('applies offset modulo buffer duration on activation', () => {
      engine.addSource('s2', 'snd', 'S', 0, 0, 0, 0.5);
      const src = engine.sources.get('s2');
      engine.toggleSource('s2');
      expect(src.isPlaying).toBe(false);

      // buf.duration = 1s; offset 1.7 -> 1.7 % 1 = 0.7
      engine.toggleSource('s2', 1.7);
      expect(src.isPlaying).toBe(true);
      expect(src.sourceNode.start).toHaveBeenCalledWith(0, expect.closeTo(0.7, 5));
    });

    it('does not pass offset to brainwave sources', () => {
      engine.init();
      const bwBuf = createMockAudioBuffer(1, 44100, 44100);
      engine.addAudioBuffer('bw_alpha', bwBuf);
      // Manually insert a brainwave source so toggleSource hits that branch
      engine.sources.set('bw1', {
        id: 'bw1', type: 'bw_alpha', isPlaying: false,
        _bwFreq: 10, volume: 0.5,
        _leftGain: engine.ctx.createGain(),
        _rightGain: engine.ctx.createGain(),
        _merger: engine.ctx.createChannelMerger(),
        gainNode: engine.ctx.createGain(),
        shoulderFilter: engine.ctx.createBiquadFilter(),
      });
      // Should not throw; brainwave branch ignores offset
      expect(() => engine.toggleSource('bw1', 5)).not.toThrow();
    });
  });
});
