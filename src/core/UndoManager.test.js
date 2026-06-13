import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UndoManager, createMoveCommand, createAddCommand, createDeleteCommand, createVolumeCommand, createClipTimingCommand, createAddKeyframeCommand, createRemoveKeyframeCommand } from './UndoManager.js';

describe('UndoManager', () => {
  let undoManager;

  beforeEach(() => {
    undoManager = new UndoManager(20);
  });

  describe('initialization', () => {
    it('should start empty', () => {
      expect(undoManager.canUndo).toBe(false);
      expect(undoManager.canRedo).toBe(false);
    });

    it('should respect maxSteps', () => {
      const um = new UndoManager(3);
      for (let i = 0; i < 5; i++) {
        um.execute({ execute: vi.fn(), undo: vi.fn() });
      }
      expect(um.undoStack.length).toBe(3);
    });
  });

  describe('execute', () => {
    it('should execute command and push to undo stack', () => {
      const cmd = { execute: vi.fn(), undo: vi.fn() };
      undoManager.execute(cmd);
      expect(cmd.execute).toHaveBeenCalled();
      expect(undoManager.canUndo).toBe(true);
      expect(undoManager.canRedo).toBe(false);
    });

    it('should clear redo stack', () => {
      const cmd1 = { execute: vi.fn(), undo: vi.fn() };
      const cmd2 = { execute: vi.fn(), undo: vi.fn() };
      undoManager.execute(cmd1);
      undoManager.undo();
      expect(undoManager.canRedo).toBe(true);
      undoManager.execute(cmd2);
      expect(undoManager.canRedo).toBe(false);
    });
  });

  describe('undo', () => {
    it('should undo last command', () => {
      const cmd = { execute: vi.fn(), undo: vi.fn() };
      undoManager.execute(cmd);
      const result = undoManager.undo();
      expect(result).toBe(true);
      expect(cmd.undo).toHaveBeenCalled();
      expect(undoManager.canUndo).toBe(false);
      expect(undoManager.canRedo).toBe(true);
    });

    it('should return false when nothing to undo', () => {
      expect(undoManager.undo()).toBe(false);
    });
  });

  describe('redo', () => {
    it('should redo last undone command', () => {
      const cmd = { execute: vi.fn(), undo: vi.fn() };
      undoManager.execute(cmd);
      undoManager.undo();
      const result = undoManager.redo();
      expect(result).toBe(true);
      expect(cmd.execute).toHaveBeenCalledTimes(2);
    });

    it('should return false when nothing to redo', () => {
      expect(undoManager.redo()).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear both stacks', () => {
      const cmd = { execute: vi.fn(), undo: vi.fn() };
      undoManager.execute(cmd);
      undoManager.undo();
      undoManager.clear();
      expect(undoManager.canUndo).toBe(false);
      expect(undoManager.canRedo).toBe(false);
    });
  });
});

