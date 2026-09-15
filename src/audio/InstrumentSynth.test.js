import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InstrumentSynth, CHAKRA_BOWLS } from './InstrumentSynth.js';

const SR = 44100;

function createEngine() {
  const buffers = new Map();
  return {
    buffers,
    ctx: {
      sampleRate: SR,
      createBuffer: (channels, length, sampleRate) => ({
        numberOfChannels: channels, length, sampleRate,
        duration: length / sampleRate,
        _data: Array.from({ length: channels }, () => new Float32Array(length)),
        getChannelData(i) { return this._data[i]; },
      }),
    },
    addAudioBuffer: (type, buf) => buffers.set(type, buf),
  };
}

/**
 * Estimate the fundamental by autocorrelation.
 *
 * Autocorrelation peaks just as strongly at twice the true period, so a naive
 * "take the highest peak" reports an octave too low whenever a harmonic is
 * strong. The guard below takes the *shortest* period that still correlates
 * almost as well as the best one, which is the standard fix.
 */
function fundamentalHz(data, sr, fromSec = 1, seconds = 1) {
  const start = Math.floor(sr * fromSec);
  const n = Math.floor(sr * seconds);
  const slice = data.subarray(start, start + n);
  let mean = 0;
  for (let i = 0; i < n; i++) mean += slice[i];
  mean /= n;

  const corr = (lag) => {
    let sum = 0;
    for (let i = 0; i < n - lag; i += 2) sum += (slice[i] - mean) * (slice[i + lag] - mean);
    return sum;
  };

  const minLag = Math.floor(sr / 900);
  const maxLag = Math.floor(sr / 150);
  const values = new Float64Array(maxLag + 2);
  let best = -Infinity;
  for (let lag = minLag; lag <= maxLag + 1; lag++) {
    values[lag] = corr(lag);
    if (lag <= maxLag && values[lag] > best) best = values[lag];
  }

  // The earliest local maximum that reaches 90 percent of the global one.
  let bestLag = minLag;
  for (let lag = minLag + 1; lag < maxLag; lag++) {
    if (values[lag] >= best * 0.9 && values[lag] > values[lag - 1] && values[lag] >= values[lag + 1]) {
      bestLag = lag;
      break;
    }
  }

  const y0 = values[bestLag - 1] || corr(bestLag - 1);
  const y1 = values[bestLag];
  const y2 = values[bestLag + 1];
  const denom = y0 - 2 * y1 + y2;
  const shift = denom !== 0 ? (0.5 * (y0 - y2)) / denom : 0;
  return sr / (bestLag + shift);
}

const cents = (got, want) => 1200 * Math.log2(got / want);
const peak = (data) => { let m = 0; for (let i = 0; i < data.length; i++) m = Math.max(m, Math.abs(data[i])); return m; };

describe('InstrumentSynth', () => {
  let engine, synth;

  beforeEach(() => {
    engine = createEngine();
    synth = new InstrumentSynth(engine);
  });

  describe('surface', () => {
    it('exposes every method the app calls', () => {
      for (const name of ['preloadAll', 'preloadHealing', 'preloadChakraBowls', 'generateBuffer']) {
        expect(typeof synth[name], name).toBe('function');
      }
    });

    it('preloadAll registers one buffer per instrument', () => {
      synth.preloadAll('C4');
      const types = Object.keys(synth.instruments);
      expect(engine.buffers.size).toBe(types.length);
      for (const t of types) expect(engine.buffers.has('instr_' + t), t).toBe(true);
    });

    it('preloadHealing registers the strike, the gong and all seven bowls', () => {
      synth.preloadHealing();
      expect(engine.buffers.has('bell')).toBe(true);
      expect(engine.buffers.has('gong_old')).toBe(true);
      for (const { type } of CHAKRA_BOWLS) expect(engine.buffers.has(type), type).toBe(true);
      expect(engine.buffers.size).toBe(CHAKRA_BOWLS.length + 2);
    });

    it('needs no recorded sample to build the bowls', () => {
      expect(engine.buffers.size).toBe(0);
      synth.preloadChakraBowls();
      expect(engine.buffers.size).toBe(CHAKRA_BOWLS.length);
    });
  });

  describe('chakra bowls', () => {
    it('sounds each bowl at the frequency it is labelled with', () => {
      synth.preloadChakraBowls();
      for (const { type, freq } of CHAKRA_BOWLS) {
        const data = engine.buffers.get(type).getChannelData(0);
        const got = fundamentalHz(data, SR);
        // Ten cents is a tenth of a semitone: far tighter than anyone hears,
        // and far tighter than the two percent the old wobble was dragging it.
        expect(Math.abs(cents(got, freq)), `${type} at ${Math.round(got)} Hz`).toBeLessThan(10);
      }
    });

    it('covers the chakra table exactly once each', () => {
      expect(CHAKRA_BOWLS.map(b => b.freq)).toEqual([256, 288, 320, 341, 384, 426, 480]);
      expect(new Set(CHAKRA_BOWLS.map(b => b.type)).size).toBe(7);
    });
  });

  describe('signal quality', () => {
    it('never clips', () => {
      synth.preloadHealing();
      for (const [type, buf] of engine.buffers) {
        expect(peak(buf.getChannelData(0)), type).toBeLessThanOrEqual(1);
      }
    });

    it('starts loud and ends in silence, so a one-shot cannot click', () => {
      synth.preloadHealing();
      for (const [type, buf] of engine.buffers) {
        const data = buf.getChannelData(0);
        const head = peak(data.subarray(0, SR));
        const tail = peak(data.subarray(data.length - 256));
        expect(head, `${type} head`).toBeGreaterThan(0.05);
        expect(tail, `${type} tail`).toBeLessThan(0.002);
      }
    });

    it('gives the gong a slower attack than the bowl, which is what a bloom is', () => {
      synth.preloadHealing();
      const energyAt = (type, sec) => {
        const d = engine.buffers.get(type).getChannelData(0);
        const from = Math.floor(SR * sec);
        return peak(d.subarray(from, from + Math.floor(SR * 0.25)));
      };
      // The gong keeps gaining after the strike; the bowl only decays.
      expect(energyAt('gong_old', 1.5)).toBeGreaterThan(energyAt('gong_old', 0.4) * 0.9);
      expect(energyAt('bowl_f', 3)).toBeLessThan(energyAt('bowl_f', 0.4));
    });
  });
});
