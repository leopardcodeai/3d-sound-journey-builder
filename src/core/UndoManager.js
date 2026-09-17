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
    // Returned so an async step (a journey load that has to decode samples)
    // can still be awaited by whoever asked for it.
    const result = command.execute();
    this.undoStack.push(command);
    if (this.undoStack.length > this.maxSteps) this.undoStack.shift();
    this.redoStack = [];
    this._notify();
    return result;
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
  // The move belongs to the time the playhead showed when it happened,
  // captured once so that redo lands where undo took it from.
  const at = timeline ? timeline.playheadTime || 0 : 0;
  let snapshot = null;
  const moved = () => {
    const node = audioEngine.sources.get(nodeId);
    if (node && canvasGrid.callbacks && canvasGrid.callbacks.onNodeMoved) canvasGrid.callbacks.onNodeMoved(node);
  };
  return new Command(
    'MoveNode',
    () => {
      audioEngine.updateSourcePosition(nodeId, newX, newY, newZ);
      moved();
      // Into the keyframe at this time, or a new one there. This used to
      // rewrite the last keyframe whatever the playhead said.
      if (timeline && timeline.keyPositionAt) snapshot = timeline.keyPositionAt(nodeId, at, { x: newX, y: newY, z: newZ });
    },
    () => {
      audioEngine.updateSourcePosition(nodeId, oldX, oldY, oldZ);
      moved();
      if (timeline && snapshot && timeline.restoreKeyframes) timeline.restoreKeyframes(nodeId, snapshot);
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
          t.duration = timeline.totalDuration;
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
        // Mute and solo live in trackState, which was not cleared. Deleting the
        // only soloed track left _anySolo() true, so every remaining track
        // stayed silent with no soloed track on screen to explain it.
        if (timeline.trackState) timeline.trackState.delete(sourceData.id);
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
        // Mute and solo live in trackState, which was not cleared. Deleting the
        // only soloed track left _anySolo() true, so every remaining track
        // stayed silent with no soloed track on screen to explain it.
        if (timeline.trackState) timeline.trackState.delete(sourceData.id);
        if (timeline.visible) timeline._render();
      }
    },
    () => {
      // A generator is rebuilt from its parameters, not from a buffer, so the
      // captured gen/params/inserts have to travel with it. Without them the
      // node comes back reset to the library defaults.
      audioEngine.addSource(
        sourceData.id,
        sourceData.type,
        sourceData.name,
        sourceData.x,
        sourceData.y,
        sourceData.z,
        sourceData.volume,
        {
          gen: sourceData.gen || undefined,
          params: sourceData.params || undefined,
          inserts: sourceData.inserts || undefined,
        }
      );
      if (sourceData.rampUp || sourceData.rampDown || sourceData.repeatInterval) {
        audioEngine.setSourceRamp(sourceData.id, sourceData.rampUp || 0, sourceData.rampDown || 0, sourceData.repeatInterval || 0);
      }
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

export function createMoveKeyframeCommand(timeline, id, index, oldKf, newKf) {
  // The list stays sorted by time, so a move can change the index. Both
  // directions locate the entry by its own values.
  //
  // If nothing matches, the keyframe is gone: deleted, or replaced when a
  // journey loaded. Writing at the stored index would then overwrite an
  // unrelated keyframe, so the command does nothing instead.
  const write = (from, to) => {
    const kfs = timeline.keyframes.get(id);
    if (!kfs) return;
    // Time and volume alone are not unique: rounding on scene save can make two
    // keyframes agree on both while their positions differ. Match on position
    // too, and fall back to time+volume only when that is unambiguous.
    const exact = kfs.filter(k => k.time === from.time && k.volume === from.volume
      && k.x === from.x && k.y === from.y && k.z === from.z);
    let i = exact.length === 1 ? kfs.indexOf(exact[0]) : -1;
    if (i === -1) {
      const loose = kfs.filter(k => k.time === from.time && k.volume === from.volume);
      i = loose.length === 1 ? kfs.indexOf(loose[0]) : -1;
    }
    if (i === -1) return;
    kfs[i] = { ...to };
    kfs.sort((a, b) => a.time - b.time);
    if (timeline.visible) timeline._render();
  };
  return new Command(
    'MoveKeyframe',
    () => write(oldKf, newKf),
    () => write(newKf, oldKf)
  );
}

export function createParamCommand(audioEngine, id, key, oldValue, newValue) {
  return new Command(
    'ChangeParam',
    () => audioEngine.setSourceParam(id, key, newValue),
    () => audioEngine.setSourceParam(id, key, oldValue)
  );
}

export function createAutomationCommand(canvasGrid, id, oldAuto, newAuto) {
  const apply = (auto) => {
    if (auto) canvasGrid.setAutomation(id, auto.type, true, auto);
    else canvasGrid.automations.delete(id);
  };
  return new Command('ChangeMotion', () => apply(newAuto), () => apply(oldAuto));
}

/**
 * A whole-scene replacement as one step: a focus mode, a journey, a set, a
 * saved scene, clear all, new session. Each of those used to sweep the field
 * with no record at all, so one tap on a focus mode threw away a journey that
 * had just been built, and undo had nothing to offer. The snapshot is taken
 * once, right before the first run, so redo lands where undo took it from.
 */
export function createSceneCommand(sceneManager, label, apply) {
  if (!sceneManager || typeof sceneManager.snapshot !== 'function') return null;
  let before = null;
  return new Command(
    label || 'ReplaceScene',
    () => {
      if (!before) before = sceneManager.snapshot();
      return apply();
    },
    () => {
      if (before) return sceneManager.restore(before);
      return undefined;
    },
  );
}
