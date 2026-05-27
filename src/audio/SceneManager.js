/**
 * SceneManager - Save/Load/Share soundscape configurations
 * Uses localStorage for persistence and URL hash for sharing.
 */
export class SceneManager {
  constructor(audioEngine, canvasGrid) {
    this.audioEngine = audioEngine;
    this.canvasGrid = canvasGrid;
    this.scenes = this.loadScenes(); // Map of name -> scene data
  }
  
  // Save current soundscape as a named scene
  saveScene(name) {
    const sources = [];
    for (const [id, src] of this.audioEngine.sources.entries()) {
      sources.push({
        id, type: src.type, name: src.name,
        x: src.x, y: src.y, z: src.z, volume: src.volume,
        isPlaying: src.isPlaying
      });
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
      automations
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
      const src = this.audioEngine.addSource(s.id, s.type, s.name, s.x, s.y, s.z, s.volume);
      if (src && !s.isPlaying) {
        this.audioEngine.toggleSource(s.id);
      }
    }
    // Restore automations
    for (const [id, auto] of Object.entries(scene.automations)) {
      this.canvasGrid.setAutomation(id, auto.type, true, auto);
    }
    return true;
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
    localStorage.setItem('spatializer_scenes', JSON.stringify(data));
  }
  
  loadScenes() {
    try {
      const data = JSON.parse(localStorage.getItem('spatializer_scenes') || '{}');
      return new Map(Object.entries(data));
    } catch(e) {
      return new Map();
    }
  }
}
