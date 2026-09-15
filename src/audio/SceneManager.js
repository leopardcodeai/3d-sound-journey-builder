/**
 * SceneManager - Save/Load/Share soundscape configurations and sound journeys
 * (timeline keyframes + clip timings). Uses localStorage for persistence and
 * URL hash for sharing.
 */
import { getSound } from '../data/SoundLibrary.js';

const STORAGE_KEY = 'spatializer_scenes';

const round = (v, d = 2) => {
  const f = Math.pow(10, d);
  return Math.round((v || 0) * f) / f;
};

/** Drop keys whose value is null, undefined or an empty object. */
const compact = (obj) => {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) continue;
    if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) continue;
    out[k] = v;
  }
  return out;
};

export class SceneManager {
  constructor(audioEngine, canvasGrid, timeline = null) {
    this.audioEngine = audioEngine;
    this.canvasGrid = canvasGrid;
    this.timeline = timeline;
    this.scenes = this.loadScenes(); // Map of name -> scene data
  }
  
  // Save current soundscape as a named scene
  saveScene(name) {
    const scene = this._buildScene(name);
    this.scenes.set(name, scene);
    this.persistScenes();
    return scene;
  }

  /** The scene object for the current state, without storing it. */
  _buildScene(name) {
    const sources = [];
    for (const [id, src] of this.audioEngine.sources.entries()) {
      // Rounded and compacted: a shared scene travels in a URL, so every
      // needless digit costs characters.
      sources.push(compact({
        id, type: src.type, name: src.name,
        x: round(src.x), y: round(src.y), z: round(src.z), volume: round(src.volume, 3),
        isPlaying: src.isPlaying,
        // Generators are rebuilt from their parameters, not from a buffer.
        gen: src.gen || null,
        params: src.params ? { ...src.params } : null,
        inserts: src.inserts ? nonDefaultInserts(src.inserts) : null,
        // Fades and the repeat cycle live directly on the source, not in
        // inserts, so they need their own slot.
        ramp: rampOf(src),
      }));
    }
    const automations = {};
    for (const [id, auto] of this.canvasGrid.automations.entries()) {
      automations[id] = auto;
    }
    const scene = {
      name,
      masterVolume: this.audioEngine.masterGain ? this.audioEngine.masterGain.gain.value : 0.8,
      posture: this.audioEngine.posture,
      headTilt: this.audioEngine.headTilt,
      // The posture preset also sets these two, and a listener can move them
      // afterwards. Restoring the pose alone would leave the wrong filtering.
      shoulderStrength: round(this.audioEngine.shoulderStrength, 3),
      pinnaStrength: round(this.audioEngine.pinnaStrength, 3),
      sources,
      automations,
      timeline: this._captureTimeline()
    };
    return scene;
  }
  
  /**
   * Load a scene by name. Samples have to be decoded before their sources can
   * be built, so this is async; a caller that ignores the promise still gets
   * every generator, but the recorded sounds would be missing.
   */
  async loadScene(name) {
    const scene = this.scenes.get(name);
    if (!scene) return false;
    await this._preloadFor(scene);
    // Clear current state
    for (const id of Array.from(this.audioEngine.sources.keys())) {
      this.audioEngine.removeSource(id);
    }
    this.canvasGrid.automations.clear();
    // Set master volume
    this.audioEngine.setMasterVolume(scene.masterVolume);
    // Restore the pose and the anatomy filters that belong with it. Older
    // scenes have no strengths stored, so fall back to the posture preset.
    if (scene.shoulderStrength === undefined || scene.pinnaStrength === undefined) {
      this.audioEngine.applyPosturePreset(scene.posture);
      this.audioEngine.updateListenerPose(scene.posture, scene.headTilt);
    } else {
      this.audioEngine.updateListenerPose(scene.posture, scene.headTilt);
      this.audioEngine.updateShoulderStrength(scene.shoulderStrength);
      this.audioEngine.updatePinnaStrength(scene.pinnaStrength);
    }
    // Recreate sources
    for (const s of scene.sources) {
      const src = this.audioEngine.addSource(s.id, s.type, s.name, s.x, s.y, s.z, s.volume, {
        gen: s.gen || undefined,
        params: s.params || undefined,
        inserts: s.inserts || undefined,
      });
      if (src && s.ramp) {
        this.audioEngine.setSourceRamp(s.id, s.ramp.up || 0, s.ramp.down || 0, s.ramp.repeat || 0);
      }
      if (src && !s.isPlaying) {
        this.audioEngine.toggleSource(s.id);
      }
    }
    // Restore automations
    for (const [id, auto] of Object.entries(scene.automations)) {
      this.canvasGrid.setAutomation(id, auto.type, true, auto);
    }
    // Restore the journey (timeline keyframes + clip timings)
    this._restoreTimeline(scene.timeline);
    return true;
  }

