import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Timeline } from './Timeline.js';

function createMockAudioEngine() {
  return {
    sources: new Map(),
    ctx: { currentTime: 0 },
    masterGain: { gain: { value: 0.8, setValueAtTime: vi.fn(), cancelScheduledValues: vi.fn(), linearRampToValueAtTime: vi.fn() } },
    updateSourcePosition: vi.fn(),
    updateSourceVolume: vi.fn(),
    toggleSource: vi.fn(),
  };
}

function createMockCanvasGrid() {
  return { colorFor: () => '#10b981', selectedNodeId: null };
}

function addSource(engine, id, overrides = {}) {
  const src = {
    id, type: 'birds', name: id,
    x: 0, y: 0, z: 0, volume: 0.5, isPlaying: true, spatial: true,
    gainNode: { gain: { setTargetAtTime: vi.fn() } },
    ...overrides,
  };
  engine.sources.set(id, src);
  return src;
}

describe('Timeline', () => {
  let container, audioEngine, canvasGrid, timeline;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    audioEngine = createMockAudioEngine();
    canvasGrid = createMockCanvasGrid();
    timeline = new Timeline(container, audioEngine, canvasGrid);
  });

  describe('initialisation', () => {
    it('starts paused, looping and hidden', () => {
      expect(timeline.visible).toBe(false);
      expect(timeline.isPlaying).toBe(false);
      expect(timeline.isLooping).toBe(true);
      expect(timeline.totalDuration).toBe(600);
      expect(timeline.snap).toBe(true);
    });

    it('builds the transport and the lane area', () => {
      expect(container.querySelector('.tl-bar')).toBeTruthy();
      expect(container.querySelector('.tl-viewport')).toBeTruthy();
      expect(container.querySelector('.tl-play')).toBeTruthy();
      expect(container.querySelector('.tl-playhead')).toBeTruthy();
    });
  });

  describe('visibility', () => {
    it('toggles and marks the body so other panels can dodge it', () => {
      document.body.classList.remove('timeline-open');
      timeline.show();
      expect(timeline.visible).toBe(true);
      expect(document.body.classList.contains('timeline-open')).toBe(true);
      timeline.hide();
      expect(document.body.classList.contains('timeline-open')).toBe(false);
    });

    it('pauses when hidden', () => {
      timeline.show();
      timeline.play();
      timeline.hide();
      expect(timeline.isPlaying).toBe(false);
    });
  });

  describe('transport', () => {
    it('toggles play state and swaps the button icon', () => {
      timeline.togglePlay();
      expect(timeline.isPlaying).toBe(true);
      expect(container.querySelector('.tl-play').classList.contains('is-on')).toBe(true);
      timeline.togglePlay();
      expect(timeline.isPlaying).toBe(false);
    });

    it('stop rewinds the playhead', () => {
      timeline.playheadTime = 120;
      timeline.stop();
      expect(timeline.playheadTime).toBe(0);
      expect(timeline.isPlaying).toBe(false);
    });

    it('setLooping switches the loop button between the two modes', () => {
      const btn = container.querySelector('.tl-loop');
      expect(btn.classList.contains('is-on')).toBe(true);
      timeline.setLooping(false);
      expect(timeline.isLooping).toBe(false);
      expect(btn.classList.contains('is-on')).toBe(false);
      expect(btn.title.toLowerCase()).toContain('once');
      timeline.setLooping(true);
      expect(btn.classList.contains('is-on')).toBe(true);
    });
  });

  describe('time and zoom', () => {
    it('timeToX follows pixelsPerSecond, the header width and the scroll', () => {
      timeline.pixelsPerSecond = 2;
      timeline.scrollX = 40;
      timeline._headerW = 100;
      expect(timeline.timeToX(0)).toBe(60);
      expect(timeline.timeToX(30)).toBe(120);
    });

    it('snaps to a coarser step when zoomed out', () => {
      timeline.pixelsPerSecond = 30;
      expect(timeline.snapStep()).toBe(0.5);
      timeline.pixelsPerSecond = 2;
      expect(timeline.snapStep()).toBe(15);
      timeline.setSnap(false);
      expect(timeline.snapStep()).toBe(0);
      expect(timeline._snapTime(12.34)).toBeCloseTo(12.3, 5);
    });

    it('clamps the scroll to the content width', () => {
      timeline.scrollX = -500;
      timeline._clampScroll();
      expect(timeline.scrollX).toBe(0);
      timeline.scrollX = 1e6;
      timeline._clampScroll();
      expect(timeline.scrollX).toBeLessThan(1e6);
    });

    it('zoom stays inside the allowed range', () => {
      for (let i = 0; i < 40; i++) timeline.zoom(2);
      expect(timeline.pixelsPerSecond).toBeLessThanOrEqual(60);
      for (let i = 0; i < 60; i++) timeline.zoom(0.5);
      expect(timeline.pixelsPerSecond).toBeGreaterThanOrEqual(0.6);
    });
  });

  describe('timings and duration', () => {
    it('gives new sounds the whole journey and does not overwrite existing timings', () => {
      timeline.ensureTiming('s1');
      expect(timeline.sourceTimings.get('s1')).toEqual({ startTime: 0, duration: 600 });
      timeline.sourceTimings.set('s2', { startTime: 30, duration: 120 });
      timeline.ensureTiming('s2');
      expect(timeline.sourceTimings.get('s2')).toEqual({ startTime: 30, duration: 120 });
    });

    it('shrinking the journey clamps clips, keyframes, sections and the playhead', () => {
      timeline.sourceTimings.set('s1', { startTime: 200, duration: 400 });
      timeline.setKeyframes('s1', [{ time: 0, x: 0, y: 0, z: 0, volume: 0.5 }, { time: 500, x: 1, y: 1, z: 0, volume: 0.5 }]);
      timeline.setSections([{ time: 100, name: 'A' }, { time: 450, name: 'B' }]);
      timeline.playheadTime = 500;
      timeline.setTotalDuration(300);
      expect(timeline.totalDuration).toBe(300);
      expect(timeline.playheadTime).toBe(300);
      expect(timeline.sourceTimings.get('s1')).toEqual({ startTime: 200, duration: 100 });
      expect(timeline.keyframes.get('s1')[1].time).toBe(300);
      expect(timeline.sections.map(s => s.name)).toEqual(['A']);
    });
  });

  describe('keyframes', () => {
    it('inserts in sorted order', () => {
      addSource(audioEngine, 's1', { x: 1, y: 1 });
      timeline.setKeyframes('s1', [{ time: 60, x: 3, y: 0, z: 0, volume: 0.5 }]);
      timeline.addKeyframe('s1', 30, { x: 1, y: 1 });
      expect(timeline.keyframes.get('s1').map(k => k.time)).toEqual([30, 60]);
    });

    it('addKeyframeAt snaps the time and records an undo step', () => {
      addSource(audioEngine, 's1');
      const undo = { execute: vi.fn(cmd => cmd.execute()) };
      timeline.undoManager = undo;
      timeline.pixelsPerSecond = 2; // snap step 15 s
      timeline.addKeyframeAt('s1', 37);
      expect(undo.execute).toHaveBeenCalled();
      expect(timeline.keyframes.get('s1')[0].time).toBe(30);
    });

    it('removes by index and drops empty lists', () => {
      timeline.setKeyframes('s1', [
        { time: 0, x: 0, y: 0, z: 0, volume: 0.5 },
        { time: 60, x: 3, y: 2, z: 1, volume: 0.6 },
      ]);
      timeline.removeKeyframe('s1', 0);
      expect(timeline.keyframes.get('s1')[0].time).toBe(60);
      timeline.removeKeyframe('s1', 0);
      expect(timeline.keyframes.has('s1')).toBe(false);
      expect(() => timeline.removeKeyframe('missing', 0)).not.toThrow();
    });

    it('renders each track with only its own keyframe dots', () => {
      addSource(audioEngine, 's1');
      addSource(audioEngine, 's2', { type: 'campfire' });
      timeline.setKeyframes('s1', [{ time: 0, x: 0, y: 0, z: 0, volume: 0.5 }, { time: 60, x: 1, y: 1, z: 0, volume: 0.5 }]);
      timeline.setKeyframes('s2', [{ time: 30, x: 0, y: 0, z: 0, volume: 0.5 }, { time: 90, x: 1, y: 1, z: 0, volume: 0.5 }, { time: 150, x: 2, y: 2, z: 0, volume: 0.5 }]);
      timeline.show();
      timeline.pixelsPerSecond = 4;
      timeline._render();
      expect(container.querySelector('.tl-track[data-id="s1"]').querySelectorAll('.tl-kf').length).toBe(2);
      expect(container.querySelector('.tl-track[data-id="s2"]').querySelectorAll('.tl-kf').length).toBe(3);
      expect(container.querySelectorAll('.tl-env').length).toBe(2);
    });
  });

  describe('easing and sampling', () => {
    it('eases linearly by default', () => {
      expect(timeline._ease(0.5, 'linear')).toBe(0.5);
      expect(timeline._ease(0.5, 'ease-in')).toBe(0.25);
      expect(timeline._ease(0.5, 'ease-out')).toBe(0.75);
      expect(timeline._ease(0.25, 'ease-in-out')).toBeCloseTo(0.125, 5);
    });

    it('holds the first and last keyframe outside the range', () => {
      const kfs = [
        { time: 10, x: 1, y: 1, z: 0, volume: 0.2, easing: 'linear' },
        { time: 20, x: 3, y: 3, z: 2, volume: 0.6, easing: 'linear' },
      ];
      expect(timeline._sampleKeyframes(kfs, 0).x).toBe(1);
      expect(timeline._sampleKeyframes(kfs, 99).x).toBe(3);
      const mid = timeline._sampleKeyframes(kfs, 15);
      expect(mid.x).toBeCloseTo(2);
      expect(mid.volume).toBeCloseTo(0.4);
    });
  });

  describe('mute and solo', () => {
    it('mute silences one track', () => {
      const s = addSource(audioEngine, 's1');
      timeline.toggleMute('s1');
      timeline._applyKeyframes();
      const calls = s.gainNode.gain.setTargetAtTime.mock.calls;
      expect(calls[calls.length - 1][0]).toBe(0);
      timeline.toggleMute('s1');
      timeline._applyKeyframes();
      const after = s.gainNode.gain.setTargetAtTime.mock.calls;
      expect(after[after.length - 1][0]).toBeCloseTo(0.5);
    });

    it('solo silences every other track', () => {
      const a = addSource(audioEngine, 's1');
      const b = addSource(audioEngine, 's2');
      timeline.toggleSolo('s1');
      timeline._applyKeyframes();
      const aCalls = a.gainNode.gain.setTargetAtTime.mock.calls;
      const bCalls = b.gainNode.gain.setTargetAtTime.mock.calls;
      expect(aCalls[aCalls.length - 1][0]).toBeCloseTo(0.5);
      expect(bCalls[bCalls.length - 1][0]).toBe(0);
    });
  });

  describe('playback', () => {
    it('drives position and gain from interpolated keyframes', () => {
      const s = addSource(audioEngine, 's1');
      timeline.sourceTimings.set('s1', { startTime: 0, duration: 600 });
      timeline.setKeyframes('s1', [
        { time: 0, x: 0, y: 0, z: 0, volume: 0 },
        { time: 10, x: 2, y: 4, z: 1, volume: 1 },
      ]);
      timeline.playheadTime = 5;
      timeline._applyKeyframes();
      expect(audioEngine.updateSourcePosition).toHaveBeenCalledWith('s1', 1, 2, 0.5);
      const calls = s.gainNode.gain.setTargetAtTime.mock.calls;
      expect(calls[calls.length - 1][0]).toBeCloseTo(0.5);
    });

    it('never repositions a head-locked source', () => {
      addSource(audioEngine, 'bw', { spatial: false });
      timeline.setKeyframes('bw', [{ time: 0, x: 5, y: 5, z: 0, volume: 0.4 }]);
      timeline.playheadTime = 1;
      timeline._applyKeyframes();
      expect(audioEngine.updateSourcePosition).not.toHaveBeenCalled();
    });

    it('mutes sources outside their clip window and starts them with an offset', () => {
      const s = addSource(audioEngine, 's1', { isPlaying: false });
      timeline.sourceTimings.set('s1', { startTime: 30, duration: 60 });
      timeline.playheadTime = 0;
      timeline._applyKeyframes();
      let calls = s.gainNode.gain.setTargetAtTime.mock.calls;
      expect(calls[calls.length - 1][0]).toBe(0);
      timeline.playheadTime = 45;
      timeline._applyKeyframes();
      expect(audioEngine.toggleSource).toHaveBeenCalledWith('s1', 15);
    });

    it('marks keyframed sources as timeline-controlled only while playing', () => {
      const s = addSource(audioEngine, 's1');
      timeline.setKeyframes('s1', [
        { time: 0, x: 0, y: 0, z: 0, volume: 0.5 },
        { time: 10, x: 1, y: 1, z: 0, volume: 0.5 },
      ]);
      timeline.isPlaying = true;
      timeline._applyKeyframes();
      expect(s._timelineControlled).toBe(true);
      timeline.pause();
      expect(s._timelineControlled).toBe(false);
    });

    it('reports progress through onTimeUpdate', () => {
      const spy = vi.fn();
      timeline.onTimeUpdate = spy;
      timeline.playheadTime = 42;
      timeline._applyKeyframes();
      expect(spy).toHaveBeenCalledWith(42, 600);
    });
  });

  describe('sections', () => {
    it('renders section markers in the ruler', () => {
      addSource(audioEngine, 's1');
      timeline.setSections([{ time: 0, name: 'Settle' }, { time: 120, name: 'Work' }]);
      timeline.show();
      timeline.pixelsPerSecond = 2;
      timeline._render();
      const marks = [...container.querySelectorAll('.tl-section span')].map(el => el.textContent);
      expect(marks).toEqual(['Settle', 'Work']);
    });
  });
});

