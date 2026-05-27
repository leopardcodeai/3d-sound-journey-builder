import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SceneManager } from './SceneManager';

const mockAudioEngine = {
  sources: new Map(),
  masterGain: { gain: { value: 0.8 } },
  posture: 'standing',
  headTilt: 0,
  removeSource: vi.fn(),
  addSource: vi.fn(() => ({ id: 'test', isPlaying: true })),
  setMasterVolume: vi.fn(),
  updateListenerPose: vi.fn(),
  toggleSource: vi.fn(),
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
    it('returns false for non-existent scene', () => {
      const result = sceneManager.loadScene('Nonexistent');
      expect(result).toBe(false);
    });

    it('restores sources from saved scene', () => {
      sceneManager.saveScene('Test Scene');
      mockAudioEngine.sources.clear();

      const result = sceneManager.loadScene('Test Scene');
      expect(result).toBe(true);
      expect(mockAudioEngine.removeSource).not.toHaveBeenCalled();
      expect(mockAudioEngine.addSource).toHaveBeenCalledTimes(2);
      expect(mockAudioEngine.addSource).toHaveBeenCalledWith(
        'src1', 'oscillator', 'Source 1', 1, 2, 3, 0.5
      );
    });

    it('removes existing sources before loading', () => {
      sceneManager.saveScene('Test Scene');

      const result = sceneManager.loadScene('Test Scene');
      expect(result).toBe(true);
      expect(mockAudioEngine.removeSource).toHaveBeenCalledWith('src1');
      expect(mockAudioEngine.removeSource).toHaveBeenCalledWith('src2');
    });

    it('sets master volume from scene', () => {
      sceneManager.saveScene('Test Scene');
      sceneManager.loadScene('Test Scene');

      expect(mockAudioEngine.setMasterVolume).toHaveBeenCalledWith(0.8);
    });

    it('restores posture and head tilt', () => {
      sceneManager.saveScene('Test Scene');
      sceneManager.loadScene('Test Scene');

      expect(mockAudioEngine.updateListenerPose).toHaveBeenCalledWith('standing', 0);
    });

    it('restores automations', () => {
      sceneManager.saveScene('Test Scene');
      sceneManager.loadScene('Test Scene');

      expect(mockCanvasGrid.setAutomation).toHaveBeenCalledWith(
        'auto1', 'pan', true, expect.objectContaining({ type: 'pan', speed: 1 })
      );
    });

    it('toggles off sources that were not playing', () => {
      sceneManager.saveScene('Test Scene');
      mockAudioEngine.sources.clear();
      mockAudioEngine.addSource.mockReturnValue({ id: 'src2', isPlaying: true });

      sceneManager.loadScene('Test Scene');

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
