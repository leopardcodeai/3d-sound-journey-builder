/**
 * Generators
 * Procedural sound sources built from Web Audio primitives. Each builder
 * returns a handle: { output, stop(), setParam(key, value), params, meta }.
 *
 * Builders never touch the master bus; the engine decides how the `output`
 * node is routed (spatialised through the HRTF panner, or head-locked for
 * binaural beats, which need a distinct frequency per ear).
 */

// ---------------------------------------------------------------------------
// Buffers
// ---------------------------------------------------------------------------

/**
 * Generate a looping noise buffer. Channels are decorrelated so stereo noise
 * has width instead of collapsing to the centre.
 * White: flat. Pink: Paul Kellet's economy filter (-3 dB/oct).
 * Brown: leaky integrator of white (-6 dB/oct).
 */
export function createNoiseBuffer(ctx, color = 'pink', seconds = 6, channels = 2) {
  const sr = ctx.sampleRate;
  const length = Math.max(1, Math.floor(sr * seconds));
  const buffer = ctx.createBuffer(channels, length, sr);
  for (let ch = 0; ch < channels; ch++) {
    const data = buffer.getChannelData(ch);
    fillNoise(data, color);
  }
  return buffer;
}

export function fillNoise(data, color) {
  const n = data.length;
  if (color === 'white') {
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
    return data;
  }
  if (color === 'brown') {
    let last = 0;
    for (let i = 0; i < n; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
    return data;
  }
  // pink
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < n; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
  }
  return data;
}

/**
 * A one-cycle control buffer of a raised-cosine pulse train, looped at
 * exactly `beat` Hz (the loop length is rounded to whole samples, so the
 * realised frequency is sampleRate / round(sampleRate / beat)).
 * `duty` is the fraction of the cycle spent "on".
 */
export function createPulseBuffer(ctx, beat = 10, duty = 0.5) {
  const sr = ctx.sampleRate;
  const rate = Number.isFinite(beat) ? beat : 10;
  const length = Math.max(2, Math.round(sr / Math.max(0.1, rate)));
  const buffer = ctx.createBuffer(1, length, sr);
  const data = buffer.getChannelData(0);
  fillPulse(data, duty);
  return buffer;
}

export function fillPulse(data, duty = 0.5) {
  const n = data.length;
  const d = Number.isFinite(duty) ? duty : 0.5;
  const on = Math.max(1, Math.floor(n * Math.min(0.95, Math.max(0.05, d))));
  for (let i = 0; i < n; i++) {
    if (i < on) {
      // raised cosine window over the "on" part: no clicks at the edges
      data[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / on);
    } else {
      data[i] = 0;
    }
  }
  return data;
}

/**
 * One breathing cycle as a control signal (0..1): a smooth inhale rise, an
 * optional hold, and an exhale fall. `inhale` is the inhale fraction.
 */
export function createBreathBuffer(ctx, bpm = 6, inhale = 0.45, hold = 0) {
  const sr = ctx.sampleRate;
  const rate = Number.isFinite(bpm) ? bpm : 6;
  const period = 60 / Math.max(1, rate);
  const length = Math.max(2, Math.round(sr * period));
  const buffer = ctx.createBuffer(1, length, sr);
  fillBreath(buffer.getChannelData(0), inhale, hold);
  return buffer;
}

export function fillBreath(data, inhale = 0.45, hold = 0) {
  const n = data.length;
  const inFrac = Number.isFinite(inhale) ? Math.min(0.9, Math.max(0.05, inhale)) : 0.45;
  const holdFrac = Number.isFinite(hold) ? Math.min(0.5, Math.max(0, hold)) : 0;
  const inN = Math.max(1, Math.floor(n * inFrac));
  const holdN = Math.floor(n * holdFrac);
  const outN = Math.max(1, n - inN - holdN);
  for (let i = 0; i < n; i++) {
    let v;
    if (i < inN) v = 0.5 - 0.5 * Math.cos(Math.PI * (i / inN));
    else if (i < inN + holdN) v = 1;
    else v = 0.5 + 0.5 * Math.cos(Math.PI * ((i - inN - holdN) / outN));
    data[i] = v;
  }
  return data;
}

/**
 * Synthetic impulse response for the reverb bus: exponentially decaying
 * stereo noise with a short pre-delay and a gentle high-frequency roll-off.
 */
