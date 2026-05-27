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

  _generateBowl(data, freq, sr) {
    // Realistic singing bowl: metallic strike + rich harmonics + slow decay + wobble
    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      
      // Strike attack (very short metallic click)
      const attack = Math.exp(-t * 80) * 0.25;
      const strikeNoise = (Math.random() - 0.5) * attack;
      
      // Slow exponential decay
      const env = Math.exp(-t * 0.4) * 0.7 + 0.05;
      
      // Subtle pitch wobble (characteristic of real bowls)
      const wobble = 1 + 0.0015 * Math.sin(2 * Math.PI * 0.8 * t) + 0.001 * Math.sin(2 * Math.PI * 1.3 * t);
      const f = freq * wobble;
      
      // Rich harmonic series (singing bowls have many overtones)
      const f1 = Math.sin(2 * Math.PI * f * t);
      const f2 = 0.65 * Math.sin(2 * Math.PI * f * 2.01 * t);
      const f3 = 0.4 * Math.sin(2 * Math.PI * f * 3.02 * t);
      const f4 = 0.25 * Math.sin(2 * Math.PI * f * 4.55 * t);
      const f5 = 0.15 * Math.sin(2 * Math.PI * f * 5.8 * t);
      const f6 = 0.08 * Math.sin(2 * Math.PI * f * 8.1 * t);
      
      data[i] = (f1 + f2 + f3 + f4 + f5 + f6) * env + strikeNoise;
    }
  }

  preloadAll(note = 'C4') {
    for (const type of Object.keys(this.instruments)) {
      const buffer = this.generateBuffer(type, note);
      if (buffer) {
        this.audioEngine.addAudioBuffer('instr_' + type, buffer);
      }
    }
  }

  preloadChakraBowls() {
    // Pitch-shift the real singing-bowl.mp3 for chakra notes
    const baseBuffer = this.audioEngine.buffers.get('singing-bowl');
    if (!baseBuffer) {
      // Fallback to synthesis if no real bowl loaded
      this._synthesizeChakraBowls();
      return;
    }

    const notes = [
      { type: 'bowl_c', ratio: 256 / 210 },  // C from ~210Hz base
      { type: 'bowl_d', ratio: 288 / 210 },
      { type: 'bowl_e', ratio: 320 / 210 },
      { type: 'bowl_f', ratio: 341 / 210 },
      { type: 'bowl_g', ratio: 384 / 210 },
      { type: 'bowl_a', ratio: 426 / 210 },
      { type: 'bowl_b', ratio: 480 / 210 },
    ];

    const ctx = this.audioEngine.ctx;
    notes.forEach(({ type, ratio }) => {
      const newLength = Math.floor(baseBuffer.length / ratio);
      const buf = ctx.createBuffer(baseBuffer.numberOfChannels, newLength, ctx.sampleRate);
      for (let ch = 0; ch < baseBuffer.numberOfChannels; ch++) {
        const srcData = baseBuffer.getChannelData(ch);
        const dstData = buf.getChannelData(ch);
        for (let i = 0; i < newLength; i++) {
          const srcIdx = i * ratio;
          const idx0 = Math.floor(srcIdx);
          const idx1 = Math.min(idx0 + 1, srcData.length - 1);
          const frac = srcIdx - idx0;
          dstData[i] = srcData[idx0] * (1 - frac) + srcData[idx1] * frac;
        }
      }
      this.audioEngine.addAudioBuffer(type, buf);
    });
  }

  _synthesizeChakraBowls() {
    const notes = [
      { type: 'bowl_c', freq: 256 },
      { type: 'bowl_d', freq: 288 },
      { type: 'bowl_e', freq: 320 },
      { type: 'bowl_f', freq: 341 },
      { type: 'bowl_g', freq: 384 },
      { type: 'bowl_a', freq: 426 },
      { type: 'bowl_b', freq: 480 },
    ];
    notes.forEach(({ type, freq }) => {
      const sr = this.audioEngine.ctx.sampleRate;
      const buf = this.audioEngine.ctx.createBuffer(1, Math.floor(sr * 14), sr);
      this._generateBowl(buf.getChannelData(0), freq, sr);
      this.audioEngine.addAudioBuffer(type, buf);
    });
  }
}
