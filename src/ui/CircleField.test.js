import { describe, it, expect, vi } from 'vitest';
import { CircleField, layout, easedStops, makeRandom } from './CircleField.js';

describe('easedStops', () => {
  it('is quadratic, which is what makes a flat circle read as lit', () => {
    for (const [t, a] of easedStops()) {
      expect(a).toBeCloseTo(t * t, 6);
    }
  });

  it('runs from fully transparent to fully opaque', () => {
    const s = easedStops();
    expect(s[0]).toEqual([0, 0]);
    expect(s[s.length - 1]).toEqual([1, 1]);
  });

  it('rises monotonically, so no stop undoes the one before it', () => {
    const s = easedStops();
    for (let i = 1; i < s.length; i++) expect(s[i][1]).toBeGreaterThan(s[i - 1][1]);
  });

  it('is not linear, which is the mistake this replaces', () => {
    const mid = easedStops().find(([t]) => Math.abs(t - 0.5) < 0.06);
    expect(mid[1]).toBeLessThan(0.35);
  });
});

describe('makeRandom', () => {
  it('gives the same sequence for the same seed', () => {
    const a = makeRandom(7), b = makeRandom(7);
    for (let i = 0; i < 20; i++) expect(a()).toBe(b());
  });

  it('gives a different sequence for a different seed', () => {
    expect(makeRandom(7)()).not.toBe(makeRandom(8)());
  });

  it('stays inside 0 and 1', () => {
    const r = makeRandom(99);
    for (let i = 0; i < 500; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('survives a zero seed instead of locking at zero', () => {
    const r = makeRandom(0);
    const vals = [r(), r(), r()];
    expect(new Set(vals).size).toBe(3);
  });
});

describe('layout', () => {
  const f = layout(20260915, 18);

  it('places the requested number of circles', () => {
    expect(f.circles.length).toBe(18);
  });

  it('gathers the circles around the centre rather than scattering them', () => {
    for (const c of f.circles) {
      expect(Math.abs(c.x - 0.5)).toBeLessThanOrEqual(0.34);
      expect(Math.abs(c.y - 0.5)).toBeLessThanOrEqual(0.34);
    }
  });

  it('keeps every radius inside the narrow band that reads as one organism', () => {
    for (const c of f.circles) {
      expect(c.r).toBeGreaterThanOrEqual(0.07);
      expect(c.r).toBeLessThanOrEqual(0.13);
    }
  });

  it('quantises opacity to three tiers rather than spreading it', () => {
    const tiers = new Set(f.circles.map(c => c.tier));
    for (const t of tiers) expect([0.3, 0.6, 1.0]).toContain(t);
    expect(tiers.size).toBeLessThanOrEqual(3);
  });

  it('lights every circle from its own angle, with no global direction', () => {
    const angles = f.circles.map(c => c.angle);
    expect(new Set(angles).size).toBe(angles.length);
  });

  it('mixes filled and stroked circles, which is what makes the lattice', () => {
    const stroked = f.circles.filter(c => c.stroke).length;
    expect(stroked).toBeGreaterThan(0);
    expect(stroked).toBeLessThan(f.circles.length);
  });

  it('keeps the dots far smaller than the circle band', () => {
    for (const d of f.dots) expect(d.r).toBeLessThan(0.07 / 10);
  });

  it('is deterministic, so a resize does not reshuffle the composition', () => {
    expect(layout(20260915, 18)).toEqual(layout(20260915, 18));
  });

  it('produces only finite numbers, so nothing reaches canvas as NaN', () => {
    for (const c of f.circles) {
      for (const k of ['x', 'y', 'r', 'angle', 'driftX', 'driftY', 'driftRate', 'spin', 'phase']) {
        expect(Number.isFinite(c[k]), `${k}`).toBe(true);
      }
    }
  });
});

function mockCanvas(w = 300, h = 300) {
  const calls = { fill: 0, stroke: 0, gradients: 0, stops: [] };
  const grad = () => {
    calls.gradients++;
    return { addColorStop: (t, c) => calls.stops.push([t, c]) };
  };
  const ctx = {
    clearRect: vi.fn(), beginPath: vi.fn(), arc: vi.fn(), save: vi.fn(),
    restore: vi.fn(), translate: vi.fn(), scale: vi.fn(),
    setTransform: vi.fn(), fillRect: vi.fn(),
    globalCompositeOperation: 'source-over',
    fill: () => { calls.fill++; }, stroke: () => { calls.stroke++; },
    createLinearGradient: grad, createRadialGradient: grad,
  };
  return {
    calls,
    canvas: {
      width: w, height: h, style: {},
      getContext: () => ctx,
      getBoundingClientRect: () => ({ width: w, height: h, left: 0, top: 0 }),
    },
  };
}

describe('CircleField drawing', () => {
  it('draws once on construction, so it is never blank before the first frame', () => {
    const { canvas, calls } = mockCanvas();
    vi.stubGlobal('window', { devicePixelRatio: 1 });
    new CircleField(canvas);
    expect(calls.fill + calls.stroke).toBeGreaterThan(0);
  });

  it('emits the quadratic ramp as real gradient stops', () => {
    const { canvas, calls } = mockCanvas();
    vi.stubGlobal('window', { devicePixelRatio: 1 });
    new CircleField(canvas);
    const offsets = calls.stops.map(([t]) => t);
    expect(offsets).toContain(0);
    expect(offsets).toContain(1);
    expect(calls.gradients).toBeGreaterThan(1);
  });

  it('clamps intensity instead of passing a bad value into alpha', () => {
    const { canvas } = mockCanvas();
    vi.stubGlobal('window', { devicePixelRatio: 1 });
    const f = new CircleField(canvas);
    f.setIntensity(5); expect(f._target).toBe(1);
    f.setIntensity(-2); expect(f._target).toBe(0);
    f.setIntensity(NaN); expect(f._target).toBe(0);
    f.setIntensity(undefined); expect(f._target).toBe(0);
  });

  it('never writes a colour containing NaN', () => {
    const { canvas, calls } = mockCanvas();
    vi.stubGlobal('window', { devicePixelRatio: 1 });
    const f = new CircleField(canvas);
    f.setIntensity(0.5);
    f.draw();
    for (const [, colour] of calls.stops) expect(String(colour)).not.toContain('NaN');
  });

  it('does nothing dangerous when the box has no size yet', () => {
    const { canvas } = mockCanvas(0, 0);
    canvas.getBoundingClientRect = () => ({ width: 0, height: 0, left: 0, top: 0 });
    canvas.width = 0; canvas.height = 0;
    vi.stubGlobal('window', { devicePixelRatio: 1 });
    expect(() => new CircleField(canvas)).not.toThrow();
  });

  it('stop is safe to call when it was never started', () => {
    const { canvas } = mockCanvas();
    vi.stubGlobal('window', { devicePixelRatio: 1 });
    const f = new CircleField(canvas);
    expect(() => { f.stop(); f.stop(); f.destroy(); }).not.toThrow();
  });
});
