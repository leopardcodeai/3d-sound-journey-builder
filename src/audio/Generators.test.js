import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fillNoise, fillPulse, fillBreath, buildGenerator, GENERATORS, clampParam, createPulseBuffer } from './Generators.js';
import { SpatialAudioEngine } from './AudioEngine.js';

// Minimal Web Audio mock that records connections
function param(v = 0) {
  return { value: v, setValueAtTime: vi.fn(), setTargetAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), cancelScheduledValues: vi.fn() };
}
function node(extra = {}) {
  return { connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), ...extra };
}
function createMockContext() {
  const sampleRate = 44100;
  return {
    sampleRate, currentTime: 0, state: 'running',
    destination: {},
    listener: { forwardX: param(), forwardY: param(), forwardZ: param(), upX: param(), upY: param(), upZ: param() },
    createGain: vi.fn(() => node({ gain: param(1) })),
    createOscillator: vi.fn(() => node({ type: 'sine', frequency: param(440), detune: param(0) })),
    createBiquadFilter: vi.fn(() => node({ type: '', Q: param(1), gain: param(0), frequency: param(1000) })),
    createPanner: vi.fn(() => node({ positionX: param(), positionY: param(), positionZ: param() })),
    createChannelMerger: vi.fn(() => node()),
    createChannelSplitter: vi.fn(() => node()),
    createAnalyser: vi.fn(() => node({ fftSize: 256, getByteTimeDomainData: vi.fn() })),
    createBufferSource: vi.fn(() => node({ buffer: null, loop: false, playbackRate: param(1) })),
    createBuffer: vi.fn((ch, length, sr) => ({ numberOfChannels: ch, length, sampleRate: sr, duration: length / sr, _data: Array.from({ length: ch }, () => new Float32Array(length)), getChannelData(i) { return this._data[i]; } })),
    createConvolver: vi.fn(() => node({ buffer: null })),
    createDynamicsCompressor: vi.fn(() => node({ threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() })),
    decodeAudioData: vi.fn(),
    resume: vi.fn(() => Promise.resolve()),
    close: vi.fn(),
  };
}

vi.stubGlobal('AudioContext', class { constructor() { return createMockContext(); } });
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

describe('noise and control buffers', () => {
  it('fills pink noise within bounds and with non-zero energy', () => {
    const data = fillNoise(new Float32Array(4096), 'pink');
    let max = 0, energy = 0;
    for (const v of data) { max = Math.max(max, Math.abs(v)); energy += v * v; }
    expect(max).toBeLessThanOrEqual(1);
    expect(energy).toBeGreaterThan(0);
  });

  it('brown noise is smoother than white noise (less high-frequency energy)', () => {
    const white = fillNoise(new Float32Array(8192), 'white');
    const brown = fillNoise(new Float32Array(8192), 'brown');
    const roughness = (d) => { let s = 0; for (let i = 1; i < d.length; i++) s += Math.abs(d[i] - d[i - 1]); return s / d.length; };
    expect(roughness(brown)).toBeLessThan(roughness(white) * 0.2);
  });

  it('pulse buffer is on for the duty fraction and silent otherwise', () => {
    const data = fillPulse(new Float32Array(1000), 0.5);
    expect(data[250]).toBeCloseTo(1, 5);
    expect(data[0]).toBeCloseTo(0, 5);
    expect(data[750]).toBe(0);
  });

  it('pulse buffer length realises the beat frequency', () => {
    const ctx = createMockContext();
    const buf = createPulseBuffer(ctx, 10, 0.5);
    expect(buf.length).toBe(4410);
  });

  it('breath envelope rises to 1 and returns to 0', () => {
    const data = fillBreath(new Float32Array(1000), 0.5, 0);
    expect(data[0]).toBeCloseTo(0, 3);
    expect(data[500]).toBeCloseTo(1, 3);
    expect(data[999]).toBeLessThan(0.01);
  });
});

