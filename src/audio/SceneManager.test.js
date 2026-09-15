import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SceneManager, sanitiseScene } from './SceneManager';

const mockAudioEngine = {
  sources: new Map(),
  masterGain: { gain: { value: 0.8 } },
  posture: 'standing',
  headTilt: 0,
  shoulderStrength: 0.5,
  pinnaStrength: 0.5,
  removeSource: vi.fn(),
  addSource: vi.fn(() => ({ id: 'test', isPlaying: true })),
  setMasterVolume: vi.fn(),
  updateListenerPose: vi.fn(),
  applyPosturePreset: vi.fn(),
  updateShoulderStrength: vi.fn(),
  updatePinnaStrength: vi.fn(),
  setSourceRamp: vi.fn(),
  toggleSource: vi.fn(),
  hasBuffer: vi.fn(() => true),
  preloadSound: vi.fn(() => Promise.resolve(true)),
};

const mockCanvasGrid = {
  automations: new Map(),
  setAutomation: vi.fn(),
};

const localStorageMock = {
  store: {},
  getItem: vi.fn((key) => localStorageMock.store[key] || null),
  setItem: vi.fn((key, value) => { localStorageMock.store[key] = value; }),
  clear: vi.fn(() => { localStorageMock.store = {}; }),
};

describe('SceneManager', () => {
  let sceneManager;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    vi.stubGlobal('localStorage', localStorageMock);

    mockAudioEngine.sources.clear();
    mockAudioEngine.sources.set('src1', {
      id: 'src1', type: 'oscillator', name: 'Source 1',
      x: 1, y: 2, z: 3, volume: 0.5, isPlaying: true,
    });
    mockAudioEngine.sources.set('src2', {
      id: 'src2', type: 'player', name: 'Source 2',
      x: -1, y: 0, z: 2, volume: 0.7, isPlaying: false,
    });

    mockCanvasGrid.automations.set('auto1', { type: 'pan', speed: 1 });

    sceneManager = new SceneManager(mockAudioEngine, mockCanvasGrid);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('saveScene', () => {
    it('creates a scene with correct structure', () => {
      const scene = sceneManager.saveScene('My Scene');

      expect(scene.name).toBe('My Scene');
      expect(scene.masterVolume).toBe(0.8);
      expect(scene.posture).toBe('standing');
      expect(scene.headTilt).toBe(0);
      expect(scene.sources).toHaveLength(2);
      expect(scene.sources[0]).toMatchObject({
        id: 'src1', type: 'oscillator', name: 'Source 1',
        x: 1, y: 2, z: 3, volume: 0.5, isPlaying: true,
      });
      expect(scene.automations).toHaveProperty('auto1');
    });

    it('stores the scene in the scenes map', () => {
      sceneManager.saveScene('Test Scene');
      expect(sceneManager.scenes.has('Test Scene')).toBe(true);
    });

    it('persists scenes to localStorage', () => {
      sceneManager.saveScene('Persisted Scene');
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'spatializer_scenes',
        expect.stringContaining('Persisted Scene')
      );
    });
  });

  describe('loadScene', () => {
    it('returns false for non-existent scene', async () => {
      const result = await sceneManager.loadScene('Nonexistent');
      expect(result).toBe(false);
    });

    it('restores sources from saved scene', async () => {
      sceneManager.saveScene('Test Scene');
      mockAudioEngine.sources.clear();

      const result = await sceneManager.loadScene('Test Scene');
      expect(result).toBe(true);
      expect(mockAudioEngine.removeSource).not.toHaveBeenCalled();
      expect(mockAudioEngine.addSource).toHaveBeenCalledTimes(2);
      expect(mockAudioEngine.addSource).toHaveBeenCalledWith(
        'src1', 'oscillator', 'Source 1', 1, 2, 3, 0.5,
        expect.objectContaining({ gen: undefined, params: undefined, inserts: undefined })
      );
    });

    it('removes existing sources before loading', async () => {
      sceneManager.saveScene('Test Scene');

      const result = await sceneManager.loadScene('Test Scene');
      expect(result).toBe(true);
      expect(mockAudioEngine.removeSource).toHaveBeenCalledWith('src1');
      expect(mockAudioEngine.removeSource).toHaveBeenCalledWith('src2');
    });

    it('sets master volume from scene', async () => {
      sceneManager.saveScene('Test Scene');
      await sceneManager.loadScene('Test Scene');

      expect(mockAudioEngine.setMasterVolume).toHaveBeenCalledWith(0.8);
    });

    it('restores posture and head tilt', async () => {
      sceneManager.saveScene('Test Scene');
      await sceneManager.loadScene('Test Scene');

      expect(mockAudioEngine.updateListenerPose).toHaveBeenCalledWith('standing', 0, 0);
    });

    it('restores automations', async () => {
      sceneManager.saveScene('Test Scene');
      await sceneManager.loadScene('Test Scene');

      expect(mockCanvasGrid.setAutomation).toHaveBeenCalledWith(
        'auto1', 'pan', true, expect.objectContaining({ type: 'pan', speed: 1 })
      );
    });

    it('toggles off sources that were not playing', async () => {
      sceneManager.saveScene('Test Scene');
      mockAudioEngine.sources.clear();
      mockAudioEngine.addSource.mockReturnValue({ id: 'src2', isPlaying: true });

      await sceneManager.loadScene('Test Scene');

      expect(mockAudioEngine.toggleSource).toHaveBeenCalledWith('src2');
    });
  });

  describe('deleteScene', () => {
    it('removes a scene from the map', () => {
      sceneManager.saveScene('To Delete');
      expect(sceneManager.scenes.has('To Delete')).toBe(true);

      sceneManager.deleteScene('To Delete');
      expect(sceneManager.scenes.has('To Delete')).toBe(false);
    });

    it('persists after deletion', () => {
      sceneManager.saveScene('To Delete');
      sceneManager.deleteScene('To Delete');

      expect(localStorageMock.setItem).toHaveBeenCalled();
    });
  });

  describe('getSceneNames', () => {
    it('returns correct array of scene names', () => {
      sceneManager.saveScene('Scene A');
      sceneManager.saveScene('Scene B');

      const names = sceneManager.getSceneNames();
      expect(names).toEqual(['Scene A', 'Scene B']);
      expect(Array.isArray(names)).toBe(true);
    });

    it('returns empty array when no scenes', () => {
      const manager = new SceneManager(mockAudioEngine, mockCanvasGrid);
      expect(manager.getSceneNames()).toEqual([]);
    });
  });

  describe('journey persistence (timeline)', () => {
    function createMockTimeline() {
      return {
        totalDuration: 600,
        playheadTime: 0,
        visible: false,
        sourceTimings: new Map(),
        keyframes: new Map(),
        pause: vi.fn(),
        setTotalDuration(v) { this.totalDuration = v; },
        setKeyframes(id, kfs) { this.keyframes.set(id, kfs.map(kf => ({ ...kf }))); },
        _render: vi.fn(),
      };
    }

    it('saves and restores keyframes, clip timings and duration', async () => {
      const timeline = createMockTimeline();
      const manager = new SceneManager(mockAudioEngine, mockCanvasGrid, timeline);

      timeline.totalDuration = 300;
      timeline.sourceTimings.set('src1', { startTime: 30, duration: 120 });
      timeline.keyframes.set('src1', [
        { time: 0, x: 0, y: 0, z: 0, volume: 0.2, easing: 'linear' },
        { time: 60, x: 3, y: 2, z: 1, volume: 0.6, easing: 'ease-in' },
      ]);

      manager.saveScene('Journey');

      // Mutate live state, then load the saved journey back
      timeline.totalDuration = 600;
      timeline.sourceTimings.clear();
      timeline.keyframes.clear();

      await manager.loadScene('Journey');

      expect(timeline.pause).toHaveBeenCalled();
      expect(timeline.totalDuration).toBe(300);
      expect(timeline.sourceTimings.get('src1')).toEqual({ startTime: 30, duration: 120 });
      expect(timeline.keyframes.get('src1')).toHaveLength(2);
      expect(timeline.keyframes.get('src1')[1]).toMatchObject({ time: 60, x: 3, volume: 0.6 });
    });

    it('drops timeline entries for sources that no longer exist', () => {
      const timeline = createMockTimeline();
      const manager = new SceneManager(mockAudioEngine, mockCanvasGrid, timeline);

      timeline.keyframes.set('ghost', [{ time: 0, x: 0, y: 0, z: 0, volume: 0.5 }]);
      const scene = manager.saveScene('No Ghosts');

      expect(scene.timeline.keyframes).not.toHaveProperty('ghost');
    });

    it('clears the journey when loading a scene without timeline data', async () => {
      const timeline = createMockTimeline();
      const manager = new SceneManager(mockAudioEngine, mockCanvasGrid, timeline);

      manager.scenes.set('Legacy', {
        name: 'Legacy', masterVolume: 0.5, posture: 'standing', headTilt: 0,
        sources: [], automations: {},
      });

      timeline.keyframes.set('src1', [{ time: 0, x: 0, y: 0, z: 0, volume: 0.5 }]);
      await manager.loadScene('Legacy');

      expect(timeline.keyframes.size).toBe(0);
      expect(timeline.sourceTimings.size).toBe(0);
    });

    it('works without a timeline reference (backwards compatible)', async () => {
      const scene = sceneManager.saveScene('No Timeline');
      expect(scene.timeline).toBeNull();
      expect(await sceneManager.loadScene('No Timeline')).toBe(true);
    });
  });

  describe('persistScenes / loadScenes roundtrip', () => {
    it('saves and reloads scenes correctly', () => {
      sceneManager.saveScene('Roundtrip Scene');
      sceneManager.persistScenes();

      const newManager = new SceneManager(mockAudioEngine, mockCanvasGrid);
      expect(newManager.scenes.has('Roundtrip Scene')).toBe(true);

      const reloaded = newManager.scenes.get('Roundtrip Scene');
      expect(reloaded.name).toBe('Roundtrip Scene');
      expect(reloaded.masterVolume).toBe(0.8);
      expect(reloaded.sources).toHaveLength(2);
    });

    it('handles empty localStorage gracefully', () => {
      const manager = new SceneManager(mockAudioEngine, mockCanvasGrid);
      expect(manager.scenes).toBeInstanceOf(Map);
      expect(manager.scenes.size).toBe(0);
    });

    it('handles corrupted localStorage gracefully', () => {
      localStorageMock.store['spatializer_scenes'] = 'not valid json';

      const manager = new SceneManager(mockAudioEngine, mockCanvasGrid);
      expect(manager.scenes).toBeInstanceOf(Map);
      expect(manager.scenes.size).toBe(0);
    });
  });
});