export function createImpulseResponse(ctx, seconds = 2.8, decay = 3.2) {
  const sr = ctx.sampleRate;
  const length = Math.max(1, Math.floor(sr * seconds));
  const buffer = ctx.createBuffer(2, length, sr);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < length; i++) {
      const t = i / length;
      const env = Math.pow(1 - t, decay);
      const white = Math.random() * 2 - 1;
      lp = lp + 0.35 * (white - lp); // simple one-pole low-pass, darker tail
      data[i] = lp * env * (i < sr * 0.012 ? 0 : 1);
    }
  }
  return buffer;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function now(ctx) { return ctx.currentTime || 0; }

function setParamSmooth(param, value, ctx, tc = 0.03) {
  if (!param) return;
  if (param.setTargetAtTime) param.setTargetAtTime(value, now(ctx), tc);
  else param.value = value;
}

function osc(ctx, type, freq) {
  const o = ctx.createOscillator();
  o.type = type;
  if (o.frequency.setValueAtTime) o.frequency.setValueAtTime(freq, now(ctx));
  else o.frequency.value = freq;
  return o;
}

function gain(ctx, value) {
  const g = ctx.createGain();
  if (g.gain.setValueAtTime) g.gain.setValueAtTime(value, now(ctx));
  else g.gain.value = value;
  return g;
}

function safeStop(node) {
  if (!node) return;
  try { node.stop(); } catch (e) { /* already stopped */ }
  try { node.disconnect(); } catch (e) { /* not connected */ }
}

/**
 * Fade-in wrapper so oscillators never start with a click.
 */