describe('Timeline drag safety', () => {
  let container, audioEngine, canvasGrid, timeline;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    audioEngine = createMockAudioEngine();
    canvasGrid = createMockCanvasGrid();
    timeline = new Timeline(container, audioEngine, canvasGrid);
    addSource(audioEngine, 's1');
    timeline.setKeyframes('s1', [
      { time: 0, x: 0, y: 0, z: 0, volume: 0.5 },
      { time: 60, x: 1, y: 1, z: 0, volume: 0.5 },
    ]);
    timeline.show();
    timeline.pixelsPerSecond = 4;
    timeline._render();
  });

  it('ends a drag when the pointer reports the button is no longer down', () => {
    const kf = container.querySelector('.tl-kf[data-kf-index="1"]');
    kf.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 100, clientY: 20, pointerId: 1, button: 0 }));
    expect(timeline._drag).toBeTruthy();
    // A move that arrives with no button held means the release happened
    // somewhere we never saw.
    window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 300, clientY: 20, pointerId: 1, buttons: 0 }));
    expect(timeline._drag).toBeNull();
  });

  it('ends a drag on pointercancel', () => {
    const kf = container.querySelector('.tl-kf[data-kf-index="1"]');
    kf.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 100, clientY: 20, pointerId: 1, button: 0 }));
    window.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: 1 }));
    expect(timeline._drag).toBeNull();
  });

  it('ends a drag when the window loses focus', () => {
    const kf = container.querySelector('.tl-kf[data-kf-index="1"]');
    kf.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 100, clientY: 20, pointerId: 1, button: 0 }));
    window.dispatchEvent(new Event('blur'));
    expect(timeline._drag).toBeNull();
  });

  it('keeps dragging while the button is held', () => {
    const kf = container.querySelector('.tl-kf[data-kf-index="1"]');
    kf.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 100, clientY: 20, pointerId: 1, button: 0 }));
    window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 140, clientY: 20, pointerId: 1, buttons: 1 }));
    expect(timeline._drag).toBeTruthy();
    expect(timeline.keyframes.get('s1')[1].time).not.toBe(60);
  });

  it('escapes a source id so it cannot break out of the track attribute', () => {
    addSource(audioEngine, 'x"><img src=y onerror=alert(1)>');
    timeline._render();
    expect(container.querySelector('.tl-tracks img')).toBeNull();
    expect(container.querySelectorAll('.tl-track').length).toBe(2);
  });
});

