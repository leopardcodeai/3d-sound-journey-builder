export class Command {
  constructor(name, execute, undo) {
    this.name = name;
    this.execute = execute;
    this.undo = undo;
  }
}

export class UndoManager {
  constructor(maxSteps = 20) {
    this.undoStack = [];
    this.redoStack = [];
    this.maxSteps = maxSteps;
    this.onUpdate = null;
  }

  execute(command) {
    command.execute();
    this.undoStack.push(command);
    if (this.undoStack.length > this.maxSteps) this.undoStack.shift();
    this.redoStack = [];
    this._notify();
  }

  undo() {
    const cmd = this.undoStack.pop();
    if (!cmd) return false;
    cmd.undo();
    this.redoStack.push(cmd);
    this._notify();
    return true;
  }

  redo() {
    const cmd = this.redoStack.pop();
    if (!cmd) return false;
    cmd.execute();
    this.undoStack.push(cmd);
    this._notify();
    return true;
  }

  get canUndo() { return this.undoStack.length > 0; }
  get canRedo() { return this.redoStack.length > 0; }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this._notify();
  }

  _notify() {
    if (this.onUpdate) this.onUpdate({ canUndo: this.canUndo, canRedo: this.canRedo });
  }
}

export function createMoveCommand(audioEngine, canvasGrid, nodeId, oldX, oldY, oldZ, newX, newY, newZ, timeline) {
  return new Command(
    'MoveNode',
    () => {
      audioEngine.updateSourcePosition(nodeId, newX, newY, newZ);
      const node = audioEngine.sources.get(nodeId);
      if (node && canvasGrid.callbacks.onNodeMoved) {
        canvasGrid.callbacks.onNodeMoved(node);
      }
      // Sync Timeline: update last keyframe position
      if (timeline && timeline.keyframes.has(nodeId)) {
        const kfs = timeline.keyframes.get(nodeId);
        if (kfs.length > 0) {
          const lastKf = kfs[kfs.length - 1];
          lastKf.x = newX;
          lastKf.y = newY;
          lastKf.z = newZ;
        }
        if (timeline.visible) timeline._render();
      }
    },
    () => {
      audioEngine.updateSourcePosition(nodeId, oldX, oldY, oldZ);
      const node = audioEngine.sources.get(nodeId);
      if (node && canvasGrid.callbacks.onNodeMoved) {
        canvasGrid.callbacks.onNodeMoved(node);
      }
      // Sync Timeline: restore old keyframe position
      if (timeline && timeline.keyframes.has(nodeId)) {
        const kfs = timeline.keyframes.get(nodeId);
        if (kfs.length > 0) {
          const lastKf = kfs[kfs.length - 1];
          lastKf.x = oldX;
          lastKf.y = oldY;
          lastKf.z = oldZ;
        }
        if (timeline.visible) timeline._render();
      }
    }
  );
}

export function createAddCommand(audioEngine, canvasGrid, sourceData, timeline) {
  return new Command(
    'AddNode',
    () => {
      audioEngine.addSource(
        sourceData.id,
        sourceData.type,
        sourceData.name,
        sourceData.x,
        sourceData.y,
        sourceData.z,
        sourceData.volume
      );
      const node = audioEngine.sources.get(sourceData.id);
      if (node) {
        canvasGrid.selectedNodeId = sourceData.id;
        if (canvasGrid.callbacks.onNodeSelected) {
          canvasGrid.callbacks.onNodeSelected(node);
        }
      }
      // Sync Timeline
      if (timeline) {
        timeline.ensureTiming(sourceData.id);
        const t = timeline.sourceTimings.get(sourceData.id);
        if (t) {
          t.startTime = 0;
          t.duration = 600;
        }
        timeline.addKeyframe(sourceData.id, 0, { x: sourceData.x, y: sourceData.y, z: sourceData.z, volume: sourceData.volume });
        if (timeline.visible) timeline._render();
      }
    },
    () => {
      audioEngine.removeSource(sourceData.id);
      if (canvasGrid.selectedNodeId === sourceData.id) {
        canvasGrid.selectedNodeId = null;
        if (canvasGrid.callbacks.onNodeSelected) {
          canvasGrid.callbacks.onNodeSelected(null);
        }
      }
      canvasGrid.automations.delete(sourceData.id);
      // Sync Timeline
      if (timeline) {
        timeline.sourceTimings.delete(sourceData.id);
        timeline.keyframes.delete(sourceData.id);
        if (timeline.visible) timeline._render();
      }
    }
  );
}

