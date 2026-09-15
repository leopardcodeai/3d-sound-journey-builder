/** Chakra tones as they are conventionally given, in hertz. */
export const CHAKRA_BOWLS = [
  { type: 'bowl_c', freq: 256 },
  { type: 'bowl_d', freq: 288 },
  { type: 'bowl_e', freq: 320 },
  { type: 'bowl_f', freq: 341 },
  { type: 'bowl_g', freq: 384 },
  { type: 'bowl_a', freq: 426 },
  { type: 'bowl_b', freq: 480 },
];

/**
 * InstrumentSynth - Synthesized musical instrument tones
 * Uses oscillators, envelopes, and effects to create various instrument sounds.
 */
export class InstrumentSynth {
  constructor(audioEngine) {
    this.audioEngine = audioEngine;

    this.instruments = {
      'piano': { name: 'Klavier', emoji: '🎹', desc: 'Weicher Piano-Ton' },
      'synth-pad': { name: 'Synth Pad', emoji: '🎛️', desc: 'Ambient Synthesizer' },
      'bass': { name: 'Bass', emoji: '🎸', desc: 'Tiefer Bass-Ton' },
      'strings': { name: 'Streicher', emoji: '🎻', desc: 'Streichorchester' },
      'flute': { name: 'Flöte', emoji: '🪈', desc: 'Sanfte Flöte' },
      'bell-synth': { name: 'Glocken', emoji: '🔔', desc: 'Synthetische Glocken' },
      'drone': { name: 'Drone', emoji: '🕉️', desc: 'Meditativer Grundton' },
      'arpeggio': { name: 'Arpeggio', emoji: '✨', desc: 'Aufsteigende Tonfolge' },
    };

    this.notes = {
      'C3': 130.81, 'D3': 146.83, 'E3': 164.81, 'F3': 174.61, 'G3': 196.00, 'A3': 220.00, 'B3': 246.94,
      'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.00, 'A4': 440.00, 'B4': 493.88,
      'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'F5': 698.46, 'G5': 783.99, 'A5': 880.00, 'B5': 987.77,
    };
  }

  generateBuffer(instrumentType, note = 'C4', duration = 4) {
    const ctx = this.audioEngine.ctx;
    if (!ctx) return null;

    const sampleRate = ctx.sampleRate;
    const length = sampleRate * duration;
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    const freq = this.notes[note] || 261.63;

    switch (instrumentType) {
      case 'piano':
        this._generatePiano(data, freq, sampleRate);
        break;
      case 'synth-pad':
        this._generateSynthPad(data, freq, sampleRate);
        break;
      case 'bass':
        this._generateBass(data, freq / 2, sampleRate);
        break;
      case 'strings':
        this._generateStrings(data, freq, sampleRate);
        break;
      case 'flute':
        this._generateFlute(data, freq, sampleRate);
        break;
      case 'bell-synth':
        this._generateBell(data, freq, sampleRate);
        break;
      case 'drone':
        this._generateDrone(data, freq, sampleRate);
        break;
      case 'arpeggio':
        this._generateArpeggio(data, freq, sampleRate);
        break;
      case 'bowl':
        this._generateBowl(data, freq, sampleRate);
        break;
      default:
        this._generatePiano(data, freq, sampleRate);
    }

    return buffer;
  }

