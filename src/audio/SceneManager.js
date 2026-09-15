/**
 * SceneManager - Save/Load/Share soundscape configurations and sound journeys
 * (timeline keyframes + clip timings). Uses localStorage for persistence and
 * URL hash for sharing.
 */
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
      sources,
      automations,
      timeline: this._captureTimeline()
    };
    this.scenes.set(name, scene);
    this.persistScenes();
    return scene;
  }
  
  // Load a scene by name - recreates all sources
  loadScene(name) {
    const scene = this.scenes.get(name);
    if (!scene) return false;
    // Clear current state
    for (const id of Array.from(this.audioEngine.sources.keys())) {
      this.audioEngine.removeSource(id);
    }
    this.canvasGrid.automations.clear();
    // Set master volume
    this.audioEngine.setMasterVolume(scene.masterVolume);
    // Restore posture
    this.audioEngine.updateListenerPose(scene.posture, scene.headTilt);
    // Recreate sources
    for (const s of scene.sources) {
      const src = this.audioEngine.addSource(s.id, s.type, s.name, s.x, s.y, s.z, s.volume, {
        gen: s.gen || undefined,
        params: s.params || undefined,
        inserts: s.inserts || undefined,
      });
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
  
  // Export current scene as a shareable URL hash
  exportToURL() {
    const data = this.saveScene('_temp');
    const json = JSON.stringify(data);
    const encoded = btoa(unescape(encodeURIComponent(json)));
    const url = window.location.origin + window.location.pathname + '#scene=' + encoded;
    return url;
  }
  
  // Import scene from URL hash, return scene name if loaded
  importFromURL() {
    const hash = window.location.hash;
    if (!hash.startsWith('#scene=')) return null;
    try {
      const encoded = hash.replace('#scene=', '');
      const json = decodeURIComponent(escape(atob(encoded)));
      const scene = JSON.parse(json);
      scene.name = 'Shared Scene';
      this.scenes.set('Shared Scene', scene);
      this.persistScenes();
      this.loadScene('Shared Scene');
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