describe('generator sources', () => {
  it('captures generator parameters and replays them on load', async () => {
    mockAudioEngine.sources.clear();
    mockAudioEngine.sources.set('bw1', {
      id: 'bw1', type: 'bw_alpha', name: 'Alpha',
      x: 0, y: 0, z: 0, volume: 0.3, isPlaying: true,
      gen: 'binaural', params: { beat: 10, carrier: 200 }, inserts: { reverb: 0.2 },
    });
    const manager = new SceneManager(mockAudioEngine, mockCanvasGrid);
    const scene = manager.saveScene('Freq');
    expect(scene.sources[0].gen).toBe('binaural');
    expect(scene.sources[0].params).toEqual({ beat: 10, carrier: 200 });

    vi.clearAllMocks();
    await manager.loadScene('Freq');
    expect(mockAudioEngine.addSource).toHaveBeenCalledWith(
      'bw1', 'bw_alpha', 'Alpha', 0, 0, 0, 0.3,
      { gen: 'binaural', params: { beat: 10, carrier: 200 }, inserts: { reverb: 0.2 } }
    );
  });

  it('stores copies so later edits do not mutate the saved scene', () => {
    mockAudioEngine.sources.clear();
    const live = { id: 'g1', type: 'tone_pure', name: 'Tone', x: 0, y: 0, z: 0, volume: 0.4, isPlaying: true, gen: 'tone', params: { freq: 432 } };
    mockAudioEngine.sources.set('g1', live);
    const manager = new SceneManager(mockAudioEngine, mockCanvasGrid);
    const scene = manager.saveScene('Tone');
    live.params.freq = 528;
    expect(scene.sources[0].params.freq).toBe(432);
  });
});