function startWithFade(ctx, output, targetGain, seconds = 0.4) {
  const g = output.gain;
  if (g && g.setValueAtTime && g.linearRampToValueAtTime) {
    g.setValueAtTime(0.0001, now(ctx));
    g.linearRampToValueAtTime(targetGain, now(ctx) + seconds);
  }
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

/** Binaural beat: carrier in the left ear, carrier + beat in the right. */
function buildBinaural(ctx, p) {
  const merger = ctx.createChannelMerger(2);
  const output = gain(ctx, 1);
  const left = osc(ctx, p.wave || 'sine', p.carrier);
  const right = osc(ctx, p.wave || 'sine', p.carrier + p.beat);
  const lg = gain(ctx, 0.5);
  const rg = gain(ctx, 0.5);
  left.connect(lg); lg.connect(merger, 0, 0);
  right.connect(rg); rg.connect(merger, 0, 1);

  // Optional pink noise bed: it makes long sessions less fatiguing and gives
  // the beat something to sit in.
  let bed = null;
  let bedGain = gain(ctx, p.bed || 0);
  if (ctx.createBufferSource) {
    bed = ctx.createBufferSource();
    bed.buffer = createNoiseBuffer(ctx, 'pink', 4, 2);
    bed.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    if (lp.frequency.setValueAtTime) lp.frequency.setValueAtTime(900, now(ctx)); else lp.frequency.value = 900;
    bed.connect(lp); lp.connect(bedGain); bedGain.connect(output);
    bed.start(0);
  }
  merger.connect(output);
  left.start(0); right.start(0);
  startWithFade(ctx, output, 1);

  return {
    output, params: { ...p }, channels: 2,
    meta: { headLocked: true },
    setParam(key, value) {
      this.params[key] = value;
      if (key === 'carrier' || key === 'beat') {
        setParamSmooth(left.frequency, this.params.carrier, ctx);
        setParamSmooth(right.frequency, this.params.carrier + this.params.beat, ctx);
      } else if (key === 'bed') {
        setParamSmooth(bedGain.gain, value, ctx);
      } else if (key === 'wave') {
        left.type = value; right.type = value;
      }
    },
    stop() { safeStop(left); safeStop(right); safeStop(bed); try { output.disconnect(); } catch (e) {} },
  };
}

/** Monaural beat: both tones summed before the ear, works on speakers. */
function buildMonaural(ctx, p) {
  const output = gain(ctx, 1);
  const a = osc(ctx, 'sine', p.carrier);
  const b = osc(ctx, 'sine', p.carrier + p.beat);
  const ga = gain(ctx, 0.45), gb = gain(ctx, 0.45);
  a.connect(ga); ga.connect(output);
  b.connect(gb); gb.connect(output);
  a.start(0); b.start(0);
  startWithFade(ctx, output, 1);
  return {
    output, params: { ...p }, channels: 1, meta: {},
    setParam(key, value) {
      this.params[key] = value;
      setParamSmooth(a.frequency, this.params.carrier, ctx);
      setParamSmooth(b.frequency, this.params.carrier + this.params.beat, ctx);
    },
    stop() { safeStop(a); safeStop(b); try { output.disconnect(); } catch (e) {} },
  };
}

/** Isochronic tone: one tone gated on and off at `beat` Hz. */
function buildIsochronic(ctx, p) {
  const output = gain(ctx, 1);
  const tone = osc(ctx, p.wave || 'sine', p.freq);
  const gate = gain(ctx, 0);            // driven by the pulse buffer
  let pulse = null;
  const makePulse = () => {
    safeStop(pulse);
    if (!ctx.createBufferSource) return;
    pulse = ctx.createBufferSource();
    pulse.buffer = createPulseBuffer(ctx, p.beat, p.duty);
    pulse.loop = true;
    pulse.connect(gate.gain);
    pulse.start(0);
  };
  tone.connect(gate); gate.connect(output);
  tone.start(0);
  makePulse();
  startWithFade(ctx, output, 0.8);
  return {
    output, params: { ...p }, channels: 1, meta: {},
    setParam(key, value) {
      this.params[key] = value;
      if (key === 'freq') setParamSmooth(tone.frequency, value, ctx);
      else if (key === 'beat' || key === 'duty') { p.beat = this.params.beat; p.duty = this.params.duty; makePulse(); }
      else if (key === 'wave') tone.type = value;
    },
    stop() { safeStop(tone); safeStop(pulse); try { output.disconnect(); } catch (e) {} },
  };
}

/** Pure tone with a touch of harmonics and optional slow vibrato. */
function buildTone(ctx, p) {
  const output = gain(ctx, 1);
  const f = osc(ctx, 'sine', p.freq);
  const h2 = osc(ctx, 'sine', p.freq * 2);
  const h3 = osc(ctx, 'sine', p.freq * 3);
  const g1 = gain(ctx, 0.6);
  const g2 = gain(ctx, 0.6 * (p.harmonics || 0) * 0.5);
  const g3 = gain(ctx, 0.6 * (p.harmonics || 0) * 0.25);
  f.connect(g1); h2.connect(g2); h3.connect(g3);
  g1.connect(output); g2.connect(output); g3.connect(output);
  // vibrato LFO
  const lfo = osc(ctx, 'sine', 5.2);
  const lfoGain = gain(ctx, (p.vibrato || 0) * 2.5);
  lfo.connect(lfoGain); lfoGain.connect(f.frequency);
  f.start(0); h2.start(0); h3.start(0); lfo.start(0);
  startWithFade(ctx, output, 0.6);
  return {
    output, params: { ...p }, channels: 1, meta: {},
    setParam(key, value) {
      this.params[key] = value;
      if (key === 'freq') {
        setParamSmooth(f.frequency, value, ctx);
        setParamSmooth(h2.frequency, value * 2, ctx);
        setParamSmooth(h3.frequency, value * 3, ctx);
      } else if (key === 'harmonics') {
        setParamSmooth(g2.gain, 0.6 * value * 0.5, ctx);
        setParamSmooth(g3.gain, 0.6 * value * 0.25, ctx);
      } else if (key === 'vibrato') {
        setParamSmooth(lfoGain.gain, value * 2.5, ctx);
      }
    },
    stop() { [f, h2, h3, lfo].forEach(safeStop); try { output.disconnect(); } catch (e) {} },
  };
}

/** Schumann-style: a low tone amplitude-modulated at 7.83 Hz. */
function buildSchumann(ctx, p) {
  const output = gain(ctx, 1);
  const tone = osc(ctx, 'sine', p.carrier);
  const sub = osc(ctx, 'triangle', p.carrier / 2);
  const subGain = gain(ctx, 0.3);
  const mod = gain(ctx, 1 - (p.depth || 0) / 2);
  const lfo = osc(ctx, 'sine', p.beat);
  const lfoGain = gain(ctx, (p.depth || 0) / 2);
  lfo.connect(lfoGain); lfoGain.connect(mod.gain);
  tone.connect(mod); sub.connect(subGain); subGain.connect(mod); mod.connect(output);
  tone.start(0); sub.start(0); lfo.start(0);
  startWithFade(ctx, output, 0.8);
  return {
    output, params: { ...p }, channels: 1, meta: {},
    setParam(key, value) {
      this.params[key] = value;
      if (key === 'carrier') { setParamSmooth(tone.frequency, value, ctx); setParamSmooth(sub.frequency, value / 2, ctx); }
      else if (key === 'beat') setParamSmooth(lfo.frequency, value, ctx);
      else if (key === 'depth') { setParamSmooth(mod.gain, 1 - value / 2, ctx); setParamSmooth(lfoGain.gain, value / 2, ctx); }
    },
    stop() { [tone, sub, lfo].forEach(safeStop); try { output.disconnect(); } catch (e) {} },
  };
}

/** Coloured noise through a low-pass. */
function buildNoise(ctx, p) {
  const output = gain(ctx, 1);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  if (lp.frequency.setValueAtTime) lp.frequency.setValueAtTime(p.cutoff || 12000, now(ctx)); else lp.frequency.value = p.cutoff || 12000;
  let src = null;
  const makeSource = () => {
    safeStop(src);
    if (!ctx.createBufferSource) return;
    src = ctx.createBufferSource();
    src.buffer = createNoiseBuffer(ctx, p.color, 6, 2);
    src.loop = true;
    src.connect(lp);
    src.start(0);
  };
  lp.connect(output);
  makeSource();
  startWithFade(ctx, output, 0.6);
  return {
    output, params: { ...p }, channels: 2, meta: {},
    setParam(key, value) {
      this.params[key] = value;
      if (key === 'color') { p.color = value; makeSource(); }
      else if (key === 'cutoff') setParamSmooth(lp.frequency, value, ctx);
    },
    stop() { safeStop(src); try { output.disconnect(); } catch (e) {} },
  };
}

/** Breathing pacer: filtered noise swell plus a soft tone following the breath. */
function buildBreath(ctx, p) {
  const output = gain(ctx, 1);
  const env = gain(ctx, 0);             // driven by the breath buffer (0..1)
  const noise = ctx.createBufferSource ? ctx.createBufferSource() : null;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  if (lp.frequency.setValueAtTime) lp.frequency.setValueAtTime(1400, now(ctx)); else lp.frequency.value = 1400;
  const noiseGain = gain(ctx, 0.55);
  if (noise) {
    noise.buffer = createNoiseBuffer(ctx, 'pink', 5, 2);
    noise.loop = true;
    noise.connect(lp); lp.connect(noiseGain); noiseGain.connect(env);
    noise.start(0);
  }
  const tone = osc(ctx, 'sine', 196);   // G3, unobtrusive
  const toneGain = gain(ctx, (p.tone || 0) * 0.25);
  tone.connect(toneGain); toneGain.connect(env);
  tone.start(0);
  env.connect(output);

  let ctrl = null;
  const period = () => 60 / Math.max(1, p.bpm);
  const makeCtrl = () => {
    safeStop(ctrl);
    if (!ctx.createBufferSource) return;
    ctrl = ctx.createBufferSource();
    ctrl.buffer = createBreathBuffer(ctx, p.bpm, p.inhale, p.hold || 0);
    ctrl.loop = true;
    ctrl.connect(env.gain);
    handle.startTime = now(ctx);
    ctrl.start(0);
  };
  const handle = {
    output, params: { ...p }, channels: 2,
    meta: { breath: true },
    startTime: now(ctx),
    /** 0..1 phase within the current breath cycle, for the UI orb. */
    phase() { return ((now(ctx) - this.startTime) % period()) / period(); },
    period,
    setParam(key, value) {
      this.params[key] = value;
      p[key] = value;
      if (key === 'bpm' || key === 'inhale' || key === 'hold') makeCtrl();
      else if (key === 'tone') setParamSmooth(toneGain.gain, value * 0.25, ctx);
    },
    stop() { safeStop(noise); safeStop(tone); safeStop(ctrl); try { output.disconnect(); } catch (e) {} },
  };
  makeCtrl();
  startWithFade(ctx, output, 1);
  return handle;
}

const CHORDS = {
  sus2: [0, 2, 7, 12, 14],
  maj7: [0, 4, 7, 11, 14],
  min9: [0, 3, 7, 10, 14],
  fifth: [0, 7, 12, 19],
  lydian: [0, 6, 7, 11, 16],
};

/** Evolving pad: detuned saw/triangle voices through a slowly moving filter. */
function buildPad(ctx, p) {
  const output = gain(ctx, 1);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 0.9;
  const base = () => 300 + (p.brightness || 0) * 2400;
  if (filter.frequency.setValueAtTime) filter.frequency.setValueAtTime(base(), now(ctx)); else filter.frequency.value = base();
  const voices = [];
  const intervals = CHORDS[p.chord] || CHORDS.sus2;
  intervals.forEach((semi, i) => {
    const freq = p.root * Math.pow(2, semi / 12);
    for (const sign of [-1, 1]) {
      const o = osc(ctx, i % 2 ? 'triangle' : 'sawtooth', freq);
      if (o.detune && o.detune.setValueAtTime) o.detune.setValueAtTime(sign * (p.detune || 6), now(ctx));
      const g = gain(ctx, 0.08);
      // per-voice slow amplitude LFO for movement
      const lfo = osc(ctx, 'sine', 0.05 + Math.random() * 0.08);
      const lfoG = gain(ctx, 0.04 * (p.movement || 0));
      lfo.connect(lfoG); lfoG.connect(g.gain);
      o.connect(g); g.connect(filter);
      o.start(0); lfo.start(0);
      voices.push({ o, g, lfo, lfoG, semi });
    }
  });
  // filter sweep LFO
  const fl = osc(ctx, 'sine', 0.03);
  const flG = gain(ctx, 400 * (p.movement || 0));
  fl.connect(flG); flG.connect(filter.frequency); fl.start(0);
  filter.connect(output);
  startWithFade(ctx, output, 2.5);
  return {
    output, params: { ...p }, channels: 1, meta: {},
    setParam(key, value) {
      this.params[key] = value; p[key] = value;
      if (key === 'root') voices.forEach(v => setParamSmooth(v.o.frequency, p.root * Math.pow(2, v.semi / 12), ctx, 0.2));
      else if (key === 'brightness') setParamSmooth(filter.frequency, base(), ctx, 0.2);
      else if (key === 'movement') { setParamSmooth(flG.gain, 400 * value, ctx); voices.forEach(v => setParamSmooth(v.lfoG.gain, 0.04 * value, ctx)); }
      else if (key === 'detune') voices.forEach((v, i) => { if (v.o.detune) setParamSmooth(v.o.detune, (i % 2 ? 1 : -1) * value, ctx); });
      else if (key === 'chord') {
        // Retune the existing voices to the new chord rather than rebuilding
        // the graph, so the pad keeps sounding through the change.
        const intervals = CHORDS[value] || CHORDS.sus2;
        voices.forEach((v, i) => {
          v.semi = intervals[Math.floor(i / 2) % intervals.length];
          setParamSmooth(v.o.frequency, p.root * Math.pow(2, v.semi / 12), ctx, 0.35);
        });
      }
    },
    stop() { voices.forEach(v => { safeStop(v.o); safeStop(v.lfo); }); safeStop(fl); try { output.disconnect(); } catch (e) {} },
  };
}

/** Deep drone: sub sine plus octave and fifth, slowly breathing. */
function buildDrone(ctx, p) {
  const output = gain(ctx, 1);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  if (lp.frequency.setValueAtTime) lp.frequency.setValueAtTime(600, now(ctx)); else lp.frequency.value = 600;
  const parts = [
    { o: osc(ctx, 'sine', p.freq), g: gain(ctx, 0.5), ratio: 1 },
    { o: osc(ctx, 'triangle', p.freq * 2), g: gain(ctx, 0.18 * (p.richness || 0.5)), ratio: 2 },
    { o: osc(ctx, 'sine', p.freq * 3), g: gain(ctx, 0.12 * (p.richness || 0.5)), ratio: 3 },
    { o: osc(ctx, 'sawtooth', p.freq * 1.003), g: gain(ctx, 0.05 * (p.richness || 0.5)), ratio: 1.003 },
  ];
  parts.forEach(pt => { pt.o.connect(pt.g); pt.g.connect(lp); pt.o.start(0); });
  const lfo = osc(ctx, 'sine', 0.06);
  const lfoG = gain(ctx, 0.15 * (p.movement || 0));
  lfo.connect(lfoG); lfoG.connect(output.gain); lfo.start(0);
  lp.connect(output);
  startWithFade(ctx, output, 2);
  return {
    output, params: { ...p }, channels: 1, meta: {},
    setParam(key, value) {
      this.params[key] = value; p[key] = value;
      if (key === 'freq') parts.forEach(pt => setParamSmooth(pt.o.frequency, value * pt.ratio, ctx, 0.2));
      else if (key === 'richness') { setParamSmooth(parts[1].g.gain, 0.18 * value, ctx); setParamSmooth(parts[2].g.gain, 0.12 * value, ctx); setParamSmooth(parts[3].g.gain, 0.05 * value, ctx); }
      else if (key === 'movement') setParamSmooth(lfoG.gain, 0.15 * value, ctx);
    },
    stop() { parts.forEach(pt => safeStop(pt.o)); safeStop(lfo); try { output.disconnect(); } catch (e) {} },
  };
}

const PENTATONIC = [0, 2, 4, 7, 9, 12, 14, 16];

/** Shimmer: sparse random bell notes from a pentatonic set. */
function buildShimmer(ctx, p) {
  const output = gain(ctx, 1);
  let timer = null;
  let running = true;
  const strike = () => {
    if (!running) return;
    const semi = PENTATONIC[Math.floor(Math.random() * PENTATONIC.length)];
    const f = p.root * Math.pow(2, semi / 12);
    const o = osc(ctx, 'sine', f);
    const h = osc(ctx, 'sine', f * 2.76);
    const g = gain(ctx, 0.0001);
    const hg = gain(ctx, 0.25);
    const t0 = now(ctx);
    o.connect(g); h.connect(hg); hg.connect(g); g.connect(output);
    if (g.gain.exponentialRampToValueAtTime) {
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + (p.decay || 4));
    }
    o.start(t0); h.start(t0);
    const dur = (p.decay || 4) + 0.1;
    try { o.stop(t0 + dur); h.stop(t0 + dur); } catch (e) {}
    schedule();
  };
  const schedule = () => {
    const density = Math.max(0.02, Math.min(1, p.density || 0.3));
    const wait = (0.6 + Math.random() * 6) / density;
    timer = setTimeout(strike, wait * 1000);
  };
  startWithFade(ctx, output, 0.5);
  schedule();
  return {
    output, params: { ...p }, channels: 1, meta: {},
    setParam(key, value) { this.params[key] = value; p[key] = value; },
    stop() { running = false; clearTimeout(timer); try { output.disconnect(); } catch (e) {} },
  };
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/**
 * Parameter descriptors drive the inspector UI. `unit` is shown after the
 * value, `step` keeps sliders sane.
 */
export const GENERATORS = {
  binaural: {
    build: buildBinaural, headLocked: true,
    defaults: { carrier: 200, beat: 10, bed: 0.25, wave: 'sine' },
    controls: [
      { key: 'beat', label: 'Beat', min: 0.5, max: 45, step: 0.1, unit: 'Hz' },
      { key: 'carrier', label: 'Carrier', min: 90, max: 500, step: 1, unit: 'Hz' },
      { key: 'bed', label: 'Noise bed', min: 0, max: 0.8, step: 0.01, unit: '' },
    ],
  },
  monaural: {
    build: buildMonaural,
    defaults: { carrier: 200, beat: 10 },
    controls: [
      { key: 'beat', label: 'Beat', min: 0.5, max: 45, step: 0.1, unit: 'Hz' },
      { key: 'carrier', label: 'Carrier', min: 90, max: 500, step: 1, unit: 'Hz' },
    ],
  },
  isochronic: {
    build: buildIsochronic,
    defaults: { freq: 220, beat: 10, duty: 0.5, wave: 'sine' },
    controls: [
      { key: 'beat', label: 'Pulse rate', min: 0.5, max: 45, step: 0.1, unit: 'Hz' },
      { key: 'freq', label: 'Tone', min: 60, max: 800, step: 1, unit: 'Hz' },
      { key: 'duty', label: 'Duty', min: 0.1, max: 0.9, step: 0.01, unit: '' },
    ],
  },
  tone: {
    build: buildTone,
    defaults: { freq: 432, harmonics: 0.15, vibrato: 0 },
    controls: [
      { key: 'freq', label: 'Frequency', min: 40, max: 2000, step: 0.1, unit: 'Hz' },
      { key: 'harmonics', label: 'Harmonics', min: 0, max: 1, step: 0.01, unit: '' },
      { key: 'vibrato', label: 'Vibrato', min: 0, max: 1, step: 0.01, unit: '' },
    ],
  },
  schumann: {
    build: buildSchumann,
    defaults: { carrier: 136.1, beat: 7.83, depth: 0.8 },
    controls: [
      { key: 'beat', label: 'Pulse', min: 1, max: 20, step: 0.01, unit: 'Hz' },
      { key: 'carrier', label: 'Tone', min: 40, max: 400, step: 0.1, unit: 'Hz' },
      { key: 'depth', label: 'Depth', min: 0, max: 1, step: 0.01, unit: '' },
    ],
  },
  noise: {
    build: buildNoise,
    defaults: { color: 'pink', cutoff: 12000 },
    controls: [
      { key: 'color', label: 'Color', options: ['white', 'pink', 'brown'] },
      { key: 'cutoff', label: 'Low-pass', min: 200, max: 16000, step: 10, unit: 'Hz', log: true },
    ],
  },
  breath: {
    build: buildBreath,
    defaults: { bpm: 6, inhale: 0.45, hold: 0, tone: 0.5 },
    controls: [
      { key: 'bpm', label: 'Breaths / min', min: 3, max: 10, step: 0.5, unit: '' },
      { key: 'inhale', label: 'Inhale share', min: 0.3, max: 0.6, step: 0.01, unit: '' },
      { key: 'hold', label: 'Hold share', min: 0, max: 0.3, step: 0.01, unit: '' },
      { key: 'tone', label: 'Tone', min: 0, max: 1, step: 0.01, unit: '' },
    ],
  },
  pad: {
    build: buildPad,
    defaults: { root: 110, chord: 'sus2', brightness: 0.4, movement: 0.4, detune: 7 },
    controls: [
      { key: 'root', label: 'Root', min: 55, max: 330, step: 1, unit: 'Hz' },
      { key: 'chord', label: 'Chord', options: Object.keys(CHORDS) },
      { key: 'brightness', label: 'Brightness', min: 0, max: 1, step: 0.01, unit: '' },
      { key: 'movement', label: 'Movement', min: 0, max: 1, step: 0.01, unit: '' },
      { key: 'detune', label: 'Detune', min: 0, max: 20, step: 0.5, unit: 'ct' },
    ],
  },
  drone: {
    build: buildDrone,
    defaults: { freq: 55, richness: 0.5, movement: 0.3 },
    controls: [
      { key: 'freq', label: 'Frequency', min: 30, max: 220, step: 0.5, unit: 'Hz' },
      { key: 'richness', label: 'Richness', min: 0, max: 1, step: 0.01, unit: '' },
      { key: 'movement', label: 'Movement', min: 0, max: 1, step: 0.01, unit: '' },
    ],
  },
  shimmer: {
    build: buildShimmer,
    defaults: { root: 880, density: 0.35, decay: 5 },
    controls: [
      { key: 'root', label: 'Root', min: 220, max: 1760, step: 1, unit: 'Hz' },
      { key: 'density', label: 'Density', min: 0.05, max: 1, step: 0.01, unit: '' },
      { key: 'decay', label: 'Decay', min: 1, max: 12, step: 0.1, unit: 's' },
    ],
  },
};

export const CHORD_NAMES = Object.keys(CHORDS);

/**
 * Build a generator by name with defaults merged under the given params.
 * @returns {{output: AudioNode, stop: Function, setParam: Function, params: Object, meta: Object}|null}
 */
export function buildGenerator(ctx, name, params = {}) {
  const def = GENERATORS[name];
  if (!def) return null;
  const merged = { ...def.defaults, ...params };
  const handle = def.build(ctx, merged);
  handle.name = name;
  handle.meta = { ...(handle.meta || {}), headLocked: !!def.headLocked };
  return handle;
}

/** Clamp a param to its control range (if declared). */
export function clampParam(genName, key, value) {
  const def = GENERATORS[genName];
  const ctl = def && def.controls.find(c => c.key === key);
  if (!ctl || ctl.options) return value;
  // Math.min/max pass NaN straight through, and a NaN beat rate reaches
  // createBuffer as a NaN length, which throws and leaves the tone gated shut.
  const n = Number(value);
  if (!Number.isFinite(n)) return def.defaults[key];
  return Math.min(ctl.max, Math.max(ctl.min, n));
}