describe('buildGenerator', () => {
  let ctx;
  beforeEach(() => { ctx = createMockContext(); });

  it('builds every registered generator with defaults and can stop it', () => {
    for (const name of Object.keys(GENERATORS)) {
      const h = buildGenerator(ctx, name);
      expect(h, name).toBeTruthy();
      expect(h.output.connect).toBeDefined();
      expect(typeof h.setParam).toBe('function');
      expect(() => h.stop()).not.toThrow();
    }
  });

  it('binaural is head-locked and puts carrier + beat in the right ear', () => {
    const h = buildGenerator(ctx, 'binaural', { carrier: 220, beat: 8 });
    expect(h.meta.headLocked).toBe(true);
    const oscs = ctx.createOscillator.mock.results.map(r => r.value);
    const freqs = oscs.map(o => o.frequency.setValueAtTime.mock.calls[0][0]);
    expect(freqs).toContain(220);
    expect(freqs).toContain(228);
    h.setParam('beat', 12);
    expect(h.params.beat).toBe(12);
    expect(oscs[1].frequency.setTargetAtTime).toHaveBeenCalledWith(232, 0, expect.any(Number));
  });

  it('returns null for unknown generators and clamps params', () => {
    expect(buildGenerator(ctx, 'nope')).toBeNull();
    expect(clampParam('binaural', 'beat', 500)).toBe(45);
    expect(clampParam('noise', 'color', 'brown')).toBe('brown');
  });

  it('breath exposes a phase that stays within one cycle', () => {
    const h = buildGenerator(ctx, 'breath', { bpm: 6 });
    ctx.currentTime = 12.5; // 1.25 cycles of 10 s
    expect(h.phase()).toBeCloseTo(0.25, 5);
  });
});

describe('SpatialAudioEngine with generators', () => {
  let engine;
  beforeEach(() => { engine = new SpatialAudioEngine(); engine.init(); });

  it('creates a reverb bus and a limiter when the context supports them', () => {
    expect(engine.reverbBus).toBeTruthy();
    expect(engine.limiter).toBeTruthy();
  });

  it('adds a binaural source head-locked (no panner) and a noise source spatialised', () => {
    const bw = engine.addSource('b1', 'bw_alpha', 'Alpha', 0, 0, 0, 0.4);
    expect(bw.kind).toBe('generator');
    expect(bw.spatial).toBe(false);
    expect(bw.pannerNode).toBeNull();
    expect(bw.params.beat).toBe(10);
    const n = engine.addSource('n1', 'noise_pink', 'Pink', 2, 1, 0, 0.5);
    expect(n.spatial).toBe(true);
    expect(n.pannerNode).toBeTruthy();
    expect(engine.sources.size).toBe(2);
  });

  it('setSourceParam clamps generator params and applies inserts', () => {
    engine.addSource('b1', 'bw_alpha', 'Alpha', 0, 0, 0, 0.4);
    expect(engine.setSourceParam('b1', 'beat', 99)).toBe(45);
    expect(engine.sources.get('b1').params.beat).toBe(45);
    expect(engine.setSourceParam('b1', 'reverb', 0.3)).toBe(0.3);
    expect(engine.sources.get('b1').inserts.reverb).toBe(0.3);
  });

  it('toggleSource pauses and rebuilds a generator', () => {
    const src = engine.addSource('b1', 'bw_theta', 'Theta', 0, 0, 0, 0.4);
    const first = src.generator;
    expect(engine.toggleSource('b1')).toBe(false);
    expect(engine.toggleSource('b1')).toBe(true);
    expect(src.generator).not.toBe(first);
    expect(src.params.beat).toBe(6);
  });

  it('applies amplitude modulation to samples on demand', () => {
    engine.addAudioBuffer('rain', { duration: 4, numberOfChannels: 2, length: 4 * 44100, sampleRate: 44100, getChannelData: () => new Float32Array(4) });
    const src = engine.addSource('r1', 'rain', 'Rain', 1, 1, 0, 0.5);
    expect(src._modLfo).toBeUndefined();
    engine.setSourceParam('r1', 'modRate', 14);
    engine.setSourceParam('r1', 'modDepth', 0.5);
    expect(src._modLfo).toBeTruthy();
    engine.setSourceParam('r1', 'modDepth', 0);
    expect(src._modLfo).toBeNull();
  });

  it('describeSession separates frequency tools from ambience', () => {
    engine.addSource('b1', 'bw_alpha', 'Alpha', 0, 0, 0, 0.4);
    engine.addSource('br', 'breath', 'Breath', 0, 0, 0, 0.4);
    const s = engine.describeSession();
    expect(s.frequency.length).toBe(2);
    expect(s.headLocked).toBe(true);
    expect(s.breath.id).toBe('br');
  });

  it('previews a generator without registering a source', async () => {
    const ok = await engine.previewSound('iso_alpha');
    expect(ok).toBe(true);
    expect(engine.sources.size).toBe(0);
    engine.stopPreview();
    expect(engine._previewGen).toBeNull();
  });
});