describe('scene size', () => {
  it('rounds coordinates and drops default inserts so a shared link stays short', () => {
    mockAudioEngine.sources.clear();
    mockAudioEngine.sources.set('s1', {
      id: 's1', type: 'rain', name: 'Rain',
      x: 1.23456789, y: -2.3456789, z: 0.987654, volume: 0.5123456, isPlaying: true,
      inserts: { lowpass: 20000, highpass: 20, modRate: 0, modDepth: 0, reverb: 0.25, rate: 1 },
    });
    const manager = new SceneManager(mockAudioEngine, mockCanvasGrid);
    const scene = manager.saveScene('Short');
    const src = scene.sources[0];
    expect(src.x).toBe(1.23);
    expect(src.y).toBe(-2.35);
    expect(src.volume).toBe(0.512);
    // only the insert that differs from the default survives
    expect(src.inserts).toEqual({ reverb: 0.25 });
    expect(src.gen).toBeUndefined();
    expect(src.params).toBeUndefined();
  });

  it('rounds keyframes and keeps only non-default track state', () => {
    mockAudioEngine.sources.clear();
    mockAudioEngine.sources.set('s1', { id: 's1', type: 'rain', name: 'Rain', x: 0, y: 0, z: 0, volume: 0.5, isPlaying: true });
    mockAudioEngine.sources.set('s2', { id: 's2', type: 'birds', name: 'Birds', x: 0, y: 0, z: 0, volume: 0.5, isPlaying: true });
    const timeline = {
      totalDuration: 600,
      sourceTimings: new Map([['s1', { startTime: 10.123456, duration: 100.987 }]]),
      keyframes: new Map([['s1', [{ time: 1.23456, x: 1.23456, y: 2.34567, z: 0.5, volume: 0.4567891, easing: 'linear' }]]]),
      trackState: new Map([['s1', { muted: true, solo: false }], ['s2', { muted: false, solo: false }]]),
      sections: [{ time: 0, name: 'A' }],
      pause: vi.fn(), setTotalDuration: vi.fn(), setKeyframes: vi.fn(), setSections: vi.fn(), _render: vi.fn(), visible: false,
    };
    const manager = new SceneManager(mockAudioEngine, mockCanvasGrid, timeline);
    const scene = manager.saveScene('Rounded');
    expect(scene.timeline.timings.s1).toEqual({ startTime: 10.1, duration: 101 });
    expect(scene.timeline.keyframes.s1[0]).toEqual({ time: 1.2, x: 1.23, y: 2.35, z: 0.5, volume: 0.457, easing: 'linear' });
    expect(Object.keys(scene.timeline.tracks)).toEqual(['s1']);
  });
});