  _generatePiano(data, freq, sr) {
    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const env = Math.exp(-t * 2.5);
      const fundamental = Math.sin(2 * Math.PI * freq * t);
      const h2 = 0.5 * Math.sin(2 * Math.PI * freq * 2 * t);
      const h3 = 0.25 * Math.sin(2 * Math.PI * freq * 3 * t);
      const h4 = 0.125 * Math.sin(2 * Math.PI * freq * 4 * t);
      data[i] = (fundamental + h2 + h3 + h4) * env * 0.6;
    }
  }

  _generateSynthPad(data, freq, sr) {
    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const env = Math.min(1, t * 2) * Math.exp(-t * 0.3);
      const detune = 1 + 0.002 * Math.sin(2 * Math.PI * 0.5 * t);
      const saw = 2 * ((t * freq * detune) % 1) - 1;
      const filter = Math.sin(2 * Math.PI * freq * 0.5 * t) * 0.3 + 0.7;
      data[i] = saw * filter * env * 0.3;
    }
  }

  _generateBass(data, freq, sr) {
    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const env = Math.min(1, t * 10) * Math.exp(-t * 0.8);
      const sub = Math.sin(2 * Math.PI * freq * t);
      const click = (i < sr * 0.02) ? (1 - i / (sr * 0.02)) * 0.5 : 0;
      data[i] = (sub + click) * env * 0.7;
    }
  }

  _generateStrings(data, freq, sr) {
    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const env = Math.min(1, t * 0.5) * Math.exp(-t * 1.2);
      const vibrato = 1 + 0.005 * Math.sin(2 * Math.PI * 5.5 * t);
      const tone = Math.sin(2 * Math.PI * freq * vibrato * t);
      const h2 = 0.3 * Math.sin(2 * Math.PI * freq * 2 * t);
      const h3 = 0.15 * Math.sin(2 * Math.PI * freq * 3 * t);
      data[i] = (tone + h2 + h3) * env * 0.5;
    }
  }

  _generateFlute(data, freq, sr) {
    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const env = Math.min(1, t * 3) * Math.exp(-t * 0.6);
      const tone = Math.sin(2 * Math.PI * freq * t);
      const h2 = 0.6 * Math.sin(2 * Math.PI * freq * 2 * t);
      const noise = (Math.random() - 0.5) * 0.03 * env;
      data[i] = (tone + h2 + noise) * env * 0.4;
    }
  }

  _generateBell(data, freq, sr) {
    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const env = Math.exp(-t * 0.8);
      const f1 = Math.sin(2 * Math.PI * freq * t);
      const f2 = 0.5 * Math.sin(2 * Math.PI * freq * 2.76 * t);
      const f3 = 0.3 * Math.sin(2 * Math.PI * freq * 5.4 * t);
      data[i] = (f1 + f2 + f3) * env * 0.5;
    }
  }

  _generateDrone(data, freq, sr) {
    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const env = Math.min(1, t * 3);
      const f1 = Math.sin(2 * Math.PI * freq * t);
      const f2 = 0.4 * Math.sin(2 * Math.PI * freq * 1.5 * t);
      const f3 = 0.2 * Math.sin(2 * Math.PI * freq * 2.01 * t);
      const f4 = 0.15 * Math.sin(2 * Math.PI * freq * 3.03 * t);
      data[i] = (f1 + f2 + f3 + f4) * env * 0.3;
    }
  }

  _generateArpeggio(data, freq, sr) {
    const notes = [1, 1.25, 1.5, 1.75, 2, 1.5, 1.25, 1];
    const noteLen = Math.floor(data.length / 32);
    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const noteIdx = Math.floor(i / noteLen) % notes.length;
      const nf = freq * notes[noteIdx];
      const env = Math.exp(-((i % noteLen) / sr) * 8);
      const tone = Math.sin(2 * Math.PI * nf * t);
      data[i] = tone * env * 0.3;
    }
  }

  /**
   * A struck singing bowl: metallic strike, a rich inharmonic partial series,
   * a long decay, and the slow beating a real bowl has because its two
   * bending modes are never quite equal.
   *
   * The phase is accumulated per sample rather than computed as sin(2*pi*f*t).
   * With a time-varying f those are not the same thing: the second form gives
   * an instantaneous frequency of f(t) + t*f'(t), so the slow wobble dragged
   * the pitch roughly two percent flat and further off the longer the sound
   * ran. Accumulating phase makes the written frequency the heard frequency,
   * which is the whole point of generating these rather than pitch-shifting.
   */
  _generateBowl(data, freq, sr, options = {}) {
    const strikeLevel = options.strike !== undefined ? options.strike : 0.25;
    const decayRate = options.decay !== undefined ? options.decay : 0.4;
    const tau = 2 * Math.PI;

    // Ratios of a struck bowl: close to harmonic but deliberately detuned.
    const partials = [
      { r: 1.00, a: 1.00 },
      { r: 2.01, a: 0.65 },
      { r: 3.02, a: 0.40 },
      { r: 4.55, a: 0.25 },
      { r: 5.80, a: 0.15 },
      { r: 8.10, a: 0.08 },
    ];
    const phases = new Float64Array(partials.length);
    // The beating pair: a second voice a fraction of a hertz away.
    let beatPhase = 0;
    const beatStep = (tau * (freq + 0.7)) / sr;

    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const attack = Math.exp(-t * 80) * strikeLevel;
      const strikeNoise = (Math.random() * 2 - 1) * attack;
      const env = Math.exp(-t * decayRate) * 0.7 + 0.05;

      // Wobble as a true frequency deviation, applied to the phase increment.
      const wobble = 1 + 0.0015 * Math.sin(tau * 0.8 * t) + 0.001 * Math.sin(tau * 1.3 * t);

      let sum = 0;
      for (let k = 0; k < partials.length; k++) {
        const p = partials[k];
        phases[k] += (tau * freq * p.r * wobble) / sr;
        sum += p.a * Math.sin(phases[k]);
      }
      beatPhase += beatStep;
      sum += 0.3 * Math.sin(beatPhase);

      data[i] = sum * 0.3 * env + strikeNoise;
    }
    this._fadeOut(data, sr, 1);
  }

  /** Render every instrument tone once and hand it to the engine. */
  preloadAll(note = 'C4') {
    for (const type of Object.keys(this.instruments)) {
      const buffer = this.generateBuffer(type, note);
      if (buffer) this.audioEngine.addAudioBuffer('instr_' + type, buffer);
    }
  }

  /**
   * The sounds under "Sound healing" that are generated rather than recorded.
   * Registered under their own names, so the library treats them like any
   * other preloaded buffer.
   */
  preloadHealing() {
    this.preloadChakraBowls();
    this.audioEngine.addAudioBuffer('bell', this._renderBowl(528, 7, { strike: 0.4, decay: 0.75 }));
    this.audioEngine.addAudioBuffer('gong_old', this._renderGong(78, 13));
  }

  /**
   * The seven chakra bowls, synthesised at their exact frequencies.
   *
   * These used to be pitch-shifted copies of a recorded bowl, which made the
   * realised pitch depend on that recording and left seven audio files in the
   * repository with no licence on record.
   */
  preloadChakraBowls() {
    for (const { type, freq } of CHAKRA_BOWLS) {
      this.audioEngine.addAudioBuffer(type, this._renderBowl(freq, 11));
    }
  }

  _renderBowl(freq, seconds, options = {}) {
    const ctx = this.audioEngine.ctx;
    const sr = ctx.sampleRate;
    const buf = ctx.createBuffer(1, Math.floor(sr * seconds), sr);
    this._generateBowl(buf.getChannelData(0), freq, sr, options);
    return buf;
  }

  _renderGong(freq, seconds) {
    const ctx = this.audioEngine.ctx;
    const sr = ctx.sampleRate;
    const buf = ctx.createBuffer(1, Math.floor(sr * seconds), sr);
    this._generateGong(buf.getChannelData(0), freq, sr);
    return buf;
  }

  /**
   * A gong is not a bowl with a lower note. Two things set it apart, and both
   * are modelled here:
   *
   *  - the partials are strongly inharmonic and each decays at its own rate,
   *    so the timbre keeps changing while the note rings;
   *  - energy travels from the fundamental up into the high partials over the
   *    first seconds, the "bloom" that makes a gong swell after the strike.
   */
  _generateGong(data, freq, sr) {
    const tau = 2 * Math.PI;
    // Ratios measured from struck plates: dense, irrational, no octaves.
    const partials = [
      { r: 1.00, a: 1.00, d: 0.28 },
      { r: 1.52, a: 0.72, d: 0.34 },
      { r: 2.13, a: 0.58, d: 0.42 },
      { r: 2.97, a: 0.46, d: 0.50 },
      { r: 3.76, a: 0.34, d: 0.62 },
      { r: 4.81, a: 0.28, d: 0.78 },
      { r: 6.19, a: 0.20, d: 0.95 },
      { r: 7.43, a: 0.15, d: 1.15 },
      { r: 9.11, a: 0.11, d: 1.40 },
      { r: 11.7, a: 0.08, d: 1.70 },
      { r: 14.3, a: 0.05, d: 2.10 },
    ];
    const phases = new Float64Array(partials.length);
    const steps = partials.map(p => (tau * freq * p.r) / sr);

    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      // Strike: a short burst of noise that seeds the plate.
      const strike = Math.exp(-t * 26) * (Math.random() * 2 - 1) * 0.28;
      // Bloom: the upper partials arrive late and then fade.
      const bloom = Math.min(1, t / 1.8);
      let sum = 0;
      for (let k = 0; k < partials.length; k++) {
        phases[k] += steps[k];
        const rise = k === 0 ? 1 : bloom;
        sum += partials[k].a * rise * Math.exp(-t * partials[k].d) * Math.sin(phases[k]);
      }
      // Slow beating between two nearly-equal modes: the shimmer of a big plate.
      const shimmer = 1 + 0.06 * Math.sin(tau * 0.7 * t) * Math.exp(-t * 0.25);
      data[i] = sum * 0.14 * shimmer + strike;
    }
    this._fadeOut(data, sr, 1.2);
  }

  /** Taper the last `seconds` to zero so a one-shot never ends on a click. */
  _fadeOut(data, sr, seconds) {
    const tail = Math.min(data.length, Math.floor(sr * seconds));
    const start = data.length - tail;
    for (let i = 0; i < tail; i++) {
      const k = 1 - i / tail;
      data[start + i] *= k * k;
    }
  }

  /** Kept for callers that used the old name. */
  _synthesizeChakraBowls() {
    this.preloadChakraBowls();
  }

}