export function createDeleteCommand(audioEngine, canvasGrid, sourceData, timeline) {
  const automation = canvasGrid.automations.has(sourceData.id)
    ? { ...canvasGrid.automations.get(sourceData.id) }
    : null;
  const timelineData = timeline ? {
    timing: timeline.sourceTimings.has(sourceData.id) ? { ...timeline.sourceTimings.get(sourceData.id) } : null,
    keyframes: timeline.keyframes.has(sourceData.id) ? [...timeline.keyframes.get(sourceData.id)] : null,
  } : null;

  return new Command(
    'DeleteNode',
    () => {
      audioEngine.removeSource(sourceData.id);
      canvasGrid.automations.delete(sourceData.id);
      if (canvasGrid.selectedNodeId === sourceData.id) {
        canvasGrid.selectedNodeId = null;
        if (canvasGrid.callbacks.onNodeSelected) {
          canvasGrid.callbacks.onNodeSelected(null);
        }
      }
      // Sync Timeline
      if (timeline) {
        timeline.sourceTimings.delete(sourceData.id);
        timeline.keyframes.delete(sourceData.id);
        if (timeline.visible) timeline._render();
      }
    },
    () => {
      audioEngine.addSource(
        sourceData.id,
        sourceData.type,
        sourceData.name,
        sourceData.x,
        sourceData.y,
        sourceData.z,
        sourceData.volume
      );
      if (automation) {
        canvasGrid.automations.set(sourceData.id, automation);
      }
      // Restore Timeline
      if (timeline && timelineData) {
        if (timelineData.timing) timeline.sourceTimings.set(sourceData.id, timelineData.timing);
        if (timelineData.keyframes) timeline.keyframes.set(sourceData.id, timelineData.keyframes);
        if (timeline.visible) timeline._render();
      }
      const node = audioEngine.sources.get(sourceData.id);
      if (node) {
        canvasGrid.selectedNodeId = sourceData.id;
        if (canvasGrid.callbacks.onNodeSelected) {
          canvasGrid.callbacks.onNodeSelected(node);
        }
      }
    }
  );
}

export function createVolumeCommand(audioEngine, nodeId, oldVolume, newVolume) {
  return new Command(
    'ChangeVolume',
    () => {
      audioEngine.updateSourceVolume(nodeId, newVolume);
    },
    () => {
      audioEngine.updateSourceVolume(nodeId, oldVolume);
    }
  );
}

export function createClipTimingCommand(timeline, id, oldTiming, newTiming) {
  return new Command(
    'ClipTiming',
    () => {
      timeline.sourceTimings.set(id, { ...newTiming });
      if (timeline.visible) timeline._render();
    },
    () => {
      timeline.sourceTimings.set(id, { ...oldTiming });
      if (timeline.visible) timeline._render();
    }
  );
}

export function createAddKeyframeCommand(timeline, id, keyframe, index) {
  return new Command(
    'AddKeyframe',
    () => {
      if (!timeline.keyframes.has(id)) timeline.keyframes.set(id, []);
      timeline.keyframes.get(id).splice(index, 0, keyframe);
      if (timeline.visible) timeline._render();
    },
    () => {
      const kfs = timeline.keyframes.get(id);
      if (!kfs) return;
      kfs.splice(index, 1);
      if (kfs.length === 0) timeline.keyframes.delete(id);
      if (timeline.visible) timeline._render();
    }
  );
}

export function createRemoveKeyframeCommand(timeline, id, keyframe, index) {
  return new Command(
    'RemoveKeyframe',
    () => {
      const kfs = timeline.keyframes.get(id);
      if (!kfs) return;
      kfs.splice(index, 1);
      if (kfs.length === 0) timeline.keyframes.delete(id);
      if (timeline.visible) timeline._render();
    },
    () => {
      if (!timeline.keyframes.has(id)) timeline.keyframes.set(id, []);
      timeline.keyframes.get(id).splice(index, 0, keyframe);
      if (timeline.visible) timeline._render();
    }
  );
}