describe('listener anatomy and ramps', () => {
  it('stores the filter strengths alongside the posture and restores both', async () => {
    mockAudioEngine.sources.clear();
    mockAudioEngine.posture = 'lying-side';
    mockAudioEngine.headTilt = -45;
    mockAudioEngine.shoulderStrength = 0.9;
    mockAudioEngine.pinnaStrength = 0.15;
    const manager = new SceneManager(mockAudioEngine, mockCanvasGrid);
    const scene = manager.saveScene('Side');
    expect(scene.shoulderStrength).toBe(0.9);
    expect(scene.pinnaStrength).toBe(0.15);

    vi.clearAllMocks();
    await manager.loadScene('Side');
    expect(mockAudioEngine.updateListenerPose).toHaveBeenCalledWith('lying-side', -45, 0);
    expect(mockAudioEngine.updateShoulderStrength).toHaveBeenCalledWith(0.9);
    expect(mockAudioEngine.updatePinnaStrength).toHaveBeenCalledWith(0.15);
  });

  it('falls back to the posture preset for a scene saved before strengths existed', async () => {
    const manager = new SceneManager(mockAudioEngine, mockCanvasGrid);
    manager.scenes.set('Old', {
      name: 'Old', masterVolume: 0.6, posture: 'lying-back', headTilt: 0,
      sources: [], automations: {}, timeline: null,
    });
    vi.clearAllMocks();
    await manager.loadScene('Old');
    expect(mockAudioEngine.applyPosturePreset).toHaveBeenCalledWith('lying-back');
  });

  it('carries fade and repeat settings through a round trip', async () => {
    mockAudioEngine.sources.clear();
    mockAudioEngine.sources.set('r1', {
      id: 'r1', type: 'rain', name: 'Rain', x: 0, y: 0, z: 0, volume: 0.5, isPlaying: true,
      rampUp: 5, rampDown: 8, repeatInterval: 30,
    });
    const manager = new SceneManager(mockAudioEngine, mockCanvasGrid);
    const scene = manager.saveScene('Ramped');
    expect(scene.sources[0].ramp).toEqual({ up: 5, down: 8, repeat: 30 });

    vi.clearAllMocks();
    await manager.loadScene('Ramped');
    expect(mockAudioEngine.setSourceRamp).toHaveBeenCalledWith('r1', 5, 8, 30);
  });

  it('omits the ramp slot when nothing is set', () => {
    mockAudioEngine.sources.clear();
    mockAudioEngine.sources.set('p1', { id: 'p1', type: 'rain', name: 'Rain', x: 0, y: 0, z: 0, volume: 0.5, isPlaying: true });
    const manager = new SceneManager(mockAudioEngine, mockCanvasGrid);
    expect(manager.saveScene('Plain').sources[0].ramp).toBeUndefined();
  });

  it('sharing a link does not write a scene into the list', () => {
    mockAudioEngine.sources.clear();
    const manager = new SceneManager(mockAudioEngine, mockCanvasGrid);
    manager.saveScene('Mine');
    const before = manager.getSceneNames();
    const url = manager.exportToURL();
    expect(url).toContain('#scene=');
    expect(manager.getSceneNames()).toEqual(before);
    expect(manager.getSceneNames()).not.toContain('_temp');
  });
});

