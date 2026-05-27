import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SoundscapeTimer } from './Timer';

const mockAudioEngine = {
  isInitialized: true,
  ctx: { currentTime: 100 },
  masterGain: {
    gain: {
      value: 0.8,
      cancelScheduledValues: vi.fn(),
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
    },
  },
  sources: new Map([
    ['src1', { id: 'src1', isPlaying: true }],
    ['src2', { id: 'src2', isPlaying: true }],
    ['src3', { id: 'src3', isPlaying: false }],
  ]),
  toggleSource: vi.fn(),
};

describe('SoundscapeTimer', () => {
  let timer;
  let callbacks;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    callbacks = {
      onStart: vi.fn(),
      onTick: vi.fn(),
      onStop: vi.fn(),
      onComplete: vi.fn(),
    };

    mockAudioEngine.masterGain.gain.value = 0.8;
    timer = new SoundscapeTimer(mockAudioEngine, callbacks);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('start', () => {
    it('sets duration and remaining correctly', () => {
      timer.start(5);

      expect(timer.duration).toBe(300);
      expect(timer.remaining).toBe(300);
      expect(timer.running).toBe(true);
    });

    it('calls onStart callback', () => {
      timer.start(3);
      expect(callbacks.onStart).toHaveBeenCalledTimes(1);
    });

    it('stops any existing timer before starting', () => {
      timer.start(5);
      timer.start(10);

      expect(timer.duration).toBe(600);
      expect(callbacks.onStop).toHaveBeenCalledTimes(2);
    });

    it('starts interval that decrements remaining', () => {
      timer.start(1);

      vi.advanceTimersByTime(1000);
      expect(timer.remaining).toBe(59);

      vi.advanceTimersByTime(2000);
      expect(timer.remaining).toBe(57);
    });

    it('calls onTick callback each second', () => {
      timer.start(1);

      vi.advanceTimersByTime(1000);
      expect(callbacks.onTick).toHaveBeenCalledWith(59);

      vi.advanceTimersByTime(1000);
      expect(callbacks.onTick).toHaveBeenCalledWith(58);
    });

    it('stops and fades when timer reaches zero', () => {
      timer.start(0.05);

      vi.advanceTimersByTime(3000);
      expect(timer.running).toBe(false);
      expect(callbacks.onTick).toHaveBeenCalledTimes(3);
    });
  });

  describe('stop', () => {
    it('clears interval and resets state', () => {
      timer.start(5);
      timer.stop();

      expect(timer.interval).toBeNull();
      expect(timer.running).toBe(false);
      expect(timer.duration).toBe(0);
      expect(timer.remaining).toBe(0);
    });

    it('calls onStop callback', () => {
      timer.start(5);
      vi.clearAllMocks();
      timer.stop();

      expect(callbacks.onStop).toHaveBeenCalledTimes(1);
    });

    it('is safe to call when not running', () => {
      expect(() => timer.stop()).not.toThrow();
      expect(timer.interval).toBeNull();
      expect(timer.running).toBe(false);
    });
  });

  describe('getRemaining', () => {
    it('returns correct format', () => {
      timer.start(5);
      const remaining = timer.getRemaining();

      expect(remaining).toHaveProperty('hours');
      expect(remaining).toHaveProperty('minutes');
      expect(remaining).toHaveProperty('seconds');
    });

    it('calculates hours, minutes, seconds correctly', () => {
      timer.start(90);
      const remaining = timer.getRemaining();

      expect(remaining.hours).toBe(1);
      expect(remaining.minutes).toBe(30);
      expect(remaining.seconds).toBe(0);
    });

    it('returns zeros when timer not started', () => {
      const remaining = timer.getRemaining();

      expect(remaining.hours).toBe(0);
      expect(remaining.minutes).toBe(0);
      expect(remaining.seconds).toBe(0);
    });

    it('reflects elapsed time', () => {
      timer.start(1);
      vi.advanceTimersByTime(5000);

      const remaining = timer.getRemaining();
      expect(remaining.minutes).toBe(0);
      expect(remaining.seconds).toBe(55);
    });
  });

  describe('toggle', () => {
    it('starts timer when not running', () => {
      timer.toggle(5);

      expect(timer.running).toBe(true);
      expect(timer.duration).toBe(300);
    });

    it('stops timer when running', () => {
      timer.toggle(5);
      timer.toggle(5);

      expect(timer.running).toBe(false);
      expect(timer.duration).toBe(0);
    });

    it('can restart after stopping', () => {
      timer.toggle(5);
      timer.toggle(5);
      timer.toggle(10);

      expect(timer.running).toBe(true);
      expect(timer.duration).toBe(600);
    });
  });

  describe('_fadeAndPause', () => {
    it('calls audioEngine methods for fade out', () => {
      timer._fadeAndPause();

      const gainNode = mockAudioEngine.masterGain.gain;
      expect(gainNode.cancelScheduledValues).toHaveBeenCalled();
      expect(gainNode.setValueAtTime).toHaveBeenCalledWith(0.8, 100);
      expect(gainNode.linearRampToValueAtTime).toHaveBeenCalledWith(0, 103);
    });

    it('toggles off playing sources after fade', () => {
      timer._fadeAndPause();
      vi.advanceTimersByTime(3100);

      expect(mockAudioEngine.toggleSource).toHaveBeenCalledWith('src1');
      expect(mockAudioEngine.toggleSource).toHaveBeenCalledWith('src2');
      expect(mockAudioEngine.toggleSource).not.toHaveBeenCalledWith('src3');
    });

    it('calls onComplete callback after fade', () => {
      timer._fadeAndPause();
      vi.advanceTimersByTime(3100);

      expect(callbacks.onComplete).toHaveBeenCalledTimes(1);
    });

    it('returns early if engine not initialized', () => {
      const uninitEngine = { isInitialized: false };
      const uninitTimer = new SoundscapeTimer(uninitEngine, callbacks);

      uninitTimer._fadeAndPause();

      expect(mockAudioEngine.masterGain.gain.cancelScheduledValues).not.toHaveBeenCalled();
    });

    it('returns early if ctx is missing', () => {
      const noCtxEngine = { isInitialized: true, ctx: null, masterGain: mockAudioEngine.masterGain };
      const noCtxTimer = new SoundscapeTimer(noCtxEngine, callbacks);

      noCtxTimer._fadeAndPause();

      expect(mockAudioEngine.masterGain.gain.cancelScheduledValues).not.toHaveBeenCalled();
    });

    it('returns early if masterGain is missing', () => {
      const noGainEngine = { isInitialized: true, ctx: mockAudioEngine.ctx, masterGain: null };
      const noGainTimer = new SoundscapeTimer(noGainEngine, callbacks);

      noGainTimer._fadeAndPause();

      expect(mockAudioEngine.masterGain.gain.cancelScheduledValues).not.toHaveBeenCalled();
    });
  });
});