  /** Decode every sample a scene needs that is not in the buffer cache yet. */
  async _preloadFor(scene) {
    if (!this.audioEngine.preloadSound) return;
    const needed = [...new Set((scene.sources || []).map(s => s.type))]
      .filter(type => {
        const def = getSound(type);
        if (def.kind !== 'sample' || !def.url) return false;
        return this.audioEngine.hasBuffer ? !this.audioEngine.hasBuffer(type) : false;
      });
    if (needed.length === 0) return;
    await Promise.all(needed.map(type => this.audioEngine.preloadSound(type, getSound(type).url)));
  }

  // Snapshot the timeline state (journey) of the current scene
  _captureTimeline() {
    if (!this.timeline) return null;
    const timings = {};
    for (const [id, t] of this.timeline.sourceTimings.entries()) {
      if (this.audioEngine.sources.has(id)) timings[id] = { startTime: round(t.startTime, 1), duration: round(t.duration, 1) };
    }
    const keyframes = {};
    for (const [id, kfs] of this.timeline.keyframes.entries()) {
      if (this.audioEngine.sources.has(id)) {
        keyframes[id] = kfs.map(kf => ({
          time: round(kf.time, 1),
          x: round(kf.x), y: round(kf.y), z: round(kf.z),
          volume: round(kf.volume, 3),
          easing: kf.easing || 'linear',
        }));
      }
    }
    const tracks = {};
    if (this.timeline.trackState) {
      for (const [id, state] of this.timeline.trackState.entries()) {
        // Only tracks that differ from the default are worth carrying.
        if (this.audioEngine.sources.has(id) && (state.muted || state.solo)) tracks[id] = { ...state };
      }
    }
    return {
      totalDuration: this.timeline.totalDuration,
      timings,
      keyframes,
      tracks,
      sections: (this.timeline.sections || []).map(s => ({ ...s })),
    };
  }

  _restoreTimeline(data) {
    if (!this.timeline) return;
    this.timeline.pause();
    this.timeline.playheadTime = 0;
    this.timeline.sourceTimings.clear();
    this.timeline.keyframes.clear();
    if (this.timeline.trackState) this.timeline.trackState.clear();
    if (data) {
      if (data.totalDuration) this.timeline.setTotalDuration(data.totalDuration);
      for (const [id, t] of Object.entries(data.timings || {})) {
        this.timeline.sourceTimings.set(id, { ...t });
      }
      for (const [id, kfs] of Object.entries(data.keyframes || {})) {
        this.timeline.setKeyframes(id, kfs);
      }
      if (this.timeline.trackState) {
        for (const [id, state] of Object.entries(data.tracks || {})) {
          this.timeline.trackState.set(id, { ...state });
        }
      }
      if (this.timeline.setSections) this.timeline.setSections(data.sections || []);
    }
    if (this.timeline.visible) this.timeline._render();
  }
  
  // Delete a scene
  deleteScene(name) { this.scenes.delete(name); this.persistScenes(); }
  
  // Get all scene names
  getSceneNames() { return Array.from(this.scenes.keys()); }
  
  // Get all scene data
  getScenes() { return this.scenes; }
  
  /**
   * A shareable link. Building the payload must not persist anything: the
   * scene list belongs to the user, not to the act of sharing.
   */
  exportToURL() {
    const data = this._buildScene('Shared Scene');
    const json = JSON.stringify(data);
    const encoded = btoa(unescape(encodeURIComponent(json)));
    const url = window.location.origin + window.location.pathname + '#scene=' + encoded;
    return url;
  }
  
  /**
   * Read a shared scene out of the URL hash and register it under a fixed
   * name. It does not load: loading needs to decode samples and the caller
   * should decide when to await that.
   * @returns {string|null} the registered name, or null if the hash was unusable
   */
  importFromURL() {
    const hash = window.location.hash;
    if (!hash.startsWith('#scene=')) return null;
    try {
      const encoded = hash.replace('#scene=', '');
      const json = decodeURIComponent(escape(atob(encoded)));
      const scene = sanitiseScene(JSON.parse(json));
      if (!scene) throw new Error('not a scene');
      scene.name = 'Shared Scene';
      this.scenes.set('Shared Scene', scene);
      this.persistScenes();
      return 'Shared Scene';
    } catch(e) {
      console.error('Failed to import scene from URL:', e);
      return null;
    }
  }
  