describe('sample preloading', () => {
  it('decodes the samples a scene needs before rebuilding its sources', async () => {
    mockAudioEngine.sources.clear();
    mockAudioEngine.sources.set('s1', { id: 's1', type: 'rain', name: 'Rain', x: 0, y: 0, z: 0, volume: 0.5, isPlaying: true });
    mockAudioEngine.sources.set('s2', { id: 's2', type: 'bw_alpha', name: 'Alpha', x: 0, y: 0, z: 0, volume: 0.4, isPlaying: true, gen: 'binaural', params: { beat: 10 } });
    const manager = new SceneManager(mockAudioEngine, mockCanvasGrid);
    manager.saveScene('Mixed');

    vi.clearAllMocks();
    mockAudioEngine.hasBuffer.mockReturnValue(false);
    await manager.loadScene('Mixed');

    // The sample is fetched, the generator is not.
    expect(mockAudioEngine.preloadSound).toHaveBeenCalledTimes(1);
    expect(mockAudioEngine.preloadSound).toHaveBeenCalledWith('rain', '/sounds/rain.mp3');
    mockAudioEngine.hasBuffer.mockReturnValue(true);
  });

  it('does not refetch a sample that is already decoded', async () => {
    mockAudioEngine.sources.clear();
    mockAudioEngine.sources.set('s1', { id: 's1', type: 'rain', name: 'Rain', x: 0, y: 0, z: 0, volume: 0.5, isPlaying: true });
    const manager = new SceneManager(mockAudioEngine, mockCanvasGrid);
    manager.saveScene('Cached');

    vi.clearAllMocks();
    mockAudioEngine.hasBuffer.mockReturnValue(true);
    await manager.loadScene('Cached');
    expect(mockAudioEngine.preloadSound).not.toHaveBeenCalled();
  });

  it('drops a legacy _temp entry when reading storage', () => {
    // This block sits outside the main describe, so it stubs storage itself.
    localStorageMock.clear();
    localStorageMock.store.spatializer_scenes = JSON.stringify({
      _temp: { name: '_temp', sources: [] },
      Mine: { name: 'Mine', sources: [] },
    });
    vi.stubGlobal('localStorage', localStorageMock);
    const manager = new SceneManager(mockAudioEngine, mockCanvasGrid);
    expect(manager.getSceneNames()).toEqual(['Mine']);
    vi.unstubAllGlobals();
  });
});

