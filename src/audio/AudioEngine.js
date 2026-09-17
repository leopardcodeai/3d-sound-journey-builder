/**
 * SpatialAudioEngine
 * Owns the AudioContext, the master bus (limiter, reverb, meters), the
 * listener pose and every sound source. Sources are either decoded samples
 * or procedural generators (see Generators.js); both get the same per-source
 * inserts and the same spatial chain unless they are head-locked.
 *
 * Graph per source:
 *   sample:    BufferSource -> LP -> HP -> ModGain -> Shoulder -> Pinna -> Panner(HRTF) -> Gain -> Master
 *   generator: Generator.output ---------------------> Shoulder -> Pinna -> Panner       -> Gain -> Master
 *   binaural:  Generator.output (stereo, head-locked) ------------------------------------> Gain -> Master
 *   every:     Gain -> ReverbSend -> Convolver -> ReverbReturn -> Master ; Gain -> Analyser
 * Master:      Master -> Limiter -> Destination ; Master -> Splitter -> L/R analysers
 *
 * Coordinates: app space is (x right, y forward, z up) in metres; Web Audio
 * gets (x, z, -y).
 */
import { getSound } from '../data/SoundLibrary.js';
import { buildGenerator, GENERATORS, createImpulseResponse, clampParam } from './Generators.js';

const POSTURE_PRESETS = {
  standing:     { shoulder: 0.5, pinna: 0.5,  headTilt: 0 },
  'lying-back': { shoulder: 0.8, pinna: 0.4,  headTilt: 0 },
  // Fifteen degrees short of a full quarter turn, and the number is measured,
  // not chosen. On your side the ears stack vertically, so the flat map becomes
  // the median plane and every sound on it sits equidistant from both. At a
  // true 90 degrees a source three metres to the map's right renders at 0.0 dB
  // right minus left: the map loses its left and right completely. Backing off
  // to 75 degrees brings that to 7.7 dB while an overhead source only falls
  // from -11.4 to -9.8, so the posture still reads unmistakably as lying on
  // one side. A head on a pillow is not at a perfect right angle either.
  'lying-side': { shoulder: 0.9, pinna: 0.15, headTilt: -15 },
};

export const INSERT_DEFAULTS = { lowpass: 20000, highpass: 20, modRate: 0, modDepth: 0, reverb: 0, rate: 1 };

/**
 * A biquad low-pass becomes numerically unstable as its cutoff approaches
 * Nyquist, and Chrome logs "state is bad" for it. Keep the fully-open position
 * at 40 percent of the sample rate: about 17.6 kHz at 44.1 kHz, above the top
 * of hearing and above what a 128 kbps mp3 carries, so nothing is lost.
 */
export function cutoffCeiling(ctx) {
  return Math.round((ctx && ctx.sampleRate ? ctx.sampleRate : 44100) * 0.4);
}

function safeCutoff(ctx, hz) {
  const ceiling = cutoffCeiling(ctx);
  const n = Number(hz);
  if (!Number.isFinite(n)) return ceiling;
  return Math.max(20, Math.min(n, ceiling));
}