describe('accessible names on the transport and the tracks (live test, 2026-09-15)', () => {
  let engine, grid, tl, host;

  beforeEach(() => {
    document.body.innerHTML = '<div id="dock"></div>';
    host = document.getElementById('dock');
    engine = createMockAudioEngine();
    grid = createMockCanvasGrid();
    tl = new Timeline(host, engine, grid);
    tl.visible = true;          // _render returns early otherwise
  });

  it('keeps the transport name in step with the state it shows', () => {
    const btn = host.querySelector('.tl-play');
    tl._setPlayIcon(false);
    expect(btn.getAttribute('aria-label')).toBe(btn.title);
    const stopped = btn.getAttribute('aria-label');
    tl._setPlayIcon(true);
    // While playing, the button offers Pause. It used to say Pause in the
    // tooltip and Play to a screen reader at the same time.
    expect(btn.getAttribute('aria-label')).toBe(btn.title);
    expect(btn.getAttribute('aria-label')).not.toBe(stopped);
  });

  it('names solo and mute after their own track', () => {
    addSource(engine, 't1', { name: 'Singing bowl' });
    addSource(engine, 't2', { name: 'Wind chimes' });
    tl.ensureTiming('t1');
    tl.ensureTiming('t2');
    tl._render();

    const solos = [...host.querySelectorAll('.tl-solo')].map(b => b.getAttribute('aria-label'));
    const mutes = [...host.querySelectorAll('.tl-mute')].map(b => b.getAttribute('aria-label'));
    expect(solos).toHaveLength(2);
    // Six buttons called S and M told a screen reader nothing about which row.
    expect(new Set(solos).size).toBe(2);
    expect(new Set(mutes).size).toBe(2);
    for (const label of [...solos, ...mutes]) {
      expect(label).toBeTruthy();
      expect(label).not.toContain('{name}');
    }
    expect(solos.some(l => l.includes('Singing bowl'))).toBe(true);
    expect(mutes.some(l => l.includes('Wind chimes'))).toBe(true);
  });

  it('reports solo and mute as pressed states, not just as styling', () => {
    addSource(engine, 't1', { name: 'Singing bowl' });
    tl.ensureTiming('t1');
    tl._render();
    expect(host.querySelector('.tl-solo').getAttribute('aria-pressed')).toBe('false');
    tl.toggleSolo('t1');
    tl._render();
    expect(host.querySelector('.tl-solo').getAttribute('aria-pressed')).toBe('true');
  });

  it('keeps the full track name reachable when the column truncates it', () => {
    addSource(engine, 't1', { name: 'A very long sound name that will not fit' });
    tl.ensureTiming('t1');
    tl._render();
    const el = host.querySelector('.tl-name');
    expect(el.getAttribute('title')).toBe('A very long sound name that will not fit');
  });
});