describe('importFromURL', () => {
  const encode = (obj) => btoa(unescape(encodeURIComponent(JSON.stringify(obj))));

  beforeEach(() => {
    localStorageMock.clear();
    vi.stubGlobal('localStorage', localStorageMock);
    mockAudioEngine.sources.clear();
  });

  afterEach(() => { vi.unstubAllGlobals(); window.location.hash = ''; });

  it('registers the scene but leaves loading to the caller', () => {
    const payload = { name: 'x', masterVolume: 0.5, posture: 'standing', headTilt: 0, sources: [{ id: 'a', type: 'rain', name: 'Rain', x: 0, y: 0, z: 0, volume: 0.4, isPlaying: true }], automations: {}, timeline: null };
    window.location.hash = '#scene=' + encode(payload);
    const manager = new SceneManager(mockAudioEngine, mockCanvasGrid);
    vi.clearAllMocks();

    const name = manager.importFromURL();
    expect(name).toBe('Shared Scene');
    expect(manager.getSceneNames()).toContain('Shared Scene');
    expect(mockAudioEngine.addSource).not.toHaveBeenCalled();
  });

  it('returns null for a hash that is not a scene', () => {
    window.location.hash = '#scene=' + encode({ hello: 'world' });
    const manager = new SceneManager(mockAudioEngine, mockCanvasGrid);
    expect(manager.importFromURL()).toBeNull();
  });

  it('returns null for a hash that is not even base64 JSON', () => {
    window.location.hash = '#scene=not-base64!!';
    const manager = new SceneManager(mockAudioEngine, mockCanvasGrid);
    expect(manager.importFromURL()).toBeNull();
  });

  it('returns null when there is no scene in the hash', () => {
    window.location.hash = '#something-else';
    const manager = new SceneManager(mockAudioEngine, mockCanvasGrid);
    expect(manager.importFromURL()).toBeNull();
  });
});