describe('Command helpers', () => {
  function createMockEngine() {
    const sources = new Map();
    return {
      sources,
      addSource: vi.fn((id, type, name, x, y, z, vol) => {
        const source = { id, type, name, x, y, z, volume: vol };
        sources.set(id, source);
        return source;
      }),
      removeSource: vi.fn((id) => {
        sources.delete(id);
      }),
      updateSourcePosition: vi.fn(),
      updateSourceVolume: vi.fn(),
    };
  }

  function createMockGrid() {
    return {
      selectedNodeId: null,
      automations: new Map(),
      callbacks: { onNodeSelected: vi.fn() },
    };
  }

  describe('createMoveCommand', () => {
    it('should move source on execute', () => {
      const engine = createMockEngine();
      const grid = createMockGrid();
      engine.sources.set('src1', { id: 'src1', x: 0, y: 0, z: 0 });

      const cmd = createMoveCommand(engine, grid, 'src1', 0, 0, 0, 3, 4, 2);
      cmd.execute();

      expect(engine.updateSourcePosition).toHaveBeenCalledWith('src1', 3, 4, 2);
    });

    it('should restore old position on undo', () => {
      const engine = createMockEngine();
      const grid = createMockGrid();
      engine.sources.set('src1', { id: 'src1', x: 3, y: 4, z: 2 });

      const cmd = createMoveCommand(engine, grid, 'src1', 0, 0, 0, 3, 4, 2);
      cmd.undo();

      expect(engine.updateSourcePosition).toHaveBeenCalledWith('src1', 0, 0, 0);
    });
  });

  describe('createAddCommand', () => {
    it('should add source on execute', () => {
      const engine = createMockEngine();
      const grid = createMockGrid();
      const sourceData = { id: 'src1', type: 'birds', name: 'Birds', x: 3, y: 2, z: 0, volume: 0.6 };

      const cmd = createAddCommand(engine, grid, sourceData);
      cmd.execute();

      expect(engine.addSource).toHaveBeenCalledWith('src1', 'birds', 'Birds', 3, 2, 0, 0.6);
      expect(grid.selectedNodeId).toBe('src1');
    });

    it('should remove source on undo', () => {
      const engine = createMockEngine();
      const grid = createMockGrid();
      engine.sources.set('src1', { id: 'src1' });
      const sourceData = { id: 'src1', type: 'birds', name: 'Birds', x: 3, y: 2, z: 0, volume: 0.6 };

      const cmd = createAddCommand(engine, grid, sourceData);
      cmd.undo();

      expect(engine.removeSource).toHaveBeenCalledWith('src1');
      expect(grid.selectedNodeId).toBeNull();
    });
  });

  describe('createDeleteCommand', () => {
    it('should remove source on execute', () => {
      const engine = createMockEngine();
      const grid = createMockGrid();
      engine.sources.set('src1', { id: 'src1' });
      grid.selectedNodeId = 'src1';
      const sourceData = { id: 'src1', type: 'birds', name: 'Birds', x: 3, y: 2, z: 0, volume: 0.6 };

      const cmd = createDeleteCommand(engine, grid, sourceData);
      cmd.execute();

      expect(engine.removeSource).toHaveBeenCalledWith('src1');
      expect(grid.selectedNodeId).toBeNull();
    });

    it('should restore source on undo', () => {
      const engine = createMockEngine();
      const grid = createMockGrid();
      const sourceData = { id: 'src1', type: 'birds', name: 'Birds', x: 3, y: 2, z: 0, volume: 0.6 };

      const cmd = createDeleteCommand(engine, grid, sourceData);
      cmd.undo();

      expect(engine.addSource).toHaveBeenCalledWith('src1', 'birds', 'Birds', 3, 2, 0, 0.6);
    });
  });

  describe('createVolumeCommand', () => {
    it('should update volume on execute', () => {
      const engine = createMockEngine();
      const cmd = createVolumeCommand(engine, 'src1', 0.5, 0.8);
      cmd.execute();
      expect(engine.updateSourceVolume).toHaveBeenCalledWith('src1', 0.8);
    });

    it('should restore old volume on undo', () => {
      const engine = createMockEngine();
      const cmd = createVolumeCommand(engine, 'src1', 0.5, 0.8);
      cmd.undo();
      expect(engine.updateSourceVolume).toHaveBeenCalledWith('src1', 0.5);
    });
  });

  function createMockTimeline(initialTimings = {}, initialKeyframes = {}) {
    const sourceTimings = new Map(Object.entries(initialTimings));
    const keyframes = new Map(Object.entries(initialKeyframes));
    return { visible: false, sourceTimings, keyframes, _render: vi.fn() };
  }

  describe('createClipTimingCommand', () => {
    it('should apply newTiming on execute', () => {
      const tl = createMockTimeline({ src1: { startTime: 0, duration: 100 } });
      const oldTiming = { startTime: 0, duration: 100 };
      const newTiming = { startTime: 10, duration: 80 };
      const cmd = createClipTimingCommand(tl, 'src1', oldTiming, newTiming);
      cmd.execute();
      expect(tl.sourceTimings.get('src1')).toEqual(newTiming);
    });

    it('should restore oldTiming on undo', () => {
      const tl = createMockTimeline({ src1: { startTime: 10, duration: 80 } });
      const oldTiming = { startTime: 0, duration: 100 };
      const newTiming = { startTime: 10, duration: 80 };
      const cmd = createClipTimingCommand(tl, 'src1', oldTiming, newTiming);
      cmd.undo();
      expect(tl.sourceTimings.get('src1')).toEqual(oldTiming);
    });

    it('should store copies, not references', () => {
      const tl = createMockTimeline({ src1: { startTime: 0, duration: 100 } });
      const oldTiming = { startTime: 0, duration: 100 };
      const newTiming = { startTime: 10, duration: 80 };
      const cmd = createClipTimingCommand(tl, 'src1', oldTiming, newTiming);
      cmd.execute();
      newTiming.startTime = 999;
      expect(tl.sourceTimings.get('src1').startTime).toBe(10);
    });

    it('execute/undo/redo roundtrip', () => {
      const um = new UndoManager(10);
      const tl = createMockTimeline({ src1: { startTime: 0, duration: 100 } });
      tl.sourceTimings.set('src1', { startTime: 0, duration: 100 });
      const cmd = createClipTimingCommand(tl, 'src1', { startTime: 0, duration: 100 }, { startTime: 20, duration: 60 });
      um.execute(cmd);
      expect(tl.sourceTimings.get('src1').startTime).toBe(20);
      um.undo();
      expect(tl.sourceTimings.get('src1').startTime).toBe(0);
      um.redo();
      expect(tl.sourceTimings.get('src1').startTime).toBe(20);
    });

    it('should call _render when visible', () => {
      const tl = createMockTimeline({ src1: { startTime: 0, duration: 100 } });
      tl.visible = true;
      const cmd = createClipTimingCommand(tl, 'src1', { startTime: 0, duration: 100 }, { startTime: 5, duration: 50 });
      cmd.execute();
      expect(tl._render).toHaveBeenCalled();
    });
  });

  describe('createAddKeyframeCommand', () => {
    const kf = { time: 5, x: 1, y: 2, z: 0, volume: 0.5, easing: 'linear' };

    it('should insert keyframe at index on execute', () => {
      const tl = createMockTimeline();
      const cmd = createAddKeyframeCommand(tl, 'src1', kf, 0);
      cmd.execute();
      expect(tl.keyframes.get('src1')).toEqual([kf]);
    });

    it('should remove keyframe on undo', () => {
      const tl = createMockTimeline();
      const cmd = createAddKeyframeCommand(tl, 'src1', kf, 0);
      cmd.execute();
      cmd.undo();
      expect(tl.keyframes.has('src1')).toBe(false);
    });

    it('execute/undo/redo roundtrip', () => {
      const um = new UndoManager(10);
      const tl = createMockTimeline();
      const cmd = createAddKeyframeCommand(tl, 'src1', kf, 0);
      um.execute(cmd);
      expect(tl.keyframes.get('src1').length).toBe(1);
      um.undo();
      expect(tl.keyframes.has('src1')).toBe(false);
      um.redo();
      expect(tl.keyframes.get('src1').length).toBe(1);
    });
  });

  describe('createRemoveKeyframeCommand', () => {
    const kf = { time: 5, x: 1, y: 2, z: 0, volume: 0.5, easing: 'linear' };

    it('should remove keyframe at index on execute', () => {
      const tl = createMockTimeline({}, { src1: [kf] });
      const cmd = createRemoveKeyframeCommand(tl, 'src1', kf, 0);
      cmd.execute();
      expect(tl.keyframes.has('src1')).toBe(false);
    });

    it('should restore keyframe on undo', () => {
      const tl = createMockTimeline({}, { src1: [kf] });
      const cmd = createRemoveKeyframeCommand(tl, 'src1', kf, 0);
      cmd.execute();
      cmd.undo();
      expect(tl.keyframes.get('src1')).toEqual([kf]);
    });

    it('execute/undo/redo roundtrip', () => {
      const um = new UndoManager(10);
      const tl = createMockTimeline({}, { src1: [kf] });
      const cmd = createRemoveKeyframeCommand(tl, 'src1', kf, 0);
      um.execute(cmd);
      expect(tl.keyframes.has('src1')).toBe(false);
      um.undo();
      expect(tl.keyframes.get('src1').length).toBe(1);
      um.redo();
      expect(tl.keyframes.has('src1')).toBe(false);
    });
  });
});
