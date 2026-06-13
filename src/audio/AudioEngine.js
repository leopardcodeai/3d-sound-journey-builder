/**
 * SpatialAudioEngine
 * Manages the Web Audio API context, spatial listener pose, and sound sources with torso/ear filters.
 */
export class SpatialAudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.leftAnalyser = null;
    this.rightAnalyser = null;
    this._muted = false;
    this._lastVolume = 0.8;
    
    // Cached audio buffers: type -> AudioBuffer
    this.buffers = new Map();
    
    // Active sources: id -> { id, type, name, x, y, z, volume, isPlaying, sourceNode, shoulderFilter, pinnaFilter, pannerNode, gainNode }
    this.sources = new Map();
    
    // Physical acoustics customization variables
    this.shoulderStrength = 0.5; // 0 (none) to 1 (max -12dB notch)
    this.pinnaStrength = 0.5;    // 0 (none) to 1 (max -15dB notch)
    
    // Listener state
    this.posture = 'standing';   // 'standing', 'lying-back', 'lying-side'
    this.headTilt = 0;           // -90 to 90 degrees
    
    // Output configuration
    this.outputMode = 'hrtf';
    this.speakerPositions = null;
    this.channelCount = 2;
    
    this.isInitialized = false;
    
    this.onPoseChange = null;
    this.headTracker = null;
    
    // Cached analyser data arrays to avoid per-frame allocations
    this._leftData = null;
    this._rightData = null;
  }

  /**
   * Initializes the AudioContext on user interaction
   */
  init() {
    if (this.isInitialized) return;
    
    // Create AudioContext
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContextClass();
    
    // Set up master volume control
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.8, this.ctx.currentTime);
    
    // Set up left/right splitters and analysers for visualizers
    const splitter = this.ctx.createChannelSplitter(2);
    this.leftAnalyser = this.ctx.createAnalyser();
    this.rightAnalyser = this.ctx.createAnalyser();
    
    this.leftAnalyser.fftSize = 1024;
    this.rightAnalyser.fftSize = 1024;
    
    // Connect nodes
    this.masterGain.connect(this.ctx.destination);
    this.masterGain.connect(splitter);
    splitter.connect(this.leftAnalyser, 0, 0);
    splitter.connect(this.rightAnalyser, 1, 0);
    
    this.isInitialized = true;
    
    // Set listener orientation to defaults
    this.updateListenerPose(this.posture, this.headTilt);
    
    console.log("Spatial Audio Engine with Head/Shoulder acoustics initialized.");
  }

  /**
   * Update listener head orientation vectors based on posture and tilt
   * @param {string} posture - 'standing' (Stehend), 'lying-back' (Liegend Rücken), 'lying-side' (Liegend Seite)
   * @param {number} headTilt - Tilt angle in degrees (-90 to 90)
   */
  updateListenerPose(posture, headTilt) {
    this.posture = posture;
    this.headTilt = headTilt;
    
    if (!this.isInitialized || !this.ctx) return;
    
    const listener = this.ctx.listener;
    const rad = (headTilt * Math.PI) / 180;
    
    let fx = 0, fy = 0, fz = -1; // forward vector
    let ux = 0, uy = 1, uz = 0;  // up vector
    
    if (posture === 'standing') {
      // Standing upright: forward is looking towards grid front (negative Z)
      // Head tilt left/right tilts the up vector in the X-Y plane (roll)
      fx = 0;
      fy = 0;
      fz = -1;
      
      ux = Math.sin(rad); // tilt right (positive X) or left (negative X)
      uy = Math.cos(rad);
      uz = 0;
    } else if (posture === 'lying-back') {
      // Lying down on back: face points straight up (positive Y direction in Web Audio)
      // Top of head points backwards (positive Z direction)
      // Head tilt roll rotates the up vector in the X-Z plane
      fx = 0;
      fy = 1;
      fz = 0;
      
      ux = Math.sin(rad);
      uy = 0;
      uz = Math.cos(rad);
    } else if (posture === 'lying-side') {
      // Lying on side (e.g. right side): ears are tilted 90 degrees
      // Face points forward (negative Z)
      // Top of head points right (positive X)
      // Head tilt tilts head up/down (pitch relative to shoulders)
      fx = 0;
      fy = 0;
      fz = -1;
      
      ux = Math.cos(rad);
      uy = Math.sin(rad);
      uz = 0;
    }
    
    if (listener.forwardX) {
      // Modern Web Audio API
      listener.forwardX.setValueAtTime(fx, this.ctx.currentTime);
      listener.forwardY.setValueAtTime(fy, this.ctx.currentTime);
      listener.forwardZ.setValueAtTime(fz, this.ctx.currentTime);
      listener.upX.setValueAtTime(ux, this.ctx.currentTime);
      listener.upY.setValueAtTime(uy, this.ctx.currentTime);
      listener.upZ.setValueAtTime(uz, this.ctx.currentTime);
    } else {
      // Fallback
      listener.setOrientation(fx, fy, fz, ux, uy, uz);
    }
  }

  /**
   * Apply a full posture preset: sets posture, head tilt, shoulder & pinna strength defaults.
   * @param {string} posture - 'standing', 'lying-back', 'lying-side'
   */
  applyPosturePreset(posture) {
    const presets = {
      standing:   { shoulder: 0.5, pinna: 0.5, headTilt: 0 },
      'lying-back':  { shoulder: 0.8, pinna: 0.4, headTilt: 0 },
      'lying-side':  { shoulder: 0.9, pinna: 0.15, headTilt: -45 }
    };
    const p = presets[posture] || presets.standing;
    
    this.updateListenerPose(posture, p.headTilt);
    this.updateShoulderStrength(p.shoulder);
    this.updatePinnaStrength(p.pinna);
    
    if (this.onPoseChange) {
      this.onPoseChange({ posture, shoulderStrength: p.shoulder, pinnaStrength: p.pinna, headTilt: p.headTilt });
    }
  }

  /**
   * Set shoulder reflection filter intensity (0 to 1)
   */
  updateShoulderStrength(val) {
    this.shoulderStrength = val;
    const gainVal = -12 * val; // up to -12 dB notch
    for (const src of this.sources.values()) {
      if (src.shoulderFilter) {
        src.shoulderFilter.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      }
    }
  }

  /**
   * Set pinna spectral notch filter intensity (0 to 1)
   */
  updatePinnaStrength(val) {
    this.pinnaStrength = val;
    const gainVal = -15 * val; // up to -15 dB notch
    for (const src of this.sources.values()) {
      if (src.pinnaFilter) {
        src.pinnaFilter.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      }
    }
  }

  /**
   * Preload an audio file and cache its decoded buffer
   */
  async preloadSound(type, url) {
    try {
      if (!this.ctx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContextClass();
      }
      
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const decodedBuffer = await this.ctx.decodeAudioData(arrayBuffer);
      this.buffers.set(type, decodedBuffer);
      console.log(`Preloaded: ${type}`);
      return true;
    } catch (err) {
      console.error(`Failed to load sound "${type}" from ${url}:`, err);
      return false;
    }
  }

  /**
   * Add a custom decoded audio buffer directly (e.g., for user uploads)
   */
  addAudioBuffer(type, audioBuffer) {
    this.buffers.set(type, audioBuffer);
  }

  /**
   * Create and start playing a spatialized sound source with anatomical filters
   */
  addSource(id, type, name, x, y, z = 0, volume = 0.5) {
    if (!this.isInitialized) {
      this.init();
    }
    
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    if (type && type.startsWith('bw_')) {
      const BW_FREQS = { bw_alpha: 10, bw_beta: 20, bw_theta: 6, bw_delta: 2, bw_gamma: 40 };
      const freq = BW_FREQS[type] || 10;
      return this.createBinauralBeat(id, type, freq, x, y, z, volume);
    }

    if (type === 'music_speaker') {
      return this.createMusicSpeaker(id, name, x, y, z, volume);
    }
    
    const buffer = this.buffers.get(type) || this.buffers.get('instr_' + type);
    if (!buffer) {
      console.error(`Audio buffer for "${type}" is not preloaded!`);
      return null;
    }
    
    // 1. Create source node (buffer player)
    const sourceNode = this.ctx.createBufferSource();
    sourceNode.buffer = buffer;
    sourceNode.loop = true;
    
    // 2. Create Torso/Shoulder reflection filter (1-3 kHz notch)
    const shoulderFilter = this.ctx.createBiquadFilter();
    shoulderFilter.type = 'peaking';
    shoulderFilter.Q.value = 1.5;
    shoulderFilter.gain.value = -12 * this.shoulderStrength;
    
    // 3. Create Pinna outer ear filter (5-10 kHz notch)
    const pinnaFilter = this.ctx.createBiquadFilter();
    pinnaFilter.type = 'peaking';
    pinnaFilter.Q.value = 2.5;
    pinnaFilter.gain.value = -15 * this.pinnaStrength;
    
    // 4. Create 3D PannerNode
    const pannerNode = this.ctx.createPanner();
    pannerNode.panningModel = 'HRTF';
    pannerNode.distanceModel = 'inverse';
    pannerNode.refDistance = 1.0;
    pannerNode.maxDistance = 10000;
    pannerNode.rolloffFactor = 1.2;
    
    // 5. Create GainNode
    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(volume, this.ctx.currentTime);
    
    // Map grid positions to Web Audio coordinate space
    const webAudioX = x;
    const webAudioY = z; // height
    const webAudioZ = -y; // positive y on canvas = negative Z (forward)
    
    // Calculate and set initial filter frequencies based on elevation angle
    const d2d = Math.sqrt(x * x + y * y);
    const elevation = Math.atan2(z, d2d);
    
    const shoulderFreq = 1700 + 500 * Math.sin(elevation);
    const pinnaFreq = 7500 + 2500 * Math.sin(elevation);
    
    shoulderFilter.frequency.setValueAtTime(shoulderFreq, this.ctx.currentTime);
    pinnaFilter.frequency.setValueAtTime(pinnaFreq, this.ctx.currentTime);
    
    if (pannerNode.positionX) {
      pannerNode.positionX.setValueAtTime(webAudioX, this.ctx.currentTime);
      pannerNode.positionY.setValueAtTime(webAudioY, this.ctx.currentTime);
      pannerNode.positionZ.setValueAtTime(webAudioZ, this.ctx.currentTime);
    } else {
      pannerNode.setPosition(webAudioX, webAudioY, webAudioZ);
    }
    
    // Connect audio node graph:
    // Source -> ShoulderFilter -> PinnaFilter -> PannerNode -> GainNode -> MasterGain
    sourceNode.connect(shoulderFilter);
    shoulderFilter.connect(pinnaFilter);
    pinnaFilter.connect(pannerNode);
    pannerNode.connect(gainNode);
    gainNode.connect(this.masterGain);
    
    // Start playback
    sourceNode.start(0);
    
    const sourceData = {
      id,
      type,
      name,
      x,
      y,
      z,
      volume,
      isPlaying: true,
      sourceNode,
      shoulderFilter,
      pinnaFilter,
      pannerNode,
      gainNode
    };
    
    this.sources.set(id, sourceData);

    if (this.outputMode !== 'hrtf') {
      this._reconnectSource(sourceData);
    }

    return sourceData;
  }

  createBinauralBeat(id, type, freq, x, y, z = 0, volume = 0.3) {
    if (!this.isInitialized) this.init();

    const ctx = this.ctx;
    const carrierFreq = 200;

    const leftOsc = ctx.createOscillator();
    leftOsc.type = 'sine';
    leftOsc.frequency.value = carrierFreq;

    const rightOsc = ctx.createOscillator();
    rightOsc.type = 'sine';
    rightOsc.frequency.value = carrierFreq + freq;

    const leftGain = ctx.createGain();
    leftGain.gain.value = volume;
    const rightGain = ctx.createGain();
    rightGain.gain.value = volume;

    const merger = ctx.createChannelMerger(2);
    leftGain.connect(merger, 0, 0);
    rightGain.connect(merger, 0, 1);

    const noiseBuffer = this._createNoiseBuffer(2);
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const noiseGain = ctx.createGain();
    noiseGain.gain.value = volume * 0.3;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 600;

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(merger, 0, 0);
    noiseGain.connect(merger, 0, 1);

    const shoulderFilter = ctx.createBiquadFilter();
    shoulderFilter.type = 'peaking';
    shoulderFilter.Q.value = 1.5;
    shoulderFilter.gain.value = -12 * this.shoulderStrength;
    shoulderFilter.frequency.setValueAtTime(1700, ctx.currentTime);

    const pinnaFilter = ctx.createBiquadFilter();
    pinnaFilter.type = 'peaking';
    pinnaFilter.Q.value = 2.5;
    pinnaFilter.gain.value = -15 * this.pinnaStrength;
    pinnaFilter.frequency.setValueAtTime(7500, ctx.currentTime);

    const panner = ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 1.0;
    panner.maxDistance = 10000;
    panner.rolloffFactor = 1.2;

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(volume, ctx.currentTime);

    merger.connect(shoulderFilter);
    shoulderFilter.connect(pinnaFilter);
    pinnaFilter.connect(panner);
    panner.connect(gainNode);
    gainNode.connect(this.masterGain);

    const webAudioX = x;
    const webAudioY = z;
    const webAudioZ = -y;

    if (panner.positionX) {
      panner.positionX.setValueAtTime(webAudioX, ctx.currentTime);
      panner.positionY.setValueAtTime(webAudioY, ctx.currentTime);
      panner.positionZ.setValueAtTime(webAudioZ, ctx.currentTime);
    } else {
      panner.setPosition(webAudioX, webAudioY, webAudioZ);
    }

    leftOsc.start();
    rightOsc.start();
    noiseSource.start();

    const sourceData = {
      id, type, _bwFreq: freq, name: `${freq}Hz Brainwave`,
      x, y, z, volume, isPlaying: true,
      sourceNode: null,
      pannerNode: panner,
      shoulderFilter,
      pinnaFilter,
      gainNode,
      _oscLeft: leftOsc, _oscRight: rightOsc,
      _leftGain: leftGain, _rightGain: rightGain,
      _merger: merger,
      _noiseSource: noiseSource,
    };

    this.sources.set(id, sourceData);
    return sourceData;
  }

  createMusicSpeaker(id, name, x, y, z = 0, volume = 0.5) {
    if (!this.isInitialized) this.init();

    const ctx = this.ctx;

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 440;

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(volume * 0.15, ctx.currentTime);

    const shoulderFilter = ctx.createBiquadFilter();
    shoulderFilter.type = 'peaking';
    shoulderFilter.Q.value = 1.5;
    shoulderFilter.gain.value = -12 * this.shoulderStrength;
    shoulderFilter.frequency.setValueAtTime(1700, ctx.currentTime);

    const pinnaFilter = ctx.createBiquadFilter();
    pinnaFilter.type = 'peaking';
    pinnaFilter.Q.value = 2.5;
    pinnaFilter.gain.value = -15 * this.pinnaStrength;
    pinnaFilter.frequency.setValueAtTime(7500, ctx.currentTime);

    const panner = ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 1.0;
    panner.maxDistance = 10000;
    panner.rolloffFactor = 1.2;

    osc.connect(gainNode);
    gainNode.connect(shoulderFilter);
    shoulderFilter.connect(pinnaFilter);
    pinnaFilter.connect(panner);
    panner.connect(this.masterGain);

    const webAudioX = x;
    const webAudioY = z;
    const webAudioZ = -y;

    if (panner.positionX) {
      panner.positionX.setValueAtTime(webAudioX, ctx.currentTime);
      panner.positionY.setValueAtTime(webAudioY, ctx.currentTime);
      panner.positionZ.setValueAtTime(webAudioZ, ctx.currentTime);
    } else {
      panner.setPosition(webAudioX, webAudioY, webAudioZ);
    }

    osc.start(0);

    const sourceData = {
      id, type: 'music_speaker', name,
      x, y, z, volume, isPlaying: true,
      sourceNode: null,
      pannerNode: panner,
      shoulderFilter,
      pinnaFilter,
      gainNode,
      _oscLeft: osc, _oscRight: null,
      _noiseSource: null,
    };

    this.sources.set(id, sourceData);
    return sourceData;
  }

  _createNoiseBuffer(duration) {
    const sr = this.ctx.sampleRate;
    const length = sr * duration;
    const buffer = this.ctx.createBuffer(2, length, sr);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.5;
      }
    }
    return buffer;
  }

  /**
   * Update the spatial position of a source and adjust frequency filters accordingly
   */
  updateSourcePosition(id, x, y, z = null) {
    const src = this.sources.get(id);
    if (!src) return;
    
    src.x = x;
    src.y = y;
    if (z !== null) {
      src.z = z;
    }
    
    const webAudioX = src.x;
    const webAudioY = src.z;
    const webAudioZ = -src.y;
    
    // Calculate new elevation and update filtering cutoffs
    const d2d = Math.sqrt(src.x * src.x + src.y * src.y);
    const elevation = Math.atan2(src.z, d2d || 0.1);
    
    const shoulderFreq = 1700 + 500 * Math.sin(elevation);
    const pinnaFreq = 7500 + 2500 * Math.sin(elevation);
    
    if (src.shoulderFilter) {
      src.shoulderFilter.frequency.setValueAtTime(shoulderFreq, this.ctx.currentTime);
    }
    if (src.pinnaFilter) {
      src.pinnaFilter.frequency.setValueAtTime(pinnaFreq, this.ctx.currentTime);
    }
    
    if (src.pannerNode.positionX) {
      src.pannerNode.positionX.setValueAtTime(webAudioX, this.ctx.currentTime);
      src.pannerNode.positionY.setValueAtTime(webAudioY, this.ctx.currentTime);
      src.pannerNode.positionZ.setValueAtTime(webAudioZ, this.ctx.currentTime);
    } else {
      src.pannerNode.setPosition(webAudioX, webAudioY, webAudioZ);
    }

    if (src._useMultiChannel && this.speakerPositions) {
      for (let i = 0; i < this.speakerPositions.length; i++) {
        const sp = this.speakerPositions[i];
        if (sp.isSub) continue;
        const dist = Math.sqrt((src.x - sp.x) ** 2 + (src.y - sp.y) ** 2 + (src.z - sp.z) ** 2);
        const gain = Math.max(0, 1 / (1 + dist * 0.5));
        if (src._channelGains && src._channelGains[i]) {
          src._channelGains[i].gain.setValueAtTime(gain, this.ctx.currentTime);
        }
      }
    }
  }

  /**
   * Update the volume of a source
   */
  updateSourceVolume(id, volume) {
    const src = this.sources.get(id);
    if (!src) return;
    
    src.volume = volume;
    src.gainNode.gain.setValueAtTime(volume, this.ctx.currentTime);
  }

  /**
   * Set ramp up/down/repeat cycle for a source.
   * @param {string} id - Source identifier
   * @param {number} rampUp - Fade-in duration in seconds (0 = off)
   * @param {number} rampDown - Fade-out duration in seconds (0 = off)
   * @param {number} repeatInterval - Cycle repeat interval in seconds (0 = off)
   */
  setSourceRamp(id, rampUp, rampDown, repeatInterval) {
    const src = this.sources.get(id);
    if (!src || !this.isInitialized) return;

    src.rampUp = rampUp;
    src.rampDown = rampDown;
    src.repeatInterval = repeatInterval;

    if (src._rampTimeout) {
      clearTimeout(src._rampTimeout);
      src._rampTimeout = null;
    }

    const targetVolume = src.volume;
    const now = this.ctx.currentTime;

    if (repeatInterval > 0) {
      this._scheduleRampCycle(src, targetVolume, now);
    } else {
      src.gainNode.gain.cancelScheduledValues(now);
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
    const cycleTime = repeatInterval;

    const scheduleCycle = (cycleStart) => {
      const gain = src.gainNode.gain;

      gain.setValueAtTime(0, cycleStart);
      gain.linearRampToValueAtTime(targetVolume, cycleStart + rampUp);

      const rampDownStart = cycleStart + cycleTime - rampDown;
      gain.setValueAtTime(targetVolume, rampDownStart);
      gain.linearRampToValueAtTime(0, cycleStart + cycleTime);

      src._rampTimeout = setTimeout(() => {
        if (this.sources.has(src.id) && src.repeatInterval > 0 && src.isPlaying) {
          scheduleCycle(this.ctx.currentTime);
        }
      }, cycleTime * 1000);
    };

    scheduleCycle(startTime);
  }

  /**
   * Set the output mode and reconnect all active sources.
   * @param {string} mode - 'hrtf' or 'speakers'
   * @param {Array|null} speakerPositions - array of { x, y, z, label, angle, channel, isSub }
   * @param {number} channels - target channel count
   */
  setOutputMode(mode, speakerPositions = null, channels = 2) {
    this.outputMode = mode;
    this.speakerPositions = speakerPositions;
    this.channelCount = channels;

    for (const [id, src] of this.sources.entries()) {
      this._reconnectSource(src);
    }
  }

  _reconnectSource(src) {
    if (src._channelGains) {
      src._channelGains.forEach(g => { try { g.disconnect(); } catch(e) {} });
      src._channelGains = null;
    }
    if (src._channelMerger) {
      try { src._channelMerger.disconnect(); } catch(e) {}
      src._channelMerger = null;
    }
    src._useMultiChannel = false;

    try { src.pannerNode.disconnect(); } catch(e) {}
    try { src.gainNode.disconnect(); } catch(e) {}

    if (this.outputMode === 'hrtf') {
      src.pannerNode.panningModel = 'HRTF';
      src.pannerNode.connect(src.gainNode);
    } else if (this.outputMode === 'speakers' && this.speakerPositions) {
      if (this.speakerPositions.length === 2 && !this.speakerPositions[0].channel) {
        src.pannerNode.panningModel = 'equalpower';
        src.pannerNode.connect(src.gainNode);
      } else {
        this._setupMultiChannelSource(src);
        return;
      }
    }

    src.gainNode.connect(this.masterGain);
  }

  _setupMultiChannelSource(src) {
    const numChannels = this.channelCount || this.speakerPositions.length;

    src._channelGains = [];
    src._channelMerger = this.ctx.createChannelMerger(numChannels);

    src.pannerNode.panningModel = 'equalpower';

    for (let i = 0; i < numChannels; i++) {
      const gain = this.ctx.createGain();
      gain.gain.value = 1.0;
      src._channelGains.push(gain);
      src.pannerNode.connect(gain);
      gain.connect(src._channelMerger, 0, i);
    }

    src._channelMerger.connect(src.gainNode);
    src.gainNode.connect(this.masterGain);

    src._useMultiChannel = true;
  }

  /**
   * Pause/Play a source (recreating the BufferSource since they are single-use)
   */
  toggleSource(id, offset = 0) {
    const src = this.sources.get(id);
    if (!src) return;

    if (src.type && (src.type.startsWith('bw_') || src.type === 'music_speaker')) {
      if (src.isPlaying) {
        if (src._oscLeft) { try { src._oscLeft.stop(); } catch(e) {} }
        if (src._oscRight) { try { src._oscRight.stop(); } catch(e) {} }
        if (src._noiseSource) { try { src._noiseSource.stop(); } catch(e) {} }
        src.isPlaying = false;
      } else {
        const carrierFreq = 200;
        const freq = src._bwFreq || 10;
        if (src.type !== 'music_speaker') {
          const leftOsc = this.ctx.createOscillator();
          leftOsc.type = 'sine';
          leftOsc.frequency.value = carrierFreq;
          const rightOsc = this.ctx.createOscillator();
          rightOsc.type = 'sine';
          rightOsc.frequency.value = carrierFreq + freq;
          src._oscLeft = leftOsc;
          src._oscRight = rightOsc;
          leftOsc.connect(src._leftGain || src.gainNode);
          rightOsc.connect(src._rightGain || src.gainNode);
          leftOsc.start(0);
          rightOsc.start(0);

          const noiseBuffer = this._createNoiseBuffer(2);
          const noiseSource = this.ctx.createBufferSource();
          noiseSource.buffer = noiseBuffer;
          noiseSource.loop = true;
          const noiseGain = this.ctx.createGain();
          noiseGain.gain.value = (src.volume || 0.3) * 0.3;
          const noiseFilter = this.ctx.createBiquadFilter();
          noiseFilter.type = 'lowpass';
          noiseFilter.frequency.value = 600;
          noiseSource.connect(noiseFilter);
          noiseFilter.connect(noiseGain);
          noiseGain.connect(src._merger, 0, 0);
          noiseGain.connect(src._merger, 0, 1);
          noiseSource.start(0);
          src._noiseSource = noiseSource;
        } else {
          const osc = this.ctx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.value = 440;
          osc.connect(src.shoulderFilter);
          osc.start(0);
          src._oscLeft = osc;
        }
        src.isPlaying = true;
      }
      return src.isPlaying;
    }
    
    if (src.isPlaying) {
      src.sourceNode.stop();
      src.isPlaying = false;
    } else {
      const newSourceNode = this.ctx.createBufferSource();
      const buf = this.buffers.get(src.type);
      newSourceNode.buffer = buf;
      newSourceNode.loop = true;
      newSourceNode.connect(src.shoulderFilter); // Reconnect to shoulder filter
      const startOffset = buf && buf.duration ? offset % buf.duration : 0;
      newSourceNode.start(0, startOffset);
      
      src.sourceNode = newSourceNode;
      src.isPlaying = true;
    }
    return src.isPlaying;
  }

  /**
   * Stop and remove a source from the soundscape
   */
  removeSource(id) {
    const src = this.sources.get(id);
    if (!src) return;

    if (src._rampTimeout) {
      clearTimeout(src._rampTimeout);
      src._rampTimeout = null;
    }
    
    if (src.isPlaying) {
      try {
        src.sourceNode?.stop();
        src._oscLeft?.stop();
        src._oscRight?.stop();
        src._noiseSource?.stop();
      } catch (e) {}
    }

    if (src._channelGains) {
      src._channelGains.forEach(g => { try { g.disconnect(); } catch(e) {} });
    }
    if (src._channelMerger) {
      try { src._channelMerger.disconnect(); } catch(e) {}
    }

    src.sourceNode?.disconnect();
    src._oscLeft?.disconnect();
    src._oscRight?.disconnect();
    src._noiseSource?.disconnect();
    src._leftGain?.disconnect();
    src._rightGain?.disconnect();
    src._merger?.disconnect();
    src.shoulderFilter?.disconnect();
    src.pinnaFilter?.disconnect();
    src.pannerNode?.disconnect();
    src.gainNode?.disconnect();
    
    this.sources.delete(id);
  }

  /**
   * Set overall master volume
   */
  setMasterVolume(volume) {
    this._lastVolume = volume;
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(volume, this.ctx.currentTime);
    }
  }

  /**
   * Toggle master mute on/off, returns new muted state
   */
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

  /**
   * Retrieve left and right master output amplitudes for visualization (returns values between 0 and 1)
   */
  getLeftRightLevels() {
    if (!this.isInitialized || !this.leftAnalyser || !this.rightAnalyser) {
      return { left: 0, right: 0 };
    }
    
    if (!this._leftData) {
      this._leftData = new Uint8Array(this.leftAnalyser.fftSize);
    }
    if (!this._rightData) {
      this._rightData = new Uint8Array(this.rightAnalyser.fftSize);
    }
    
    this.leftAnalyser.getByteTimeDomainData(this._leftData);
    this.rightAnalyser.getByteTimeDomainData(this._rightData);
    
    // Calculate peak amplitude offset
    const getAmplitude = (data) => {
      let maxVal = 0;
      for (let i = 0; i < data.length; i++) {
        const val = Math.abs((data[i] - 128) / 128);
        if (val > maxVal) maxVal = val;
      }
      return maxVal;
    };
    
    return {
      left: getAmplitude(this._leftData),
      right: getAmplitude(this._rightData)
    };
  }

  /**
   * Clean up everything
   */
  destroy() {
    for (const id of this.sources.keys()) {
      this.removeSource(id);
    }
    if (this.ctx) {
      this.ctx.close();
    }
    this.isInitialized = false;
  }
}