describe('sanitiseScene', () => {
  const base = () => ({
    masterVolume: 0.6, posture: 'lying-back', headTilt: 10,
    sources: [{ id: 's1', type: 'rain', name: 'Rain', x: 1, y: 2, z: 0, volume: 0.5, isPlaying: true }],
    automations: {}, timeline: null,
  });

  it('keeps a well-formed scene', () => {
    const out = sanitiseScene(base());
    expect(out.sources).toHaveLength(1);
    expect(out.posture).toBe('lying-back');
    expect(out.headTilt).toBe(10);
  });

  it('drops a source whose id could break out of an attribute', () => {
    const raw = base();
    raw.sources.push({ id: 'x"><img src=x onerror=alert(1)>', type: 'rain', name: 'Evil', x: 0, y: 0, z: 0, volume: 0.5 });
    expect(sanitiseScene(raw).sources.map(s => s.id)).toEqual(['s1']);
  });

  it('drops a source whose type or generator name is not an identifier', () => {
    const raw = base();
    raw.sources.push({ id: 'ok1', type: '"><script>', name: 'A', x: 0, y: 0, z: 0, volume: 0.5 });
    raw.sources.push({ id: 'ok2', type: 'rain', gen: '"><script>', name: 'B', x: 0, y: 0, z: 0, volume: 0.5 });
    expect(sanitiseScene(raw).sources.map(s => s.id)).toEqual(['s1']);
  });

  it('clamps positions, volume, tilt and duration into range', () => {
    const raw = base();
    raw.headTilt = 9999;
    raw.masterVolume = 50;
    raw.sources[0] = { ...raw.sources[0], x: 1e9, y: -1e9, z: NaN, volume: 99 };
    raw.timeline = { totalDuration: 1e9, timings: {}, keyframes: {}, tracks: {}, sections: [] };
    const out = sanitiseScene(raw);
    expect(out.headTilt).toBe(90);
    expect(out.masterVolume).toBe(1);
    expect(out.sources[0].x).toBe(10);
    expect(out.sources[0].y).toBe(-10);
    expect(out.sources[0].z).toBe(0);
    expect(out.sources[0].volume).toBe(1.5);
    expect(out.timeline.totalDuration).toBe(7200);
  });

  it('drops timeline entries that refer to sources it rejected', () => {
    const raw = base();
    raw.timeline = {
      totalDuration: 600,
      timings: { s1: { startTime: 0, duration: 60 }, ghost: { startTime: 0, duration: 60 } },
      keyframes: { s1: [], ghost: [] },
      tracks: { ghost: { muted: true } },
      sections: [{ time: 0, name: 'A' }],
    };
    const out = sanitiseScene(raw);
    expect(Object.keys(out.timeline.timings)).toEqual(['s1']);
    expect(Object.keys(out.timeline.keyframes)).toEqual(['s1']);
    expect(out.timeline.tracks).toEqual({});
  });

  it('rejects anything that is not a scene', () => {
    expect(sanitiseScene(null)).toBeNull();
    expect(sanitiseScene({ hello: 'world' })).toBeNull();
    expect(sanitiseScene({ sources: [] })).toBeNull();
    expect(sanitiseScene({ sources: [{ id: '<bad>', type: 'rain' }] })).toBeNull();
  });

  it('truncates a very long display name but keeps it as text', () => {
    const raw = base();
    raw.sources[0].name = '<img src=x>'.repeat(50);
    const out = sanitiseScene(raw);
    expect(out.sources[0].name.length).toBe(64);
  });
});

describe('head turn in scenes (external review, 2026-09-15)', () => {
  const withTurn = (headTurn) => ({
    masterVolume: 0.6, posture: 'standing', headTilt: 0, headTurn,
    sources: [{ id: 's1', type: 'rain', name: 'Rain', x: 1, y: 2, z: 0, volume: 0.5, isPlaying: true }],
    automations: {}, timeline: null,
  });

  it('saves the head turn and restores it', async () => {
    const manager = new SceneManager(mockAudioEngine, mockCanvasGrid);
    mockAudioEngine.headTurn = 90;
    mockAudioEngine.headTilt = 12;
    mockAudioEngine.posture = 'standing';
    manager.saveScene('turned');
    const stored = JSON.parse(localStorage.getItem('spatializer_scenes')).turned;
    expect(stored.headTurn).toBe(90);

    mockAudioEngine.updateListenerPose.mockClear();
    await manager.loadScene('turned');
    expect(mockAudioEngine.updateListenerPose).toHaveBeenCalledWith('standing', 12, 90);
  });

  it('clamps a hostile head turn out of a stored scene', () => {
    expect(Math.abs(sanitiseScene(withTurn(1e9)).headTurn)).toBeLessThanOrEqual(180);
    expect(Math.abs(sanitiseScene(withTurn(-1e9)).headTurn)).toBeLessThanOrEqual(180);
    expect(Number.isFinite(sanitiseScene(withTurn(NaN)).headTurn)).toBe(true);
    expect(sanitiseScene(withTurn(45)).headTurn).toBe(45);
  });

  it('gives an older scene without a head turn a defined value', () => {
    const old = withTurn(undefined);
    delete old.headTurn;
    expect(sanitiseScene(old).headTurn).toBe(0);
  });
});
