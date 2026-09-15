import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FocusView } from './FocusView.js';
import { MODES } from '../data/Presets.js';

function createEngine() {
  const sources = new Map();
  return {
    sources,
    isInitialized: true,
    ctx: { currentTime: 0 },
    masterGain: { gain: { value: 0.5, setValueAtTime: vi.fn(), cancelScheduledValues: vi.fn(), linearRampToValueAtTime: vi.fn() } },
    init: vi.fn(),
    resume: vi.fn(() => Promise.resolve()),
    setMasterVolume: vi.fn(),
    removeSource: vi.fn(id => sources.delete(id)),
    updateSourceVolume: vi.fn(),
    toggleSource: vi.fn(),
    getLeftRightLevels: () => ({ left: 0, right: 0 }),
    setSourceParam: vi.fn((id, key, value) => {
      const s = sources.get(id);
      if (s) s.params[key] = value;
      return value;
    }),
    addSource: vi.fn((id, type, name, x, y, z, volume, opts = {}) => {
      const src = { id, type, name, x, y, z, volume, isPlaying: true, params: { ...(opts.params || {}) }, gen: null, spatial: true };
      if (type.startsWith('noise')) src.gen = 'noise';
      if (type.startsWith('bw_')) { src.gen = 'binaural'; src.spatial = false; }
      if (type === 'breath') { src.gen = 'breath'; src.spatial = false; }
      if (type === 'pad') src.gen = 'pad';
      if (type === 'drone') src.gen = 'drone';
      if (type.startsWith('iso_')) src.gen = 'isochronic';
      if (type.startsWith('tone')) src.gen = 'tone';
      sources.set(id, src);
      return src;
    }),
    describeSession() {
      const out = { frequency: [], ambient: [], headLocked: false, breath: null };
      for (const s of sources.values()) {
        out.frequency.push(s);
        if (s.gen === 'breath') out.breath = s;
      }
      return out;
    },
  };
}

describe('FocusView', () => {
  let root, engine, view;

  beforeEach(() => {
    root = document.createElement('div');
    document.body.appendChild(root);
    engine = createEngine();
    view = new FocusView(root, engine, {});
  });

  it('applies a mode as one layer per entry', async () => {
    await view.applyMode('focus');
    expect(engine.sources.size).toBe(MODES.focus.layers.length);
    expect(view.minutes).toBe(MODES.focus.minutes);
    expect(engine.setMasterVolume).toHaveBeenCalledWith(MODES.focus.masterVolume);
  });

  it('renders a select, not a range, for a parameter with fixed options', async () => {
    await view.applyMode('focus');
    view.show();
    const noiseLayer = [...root.querySelectorAll('.focus-layer')]
      .find(el => el.querySelector('[data-key="color"]'));
    expect(noiseLayer, 'noise layer present').toBeTruthy();
    const control = noiseLayer.querySelector('[data-key="color"]');
    expect(control.tagName).toBe('SELECT');
    expect(control.value).toBe('pink');
    expect(root.innerHTML).not.toContain('NaN');
  });

  it('shows the band and the beat in the readout', async () => {
    await view.applyMode('focus');
    view.show();
    const text = root.querySelector('.focus-readout').textContent;
    expect(text).toMatch(/Alpha/);
    expect(text).toMatch(/10\.0 Hz/);
  });

  it('marks one mode as suggested for the current hour', async () => {
    view.show();
    expect(root.querySelectorAll('.focus-mode-badge').length).toBe(1);
  });

  it('tapers generator parameters during the wind-down and restores them after', async () => {
    await view.applyMode('calm');
    const beatSource = [...engine.sources.values()].find(s => s.params.beat !== undefined);
    const startBeat = beatSource.params.beat;
    view._applyTaper(1);
    expect(beatSource.params.beat).toBeLessThan(startBeat);
    view._restoreParams();
    expect(beatSource.params.beat).toBe(startBeat);
  });

  it('does not carry a taper from one session into the next', async () => {
    await view.applyMode('calm');
    view._applyTaper(1);
    await view.applyMode('focus');
    const beatSource = [...engine.sources.values()].find(s => s.params.beat !== undefined);
    expect(beatSource.params.beat).toBe(10);
    expect(view._tapered).toBe(false);
  });

  it('escapes layer names', async () => {
    await view.applyMode('focus');
    const first = [...engine.sources.values()][0];
    first.name = '<img src=x onerror=alert(1)>';
    view.renderLayers();
    expect(root.querySelector('.focus-layer img')).toBeNull();
  });
});

describe('FocusView session state', () => {
  let root, engine, view;

  beforeEach(() => {
    root = document.createElement('div');
    document.body.appendChild(root);
    engine = createEngine();
    view = new FocusView(root, engine, {});
  });

  it('clears the fade flag when a new mode starts', async () => {
    await view.applyMode('sleep');
    view._fadeStarted = true;          // as if a wind-down had begun
    await view.applyMode('calm');
    expect(view._fadeStarted).toBe(false);
    // applyMode starts the session, so elapsed is at the very beginning
    // rather than exactly zero.
    expect(view.elapsed).toBeLessThan(0.5);
  });

  it('clears the fade flag and restores the level when paused mid-fade', async () => {
    await view.applyMode('sleep');
    view.start();
    view._fadeStarted = true;
    view.pause();
    expect(view._fadeStarted).toBe(false);
    expect(engine.masterGain.gain.cancelScheduledValues).toHaveBeenCalled();
  });

  it('escapes a source id in the layer controls', async () => {
    await view.applyMode('focus');
    const first = [...engine.sources.values()][0];
    engine.sources.delete(first.id);
    first.id = 'x"><img src=y onerror=alert(1)>';
    engine.sources.set(first.id, first);
    view.renderLayers();
    expect(root.querySelector('.focus-layers img')).toBeNull();
  });
});