  // Persist to localStorage
  persistScenes() {
    const data = {};
    for (const [name, scene] of this.scenes.entries()) {
      data[name] = scene;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
  
  loadScenes() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      // Sharing used to persist a scene called "_temp" as a side effect. It
      // never belonged in the user's list, so drop it on the way in.
      delete data._temp;
      return new Map(Object.entries(data));
    } catch(e) {
      return new Map();
    }
  }
}

/**
 * Only the inserts a user actually changed. Defaults are restored on load, so
 * storing them would just pad the scene.
 */
function nonDefaultInserts(inserts) {
  const defaults = { lowpass: 20000, highpass: 20, modRate: 0, modDepth: 0, reverb: 0, rate: 1 };
  const out = {};
  for (const [key, value] of Object.entries(inserts)) {
    if (defaults[key] === undefined || Math.abs(value - defaults[key]) > 1e-6) out[key] = round(value, 3);
  }
  return out;
}

/** Fade and repeat settings, only when at least one is set. */
function rampOf(src) {
  const up = src.rampUp || 0;
  const down = src.rampDown || 0;
  const repeat = src.repeatInterval || 0;
  if (!up && !down && !repeat) return null;
  return compact({ up: up || null, down: down || null, repeat: repeat || null });
}

/** Identifiers that are safe to put in markup and to use as object keys. */
const SAFE_ID = /^[A-Za-z0-9_.:-]{1,64}$/;

const num = (v, min, max, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

/**
 * A scene from a URL is written by whoever sent the link. Reject anything that
 * is not shaped like a scene, drop sources whose id or type could break out of
 * an attribute, and clamp every number into its legal range. Display names stay
 * free text: they are escaped wherever they are rendered.
 */
export function sanitiseScene(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.sources)) return null;

  const sources = [];
  const keptIds = new Set();
  for (const s of raw.sources) {
    if (!s || typeof s !== 'object') continue;
    if (!SAFE_ID.test(String(s.id)) || !SAFE_ID.test(String(s.type))) continue;
    if (s.gen !== undefined && s.gen !== null && !SAFE_ID.test(String(s.gen))) continue;
    keptIds.add(String(s.id));
    sources.push({
      ...s,
      id: String(s.id),
      type: String(s.type),
      name: typeof s.name === 'string' ? s.name.slice(0, 64) : String(s.type),
      x: num(s.x, -10, 10, 0),
      y: num(s.y, -10, 10, 0),
      z: num(s.z, -10, 10, 0),
      volume: num(s.volume, 0, 1.5, 0.5),
      isPlaying: s.isPlaying !== false,
    });
  }
  if (sources.length === 0) return null;

  const pickKnown = (obj) => {
    const out = {};
    for (const [id, value] of Object.entries(obj || {})) if (keptIds.has(id)) out[id] = value;
    return out;
  };

  const tl = raw.timeline && typeof raw.timeline === 'object' ? raw.timeline : null;
  return {
    name: 'Shared Scene',
    masterVolume: num(raw.masterVolume, 0, 1, 0.7),
    posture: ['standing', 'lying-back', 'lying-side'].includes(raw.posture) ? raw.posture : 'standing',
    headTilt: num(raw.headTilt, -90, 90, 0),
    shoulderStrength: raw.shoulderStrength === undefined ? undefined : num(raw.shoulderStrength, 0, 1, 0.5),
    pinnaStrength: raw.pinnaStrength === undefined ? undefined : num(raw.pinnaStrength, 0, 1, 0.5),
    sources,
    automations: pickKnown(raw.automations),
    timeline: tl ? {
      totalDuration: num(tl.totalDuration, 30, 7200, 600),
      timings: pickKnown(tl.timings),
      keyframes: pickKnown(tl.keyframes),
      tracks: pickKnown(tl.tracks),
      sections: Array.isArray(tl.sections)
        ? tl.sections.slice(0, 32).map(sec => ({ time: num(sec && sec.time, 0, 7200, 0), name: String((sec && sec.name) || '').slice(0, 40) }))
        : [],
    } : null,
  };
}