export class SpatialAudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.limiter = null;
    this.reverbBus = null;
    this.reverbReturn = null;
    this.reverbLevel = 0.3;
    this.leftAnalyser = null;
    this.rightAnalyser = null;
    this._muted = false;
    this._lastVolume = 0.8;

    /** type -> AudioBuffer */
    this.buffers = new Map();
    /** id -> source record */
    this.sources = new Map();

    this.shoulderStrength = 0.5;
    this.pinnaStrength = 0.5;
    this.posture = 'standing';
    this.headTilt = 0;
    this.headTurn = 0;

    this.outputMode = 'hrtf';
    this.speakerPositions = null;
    this.channelCount = 2;

    this.isInitialized = false;
    this.onPoseChange = null;
    this.onSourcesChanged = null;
    this.headTracker = null;

    this._leftData = null;
    this._rightData = null;
    this._levelData = null;
    this._previewNode = null;
    this._previewGen = null;
    this._previewTimer = null;
  }

  // ---------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------

  init() {
    if (this.isInitialized) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!this.ctx) this.ctx = new AudioContextClass();
    const ctx = this.ctx;
    const t = ctx.currentTime;

    this.masterGain = ctx.createGain();
    this.masterGain.gain.setValueAtTime(this._lastVolume, t);

    // Soft limiter keeps stacked sources from clipping the output.
    if (typeof ctx.createDynamicsCompressor === 'function') {
      this.limiter = ctx.createDynamicsCompressor();
      const p = (param, v) => { if (param && param.setValueAtTime) param.setValueAtTime(v, t); else if (param) param.value = v; };
      p(this.limiter.threshold, -3);
      p(this.limiter.knee, 4);
      p(this.limiter.ratio, 12);
      p(this.limiter.attack, 0.004);
      p(this.limiter.release, 0.18);
      this.masterGain.connect(this.limiter);
      this.limiter.connect(ctx.destination);
    } else {
      this.masterGain.connect(ctx.destination);
    }

    // An analyser only runs while it is part of the path to the destination.
    // A muted sink keeps every meter alive without adding anything audible.
    this.silentSink = ctx.createGain();
    this.silentSink.gain.setValueAtTime(0, t);
    this.silentSink.connect(ctx.destination);

    const splitter = ctx.createChannelSplitter(2);
    this.leftAnalyser = ctx.createAnalyser();
    this.rightAnalyser = ctx.createAnalyser();
    this.leftAnalyser.fftSize = 1024;
    this.rightAnalyser.fftSize = 1024;
    this.leftAnalyser.smoothingTimeConstant = 0.4;
    this.rightAnalyser.smoothingTimeConstant = 0.4;
    // Meter what actually leaves the app. Tapping the master gain instead would
    // show the level before the limiter, which sits at full scale whenever the
    // limiter is doing its job and so tells the listener nothing.
    (this.limiter || this.masterGain).connect(splitter);
    splitter.connect(this.leftAnalyser, 0, 0);
    splitter.connect(this.rightAnalyser, 1, 0);
    this.leftAnalyser.connect(this.silentSink);
    this.rightAnalyser.connect(this.silentSink);

    // Shared reverb bus with a synthetic impulse response.
    if (typeof ctx.createConvolver === 'function') {
      try {
        this.reverbBus = ctx.createConvolver();
        this.reverbBus.buffer = createImpulseResponse(ctx, 2.8, 3.2);
        this.reverbReturn = ctx.createGain();
        this.reverbReturn.gain.setValueAtTime(this.reverbLevel, t);
        this.reverbBus.connect(this.reverbReturn);
        this.reverbReturn.connect(this.masterGain);
      } catch (e) {
        this.reverbBus = null;
        this.reverbReturn = null;
      }
    }

    this.isInitialized = true;
    // Every way into the engine comes through here, including a shared link,
    // which never passes through the start screen. Attaching here rather than
    // there is what makes the recovery on visibilitychange reach that path.
    if (this.keepAlive && this.keepAlive.attach) this.keepAlive.attach(ctx);
    this.updateListenerPose(this.posture, this.headTilt, this.headTurn);
    console.log('Spatial audio engine ready');
  }

  /**
   * Every gesture that starts audio comes through here. The keep-alive has to
   * start before the first await, or iOS no longer counts it as part of the
   * gesture and refuses it; that is why it goes first and is not awaited.
   */
  async resume() {
    if (this.keepAlive && this.keepAlive.play) this.keepAlive.play();
    if (this.ctx && (this.ctx.state === 'suspended' || this.ctx.state === 'interrupted')) {
      try { await this.ctx.resume(); } catch (e) { /* user gesture required */ }
    }
    // The gesture unlocked the loop; whether it stays on depends on whether
    // anything actually starts. An empty start or a failed load starts
    // nothing, and without this the silent loop ran on for ever, holding the
    // session and the lock-screen controls with no sound behind them.
    if (this.keepAlive && this.keepAlive.sync) {
      if (this._keepAliveSettle) clearTimeout(this._keepAliveSettle);
      this._keepAliveSettle = setTimeout(() => { this._keepAliveSettle = null; this._syncKeepAlive(); }, 3000);
    }
  }

  /** True while any source is producing sound. Drives the keep-alive. */
  anyPlaying() {
    for (const src of this.sources.values()) if (src && src.isPlaying) return true;
    return false;
  }

  _syncKeepAlive() {
    if (this.keepAlive && this.keepAlive.sync) this.keepAlive.sync(this.anyPlaying());
  }

  destroy() {
    for (const id of Array.from(this.sources.keys())) this.removeSource(id);
    this.stopPreview();
    if (this.ctx) this.ctx.close();
    this.ctx = null;
    this.isInitialized = false;
  }

  // ---------------------------------------------------------------------
  // Listener
  // ---------------------------------------------------------------------

  /**
   * Rotates a vector about a unit axis. Rodrigues' formula, with the term that
   * needs the dot product kept, so it is correct even when the two are not
   * perpendicular.
   */
  static _rotateAbout(v, k, angle) {
    const c = Math.cos(angle);
    const sn = Math.sin(angle);
    const dot = k[0] * v[0] + k[1] * v[1] + k[2] * v[2];
    const cross = [
      k[1] * v[2] - k[2] * v[1],
      k[2] * v[0] - k[0] * v[2],
      k[0] * v[1] - k[1] * v[0],
    ];
    return [
      v[0] * c + cross[0] * sn + k[0] * dot * (1 - c),
      v[1] * c + cross[1] * sn + k[1] * dot * (1 - c),
      v[2] * c + cross[2] * sn + k[2] * dot * (1 - c),
    ];
  }

  /**
   * Sets the listener's orientation from posture, head tilt and head turn.
   *
   * Tilt and turn are two different movements and the app only had one of them.
   *
   * Tilt is roll: the head leans towards a shoulder, the up vector rotates and
   * the face keeps pointing the same way. Turn is yaw: the face itself rotates,
   * so a sound on the right swings towards the front and on to the left ear.
   * Yaw is the movement people mean by turning their head, and until now there
   * was no control for it anywhere.
   *
   * Both are audible, which is worth stating because a first measurement here
   * suggested otherwise. Probing with a 600 Hz tone showed tilt moving the
   * balance by under a decibel, but that is an artefact of the probe: at
   * 600 Hz the ear works on arrival time, not level, and an RMS comparison
   * cannot see it. Re-measured with broadband noise on a source three metres
   * to the right, right minus left in dB:
   *
   *            0     30     60     90    120    180 degrees
   *   tilt   11.1    9.1    7.7    0.0   -7.9  -11.1
   *   turn   11.1   10.8    9.4    0.0   -9.4  -11.3
   *
   * Turn is applied by rotating the forward vector about the listener's own up
   * axis, so it works the same way in all three postures instead of needing a
   * special case for each.
   */
  /**
   * The listener's three axes in the app's own world terms: x to the right of
   * the map, y towards the top of it, z up. Nose, crown and right ear.
   *
   * This exists so that exactly one piece of code decides where the listener
   * faces. The field used to carry its own copy of the geometry, drawn by hand
   * per posture, and the two had drifted apart in both lying postures: on the
   * back the drawn ears were the wrong way round, so a sound on the right of
   * the map lit the marker on the left while being heard on the left. On the
   * side the drawn nose pointed along the body. Anything that needs to show
   * the listener reads from here now.
   *
   * Posture sets the neutral pose and tilt rolls the head away from it, in the
   * same direction in all three: positive leans the crown towards the map's
   * right. Turn is yaw about the listener's own crown, applied last.
   */
  static poseVectors(posture, headTilt = 0, headTurn = 0) {
    const rad = ((Number.isFinite(headTilt) ? headTilt : 0) * Math.PI) / 180;
    let forward, up;
    if (posture === 'lying-back') {
      // On your back: face the sky, feet towards the top of the map, crown
      // towards the bottom. Decided on the mat, not at the desk: with the
      // phone held up while lying down, this is the orientation in which a
      // sound drawn on the right of the screen is heard on the right. The
      // vectors then say the rest: right ear to the map's right, no mirror.
      // The earlier orientation had the crown at the top, which put the right
      // ear on the map's left; geometrically defensible, and wrong in the hand.
      forward = [0, 0, 1];
      up = [Math.sin(rad), -Math.cos(rad), 0];
    } else if (posture === 'lying-side') {
      // On your side: face along the map, crown out to the right of it, so one
      // ear is against the pillow and the other faces the ceiling. That full
      // quarter turn is the whole point of the posture; the preset used to
      // stop halfway, at 45 degrees, which left the crown pointing into the
      // ground and belonged to no posture at all.
      forward = [0, 1, 0];
      // Negative sine, so that a positive tilt leans the crown towards the
      // listener's own right ear here too. With a plus it leaned the other way
      // and the one tilt slider meant two different things depending on which
      // posture happened to be selected.
      up = [Math.cos(rad), 0, -Math.sin(rad)];
    } else {
      forward = [0, 1, 0];
      up = [Math.sin(rad), 0, Math.cos(rad)];
    }

    const turn = Number.isFinite(headTurn) ? headTurn : 0;
    if (turn !== 0) {
      const len = Math.hypot(up[0], up[1], up[2]) || 1;
      const k = [up[0] / len, up[1] / len, up[2] / len];
      // Negated so a positive angle turns to the right, like a compass bearing
      // and like the yaw a head tracker reports. Rotating about the up axis by
      // a positive angle would otherwise swing the face to the left.
      forward = SpatialAudioEngine._rotateAbout(forward, k, (-turn * Math.PI) / 180);
    }

    const right = [
      forward[1] * up[2] - forward[2] * up[1],
      forward[2] * up[0] - forward[0] * up[2],
      forward[0] * up[1] - forward[1] * up[0],
    ];
    return { forward, up, right };
  }

  /** The current pose as vectors, for anything that draws the listener. */
  listenerAxes() {
    return SpatialAudioEngine.poseVectors(this.posture, this.headTilt, this.headTurn);
  }

  updateListenerPose(posture, headTilt, headTurn) {
    this.posture = posture;
    this.headTilt = headTilt;
    if (headTurn !== undefined) this.headTurn = headTurn;
    const turn = Number.isFinite(this.headTurn) ? this.headTurn : 0;
    if (!this.isInitialized || !this.ctx) return;
    const listener = this.ctx.listener;

    // World (x right, y towards the top of the map, z up) to Web Audio
    // (x, z, -y). A proper rotation, so the turn above may be applied on
    // either side of it.
    const { forward, up } = SpatialAudioEngine.poseVectors(posture, headTilt, turn);
    const fx = forward[0], fy = forward[2], fz = -forward[1];
    const ux = up[0], uy = up[2], uz = -up[1];

    const t = this.ctx.currentTime;
    if (listener.forwardX) {
      listener.forwardX.setValueAtTime(fx, t); listener.forwardY.setValueAtTime(fy, t); listener.forwardZ.setValueAtTime(fz, t);
      listener.upX.setValueAtTime(ux, t); listener.upY.setValueAtTime(uy, t); listener.upZ.setValueAtTime(uz, t);
    } else if (listener.setOrientation) {
      listener.setOrientation(fx, fy, fz, ux, uy, uz);
    }
  }

  applyPosturePreset(posture) {
    const p = POSTURE_PRESETS[posture] || POSTURE_PRESETS.standing;
    this.updateListenerPose(posture, p.headTilt);
    this.updateShoulderStrength(p.shoulder);
    this.updatePinnaStrength(p.pinna);
    if (this.onPoseChange) this.onPoseChange({ posture, shoulderStrength: p.shoulder, pinnaStrength: p.pinna, headTilt: p.headTilt });
  }

  updateShoulderStrength(val) {
    this.shoulderStrength = val;
    const gainVal = -12 * val;
    for (const src of this.sources.values()) {
      if (src.shoulderFilter) src.shoulderFilter.gain.setValueAtTime(gainVal, this.ctx.currentTime);
    }
  }

  updatePinnaStrength(val) {
    this.pinnaStrength = val;
    const gainVal = -15 * val;
    for (const src of this.sources.values()) {
      if (src.pinnaFilter) src.pinnaFilter.gain.setValueAtTime(gainVal, this.ctx.currentTime);
    }
  }

  // ---------------------------------------------------------------------
  // Buffers
  // ---------------------------------------------------------------------

  async preloadSound(type, url) {
    try {
      if (!this.ctx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContextClass();
      }
      if (this.buffers.has(type)) return true;
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const decoded = await this.ctx.decodeAudioData(arrayBuffer);
      this.buffers.set(type, decoded);
      return true;
    } catch (err) {
      console.error(`Failed to load sound "${type}" from ${url}:`, err);
      return false;
    }
  }

  addAudioBuffer(type, audioBuffer) {
    this.buffers.set(type, audioBuffer);
  }

  hasBuffer(type) {
    return this.buffers.has(type) || this.buffers.has('instr_' + type);
  }

  // ---------------------------------------------------------------------
  // Sources
  // ---------------------------------------------------------------------

  /**
   * Create and start a source.
   * @param {Object} [options] { params, inserts, kind }
   */
  addSource(id, type, name, x, y, z = 0, volume = 0.5, options = {}) {
    if (!this.isInitialized) this.init();
    this.resume();
    if (this.sources.has(id)) this.removeSource(id);

    const def = getSound(type);
    const kind = options.kind || def.kind;
    if (kind === 'generator' || def.gen) {
      return this._addGeneratorSource(id, type, name, x, y, z, volume, def, options);
    }

    const buffer = this.buffers.get(type) || this.buffers.get('instr_' + type);
    if (!buffer) {
      console.error(`Audio buffer for "${type}" is not preloaded`);
      return null;
    }
    const ctx = this.ctx;
    const t = ctx.currentTime;

    const src = {
      id, type, name: name || type, x, y, z, volume,
      isPlaying: true, kind: 'sample', spatial: true,
      params: {}, inserts: { ...INSERT_DEFAULTS, ...(options.inserts || {}) },
      sourceNode: null, generator: null,
    };

    // Inserts (pre-spatial)
    src.lowpass = ctx.createBiquadFilter();
    src.lowpass.type = 'lowpass';
    src.inserts.lowpass = safeCutoff(ctx, src.inserts.lowpass);
    src.lowpass.frequency.setValueAtTime(src.inserts.lowpass, t);
    src.highpass = ctx.createBiquadFilter();
    src.highpass.type = 'highpass';
    src.highpass.frequency.setValueAtTime(src.inserts.highpass, t);
    src.modGain = ctx.createGain();
    src.modGain.gain.setValueAtTime(1, t);
    src.lowpass.connect(src.highpass);
    src.highpass.connect(src.modGain);

    src.gainNode = ctx.createGain();
    src.gainNode.gain.setValueAtTime(volume, t);

    this._buildSpatialChain(src, src.modGain);
    this._connectOutputs(src);

    src.sourceNode = this._makeBufferNode(buffer, src.inserts.rate);
    src.sourceNode.connect(src.lowpass);
    src.sourceNode.start(0);

    if (src.inserts.modDepth > 0) this._applyModulation(src);
    if (src.inserts.reverb > 0 && src.reverbSend) src.reverbSend.gain.setValueAtTime(src.inserts.reverb, t);

    this.sources.set(id, src);

    this._syncKeepAlive();
    this._notify();
    return src;
  }

  _makeBufferNode(buffer, rate = 1) {
    const node = this.ctx.createBufferSource();
    node.buffer = buffer;
    node.loop = true;
    if (rate !== 1 && node.playbackRate) {
      if (node.playbackRate.setValueAtTime) node.playbackRate.setValueAtTime(rate, this.ctx.currentTime);
      else node.playbackRate.value = rate;
    }
    return node;
  }

  _addGeneratorSource(id, type, name, x, y, z, volume, def, options) {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const genName = options.gen || def.gen || 'binaural';
    const params = { ...(def.params || {}), ...(options.params || {}) };
    const handle = buildGenerator(ctx, genName, params);
    if (!handle) {
      console.error(`Unknown generator "${genName}" for "${type}"`);
      return null;
    }
    // Head-locking follows the generator that is actually running, not the
    // library entry: swapping a binaural source to an isochronic one has to
    // release it into the field. `options.spatial` lets a caller be explicit.
    // A caller naming a different generator than the library entry is
    // swapping it, and a swapped source is released into the field. Naming
    // the same one is not a swap: a restored scene passes the generator it
    // saved, and that used to turn the breath pacer spatial and route it
    // through the panner, which is exactly what a head-locked source exists
    // to avoid. `options.spatial` still lets a caller be explicit.
    const swapped = !!options.gen && options.gen !== def.gen;
    const headLocked = options.spatial !== undefined
      ? options.spatial === false
      : (!!handle.meta.headLocked || (swapped ? false : def.spatial === false));

    const src = {
      id, type, name: name || type, x, y, z, volume,
      isPlaying: true, kind: 'generator', gen: genName, spatial: !headLocked,
      generator: handle, params: handle.params,
      inserts: { ...INSERT_DEFAULTS, ...(options.inserts || {}) },
      sourceNode: null,
      _bwFreq: handle.params.beat,
    };

    src.gainNode = ctx.createGain();
    src.gainNode.gain.setValueAtTime(volume, t);

    if (headLocked) {
      src.shoulderFilter = null;
      src.pinnaFilter = null;
      src.pannerNode = null;
      handle.output.connect(src.gainNode);
    } else {
      this._buildSpatialChain(src, handle.output);
    }
    this._connectOutputs(src);
    if (src.inserts.reverb > 0 && src.reverbSend) src.reverbSend.gain.setValueAtTime(src.inserts.reverb, t);

    this.sources.set(id, src);
    this._notify();
    return src;
  }

  /** Shoulder/pinna filters + HRTF panner; `input` feeds the chain. */
  _buildSpatialChain(src, input) {
    const ctx = this.ctx;
    const t = ctx.currentTime;

    // Both filters get their real centre frequency here, not only later in
    // _applyPosition. A BiquadFilterNode starts at 350 Hz, so without this the
    // first render quantum runs a shoulder notch an octave and a half too low
    // and an ear filter more than four octaves too low.
    src.shoulderFilter = ctx.createBiquadFilter();
    src.shoulderFilter.type = 'peaking';
    src.shoulderFilter.Q.value = 1.5;
    src.shoulderFilter.gain.value = -12 * this.shoulderStrength;
    src.shoulderFilter.frequency.setValueAtTime(1700, t);

    src.pinnaFilter = ctx.createBiquadFilter();
    src.pinnaFilter.type = 'peaking';
    src.pinnaFilter.Q.value = 2.5;
    src.pinnaFilter.gain.value = -15 * this.pinnaStrength;
    src.pinnaFilter.frequency.setValueAtTime(7500, t);

    src.pannerNode = ctx.createPanner();
    src.pannerNode.panningModel = 'HRTF';
    // Sum to mono before the HRTF, and this is not a detail.
    //
    // Fed two channels, the HRTF panner applies the left response to the left
    // input and the right response to the right input. IRCAM's own review of
    // the Web Audio API calls the interpretation of that formula doubtful, and
    // measurement says worse: a stereo source placed three metres to the right
    // rendered at -0.9 dB right-minus-left, so it sounded slightly left of
    // centre. It was not being placed at all. With the input summed first it
    // measures +11.2 dB, which is where it belongs.
    //
    // Three bundled files are stereo, among them the gong, the singing bowl
    // and the wind chimes, so this was audible in the sound bath.
    src.pannerNode.channelCount = 1;
    src.pannerNode.channelCountMode = 'explicit';
    src.pannerNode.channelInterpretation = 'speakers';
    src.pannerNode.distanceModel = 'inverse';
    src.pannerNode.refDistance = 1.0;
    src.pannerNode.maxDistance = 10000;
    src.pannerNode.rolloffFactor = 1.2;

    this._applyPosition(src);

    input.connect(src.shoulderFilter);
    src.shoulderFilter.connect(src.pinnaFilter);
    src.pinnaFilter.connect(src.pannerNode);
    src.pannerNode.connect(src.gainNode);
  }

  /** Gain -> master (or speaker matrix), reverb send, level analyser. */
  _connectOutputs(src) {
    const ctx = this.ctx;
    src.gainNode.connect(this.masterGain);

    if (this.reverbBus) {
      src.reverbSend = ctx.createGain();
      src.reverbSend.gain.setValueAtTime(src.inserts.reverb || 0, ctx.currentTime);
      src.gainNode.connect(src.reverbSend);
      src.reverbSend.connect(this.reverbBus);
    }
    if (typeof ctx.createAnalyser === 'function') {
      src.analyser = ctx.createAnalyser();
      src.analyser.fftSize = 256;
      src.gainNode.connect(src.analyser);
      if (this.silentSink) src.analyser.connect(this.silentSink);
    }
    if (this.outputMode !== 'hrtf' && src.pannerNode) this._reconnectSource(src);
  }

  _applyPosition(src) {
    if (!src.pannerNode) return;
    const t = this.ctx.currentTime;
    const webX = src.x, webY = src.z, webZ = -src.y;
    const d2d = Math.sqrt(src.x * src.x + src.y * src.y);
    const elevation = Math.atan2(src.z, d2d || 0.1);
    if (src.shoulderFilter) src.shoulderFilter.frequency.setValueAtTime(1700 + 500 * Math.sin(elevation), t);
    if (src.pinnaFilter) src.pinnaFilter.frequency.setValueAtTime(7500 + 2500 * Math.sin(elevation), t);
    if (src.pannerNode.positionX) {
      src.pannerNode.positionX.setValueAtTime(webX, t);
      src.pannerNode.positionY.setValueAtTime(webY, t);
      src.pannerNode.positionZ.setValueAtTime(webZ, t);
    } else if (src.pannerNode.setPosition) {
      src.pannerNode.setPosition(webX, webY, webZ);
    }
  }

  /** Compatibility wrapper: older callers created brainwave beats directly. */
  createBinauralBeat(id, type, freq, x, y, z = 0, volume = 0.3) {
    return this.addSource(id, type, `${freq} Hz binaural`, x, y, z, volume, { gen: 'binaural', params: { beat: freq } });
  }

  _notify() {
    if (this.onSourcesChanged) this.onSourcesChanged(this.sources);
  }

  updateSourcePosition(id, x, y, z = null) {
    const src = this.sources.get(id);
    if (!src) return;
    src.x = x; src.y = y;
    if (z !== null) src.z = z;
    this._applyPosition(src);
    if (src._useMultiChannel && this.speakerPositions) {
      for (let i = 0; i < this.speakerPositions.length; i++) {
        const sp = this.speakerPositions[i];
        if (sp.isSub) continue;
        const dist = Math.sqrt((src.x - sp.x) ** 2 + (src.y - sp.y) ** 2 + (src.z - sp.z) ** 2);
        const g = Math.max(0, 1 / (1 + dist * 0.5));
        if (src._channelGains && src._channelGains[i]) src._channelGains[i].gain.setValueAtTime(g, this.ctx.currentTime);
      }
    }
  }

  updateSourceVolume(id, volume) {
    const src = this.sources.get(id);
    if (!src) return;
    src.volume = volume;
    const g = src.gainNode.gain;
    if (g.setTargetAtTime) g.setTargetAtTime(volume, this.ctx.currentTime, 0.02);
    else g.setValueAtTime(volume, this.ctx.currentTime);
  }

  renameSource(id, name) {
    const src = this.sources.get(id);
    if (src) { src.name = name; this._notify(); }
  }

  /**
   * Generic parameter setter for generator params and per-source inserts.
   * Returns the value actually applied (after clamping).
   */
  setSourceParam(id, key, value) {
    const src = this.sources.get(id);
    if (!src) return undefined;
    const t = this.ctx.currentTime;
    const def = src.gen ? GENERATORS[src.gen] : null;
    const isGenParam = def && def.controls.some(c => c.key === key);

    if (isGenParam) {
      const v = clampParam(src.gen, key, value);
      src.params[key] = v;
      if (key === 'beat') src._bwFreq = v;
      if (src.generator) src.generator.setParam(key, v);
      return v;
    }

    switch (key) {
      case 'lowpass':
        src.inserts.lowpass = value;
        if (src.lowpass) src.lowpass.frequency.setValueAtTime(safeCutoff(this.ctx, value), t);
        return value;
      case 'highpass':
        src.inserts.highpass = value;
        if (src.highpass) src.highpass.frequency.setValueAtTime(value, t);
        return value;
      case 'modRate':
      case 'modDepth':
        src.inserts[key] = value;
        this._applyModulation(src);
        return value;
      case 'reverb':
        src.inserts.reverb = value;
        if (src.reverbSend) src.reverbSend.gain.setValueAtTime(value, t);
        return value;
      case 'rate':
        src.inserts.rate = value;
        if (src.sourceNode && src.sourceNode.playbackRate) {
          if (src.sourceNode.playbackRate.setValueAtTime) src.sourceNode.playbackRate.setValueAtTime(value, t);
          else src.sourceNode.playbackRate.value = value;
        }
        return value;
      default:
        src.params[key] = value;
        return value;
    }
  }

  /** Amplitude modulation insert (Brain.fm style slow AM) on sample sources. */
  _applyModulation(src) {
    if (!src.modGain) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const depth = Math.max(0, Math.min(1, src.inserts.modDepth || 0));
    const rate = Math.max(0.05, src.inserts.modRate || 0);
    if (depth <= 0 || !(src.inserts.modRate > 0)) {
      if (src._modLfo) { try { src._modLfo.stop(); } catch (e) {} try { src._modLfo.disconnect(); } catch (e) {} src._modLfo = null; }
      if (src._modDepthGain) { try { src._modDepthGain.disconnect(); } catch (e) {} src._modDepthGain = null; }
      src.modGain.gain.setValueAtTime(1, t);
      return;
    }
    if (!src._modLfo) {
      src._modLfo = ctx.createOscillator();
      src._modLfo.type = 'sine';
      src._modDepthGain = ctx.createGain();
      src._modLfo.connect(src._modDepthGain);
      src._modDepthGain.connect(src.modGain.gain);
      src._modLfo.start(0);
    }
    if (src._modLfo.frequency.setValueAtTime) src._modLfo.frequency.setValueAtTime(rate, t); else src._modLfo.frequency.value = rate;
    src._modDepthGain.gain.setValueAtTime(depth / 2, t);
    src.modGain.gain.setValueAtTime(1 - depth / 2, t);
  }

  /**
   * Fade-in / fade-out / repeat cycle for a source (seconds, 0 = off).
   */
  setSourceRamp(id, rampUp, rampDown, repeatInterval) {
    const src = this.sources.get(id);
    if (!src || !this.isInitialized) return;
    src.rampUp = rampUp;
    src.rampDown = rampDown;
    src.repeatInterval = repeatInterval;
    if (src._rampTimeout) { clearTimeout(src._rampTimeout); src._rampTimeout = null; }
    const targetVolume = src.volume;
    const now = this.ctx.currentTime;
    // Whatever the previous settings scheduled is no longer wanted. Leaving it
    // in place makes the two schedules fight on the same parameter, and the
    // volume jumps at the old timestamps.
    src.gainNode.gain.cancelScheduledValues(now);
    if (repeatInterval > 0) {
      this._scheduleRampCycle(src, targetVolume, now);
    } else {
      if (rampUp > 0) {
        src.gainNode.gain.setValueAtTime(0, now);
        src.gainNode.gain.linearRampToValueAtTime(targetVolume, now + rampUp);
      } else {
        src.gainNode.gain.setValueAtTime(targetVolume, now);
      }
    }
  }

  _scheduleRampCycle(src, targetVolume, startTime) {
    const { rampUp, rampDown, repeatInterval } = src;
    const scheduleCycle = (cycleStart) => {
      const g = src.gainNode.gain;
      g.cancelScheduledValues(cycleStart);
      g.setValueAtTime(0, cycleStart);
      g.linearRampToValueAtTime(targetVolume, cycleStart + rampUp);
      g.setValueAtTime(targetVolume, cycleStart + repeatInterval - rampDown);
      g.linearRampToValueAtTime(0, cycleStart + repeatInterval);
      src._rampTimeout = setTimeout(() => {
        if (this.sources.has(src.id) && src.repeatInterval > 0 && src.isPlaying) scheduleCycle(this.ctx.currentTime);
      }, repeatInterval * 1000);
    };
    scheduleCycle(startTime);
  }

  // ---------------------------------------------------------------------
  // Output modes
  // ---------------------------------------------------------------------

  /**
   * Speaker mode with nothing to send to is not a mode, it is a broken graph.
   * Custom speakers start out empty, and the preset used to carry the string
   * 'custom' as its channel count; both ended at createChannelMerger, which
   * threw after the panner had already been disconnected. Every source went
   * silent, and because the choice is remembered, so did every source added
   * after the next reload. Hold the output at headphones until there is
   * something real to route to.
   */
  setOutputMode(mode, speakerPositions = null, channels = 2) {
    const count = Math.floor(Number(channels));
    const positions = Array.isArray(speakerPositions) ? speakerPositions : null;
    const usable = mode !== 'speakers' || (positions && positions.length > 0);
    this.outputMode = usable ? mode : 'hrtf';
    this.speakerPositions = usable ? positions : null;
    this.channelCount = Number.isFinite(count) && count > 0
      ? Math.min(count, 32)
      : ((positions && positions.length) || 2);
    for (const src of this.sources.values()) this._reconnectSource(src);
  }

  /** Re-pans every source against the current speaker positions. Nothing is rebuilt. */
  refreshSpeakerPanning() {
    for (const src of this.sources.values()) this.updateSourcePosition(src.id, src.x, src.y, src.z);
  }

  _reconnectSource(src) {
    if (!src.pannerNode) return; // head-locked: always direct
    if (src._channelGains) {
      src._channelGains.forEach(g => { try { g.disconnect(); } catch (e) {} });
      src._channelGains = null;
    }
    if (src._channelMerger) { try { src._channelMerger.disconnect(); } catch (e) {} src._channelMerger = null; }
    src._useMultiChannel = false;
    try { src.pannerNode.disconnect(); } catch (e) {}

    if (this.outputMode === 'hrtf' || !this.speakerPositions) {
      src.pannerNode.panningModel = 'HRTF';
      src.pannerNode.connect(src.gainNode);
      return;
    }
    if (this.speakerPositions.length === 2 && !this.speakerPositions[0].channel) {
      src.pannerNode.panningModel = 'equalpower';
      src.pannerNode.connect(src.gainNode);
      return;
    }
    this._setupMultiChannelSource(src);
  }

  _setupMultiChannelSource(src) {
    const numChannels = this.channelCount || (this.speakerPositions || []).length;
    // Last line of defence. _reconnectSource has already disconnected the
    // panner by the time it gets here, so throwing would leave the source with
    // no path to the output at all.
    if (!Number.isInteger(numChannels) || numChannels < 1 || numChannels > 32) {
      src.pannerNode.panningModel = 'HRTF';
      src.pannerNode.connect(src.gainNode);
      return;
    }
    src._channelGains = [];
    src._channelMerger = this.ctx.createChannelMerger(numChannels);
    src.pannerNode.panningModel = 'equalpower';
    for (let i = 0; i < numChannels; i++) {
      const g = this.ctx.createGain();
      g.gain.value = 1.0;
      src._channelGains.push(g);
      src.pannerNode.connect(g);
      g.connect(src._channelMerger, 0, i);
    }
    src._channelMerger.connect(src.gainNode);
    src._useMultiChannel = true;
    this.updateSourcePosition(src.id, src.x, src.y, src.z);
  }

  // ---------------------------------------------------------------------
  // Transport
  // ---------------------------------------------------------------------

  /**
   * Pause or resume a source. Buffer sources are single-use, so resuming
   * creates a new node (optionally offset into the loop). Generators are
   * rebuilt from their stored params.
   */
  toggleSource(id, offset = 0) {
    const src = this.sources.get(id);
    if (!src) return;
    const isGen = src.kind === 'generator' || (src.type && src.type.startsWith('bw_'));

    if (isGen) {
      if (src.isPlaying) {
        if (src.generator) { try { src.generator.stop(); } catch (e) {} }
        this._legacyStop(src);
        src.isPlaying = false;
      } else {
        this._restartGenerator(src);
        src.isPlaying = true;
      }
      this._syncKeepAlive();
      return src.isPlaying;
    }

    if (src.isPlaying) {
      try { src.sourceNode.stop(); } catch (e) {}
      src.isPlaying = false;
    } else {
      const buf = this.buffers.get(src.type) || this.buffers.get('instr_' + src.type);
      const node = this._makeBufferNode(buf, src.inserts ? src.inserts.rate : 1);
      node.connect(src.lowpass || src.shoulderFilter);
      const startOffset = buf && buf.duration ? offset % buf.duration : 0;
      node.start(0, startOffset);
      src.sourceNode = node;
      src.isPlaying = true;
    }
    this._syncKeepAlive();
    return src.isPlaying;
  }

  /** Stop nodes of sources created before the generator refactor. */
  _legacyStop(src) {
    for (const key of ['_oscLeft', '_oscRight', '_noiseSource']) {
      if (src[key]) { try { src[key].stop(); } catch (e) {} src[key] = null; }
    }
  }

  _restartGenerator(src) {
    const genName = src.gen || (getSound(src.type).gen) || 'binaural';
    const params = { ...(src.params || {}) };
    if (params.beat === undefined && src._bwFreq !== undefined) params.beat = src._bwFreq;
    const handle = buildGenerator(this.ctx, genName, params);
    if (!handle) return;
    src.gen = genName;
    src.generator = handle;
    src.params = handle.params;
    src.kind = 'generator';
    const entry = src.spatial !== false && src.shoulderFilter ? src.shoulderFilter : src.gainNode;
    handle.output.connect(entry);
  }

  /**
   * Audition a sound without adding it to the journey: a short one-shot
   * through the master bus. Generators run for four seconds.
   */
  async previewSound(type, url) {
    if (!this.isInitialized) this.init();
    await this.resume();
    this.stopPreview();
    const ctx = this.ctx;
    const def = getSound(type);
    const now = ctx.currentTime;
    const dur = 4;

    if (def.kind === 'generator' || def.gen) {
      const handle = buildGenerator(ctx, def.gen, def.params || {});
      if (!handle) return false;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.7, now + 0.2);
      g.gain.setValueAtTime(0.7, now + dur - 0.6);
      g.gain.linearRampToValueAtTime(0.0001, now + dur);
      handle.output.connect(g);
      g.connect(this.masterGain);
      this._previewGen = handle;
      this._previewTimer = setTimeout(() => { if (this._previewGen === handle) { handle.stop(); this._previewGen = null; } }, dur * 1000 + 50);
      return true;
    }

    let buffer = this.buffers.get(type) || this.buffers.get('instr_' + type);
    if (!buffer && (url || def.url)) {
      await this.preloadSound(type, url || def.url);
      buffer = this.buffers.get(type);
    }
    if (!buffer) return false;
    const node = ctx.createBufferSource();
    node.buffer = buffer;
    node.loop = false;
    const g = ctx.createGain();
    const d = Math.min(dur, buffer.duration || dur);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.9, now + 0.12);
    g.gain.setValueAtTime(0.9, now + Math.max(0.2, d - 0.5));
    g.gain.linearRampToValueAtTime(0.0001, now + d);
    node.connect(g);
    g.connect(this.masterGain);
    node.start(0, 0, d);
    this._previewNode = node;
    node.onended = () => { if (this._previewNode === node) this._previewNode = null; };
    return true;
  }

  stopPreview() {
    if (this._previewNode) { try { this._previewNode.stop(); } catch (e) {} this._previewNode = null; }
    if (this._previewGen) { try { this._previewGen.stop(); } catch (e) {} this._previewGen = null; }
    if (this._previewTimer) { clearTimeout(this._previewTimer); this._previewTimer = null; }
  }

  removeSource(id) {
    const src = this.sources.get(id);
    if (!src) return;
    if (src._rampTimeout) { clearTimeout(src._rampTimeout); src._rampTimeout = null; }
    if (src.generator) { try { src.generator.stop(); } catch (e) {} }
    this._legacyStop(src);
    if (src.isPlaying && src.sourceNode) { try { src.sourceNode.stop(); } catch (e) {} }
    if (src._modLfo) { try { src._modLfo.stop(); } catch (e) {} }
    if (src._channelGains) src._channelGains.forEach(g => { try { g.disconnect(); } catch (e) {} });
    for (const key of ['sourceNode', '_channelMerger', '_modLfo', '_modDepthGain', 'lowpass', 'highpass', 'modGain',
      'shoulderFilter', 'pinnaFilter', 'pannerNode', 'gainNode', 'reverbSend', 'analyser', '_leftGain', '_rightGain', '_merger']) {
      if (src[key]) { try { src[key].disconnect(); } catch (e) {} }
    }
    if (src.analyser) { try { src.analyser.disconnect(); } catch (e) {} }
    this.sources.delete(id);
    this._syncKeepAlive();
    this._notify();
  }

  // ---------------------------------------------------------------------
  // Master
  // ---------------------------------------------------------------------

  setMasterVolume(volume) {
    this._lastVolume = volume;
    if (this.masterGain && !this._muted) this.masterGain.gain.setValueAtTime(volume, this.ctx.currentTime);
  }

  toggleMasterMute() {
    if (!this.masterGain) return false;
    if (this._muted) {
      this.masterGain.gain.setValueAtTime(this._lastVolume || 0.8, this.ctx.currentTime);
      this._muted = false;
    } else {
      this._lastVolume = this.masterGain.gain.value;
      this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
      this._muted = true;
    }
    return this._muted;
  }

  setReverbLevel(level) {
    this.reverbLevel = level;
    if (this.reverbReturn) this.reverbReturn.gain.setValueAtTime(level, this.ctx.currentTime);
  }

  // ---------------------------------------------------------------------
  // Meters
  // ---------------------------------------------------------------------

  getLeftRightLevels() {
    if (!this.isInitialized || !this.leftAnalyser || !this.rightAnalyser) return { left: 0, right: 0 };
    if (!this._leftData) { this._leftData = new Uint8Array(this.leftAnalyser.fftSize); this._leftData.fill(128); }
    if (!this._rightData) { this._rightData = new Uint8Array(this.rightAnalyser.fftSize); this._rightData.fill(128); }
    this.leftAnalyser.getByteTimeDomainData(this._leftData);
    this.rightAnalyser.getByteTimeDomainData(this._rightData);
    return { left: peak(this._leftData), right: peak(this._rightData) };
  }

  /** Peak level (0..1) of one source, for audio-reactive visuals. */
  getSourceLevel(id) {
    const src = this.sources.get(id);
    if (!src || !src.analyser || !src.isPlaying) return 0;
    if (!this._levelData || this._levelData.length !== src.analyser.fftSize) {
      this._levelData = new Uint8Array(src.analyser.fftSize);
      this._levelData.fill(128);
    }
    src.analyser.getByteTimeDomainData(this._levelData);
    return peak(this._levelData);
  }

  /** Session summary used by the Focus view readouts. */
  describeSession() {
    const out = { frequency: [], ambient: [], headLocked: false, breath: null };
    for (const src of this.sources.values()) {
      const def = getSound(src.type);
      if (def.category === 'frequencies') {
        out.frequency.push(src);
        if (src.spatial === false) out.headLocked = true;
        if (src.gen === 'breath') out.breath = src;
      } else {
        out.ambient.push(src);
      }
    }
    return out;
  }
}

function peak(data) {
  let max = 0;
  for (let i = 0; i < data.length; i++) {
    const v = Math.abs((data[i] - 128) / 128);
    if (v > max) max = v;
  }
  return max;
}
