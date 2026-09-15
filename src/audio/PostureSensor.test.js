import { describe, it, expect, vi } from 'vitest';
import { PostureSensor, postureFromOrientation, SETTLE_MS } from './PostureSensor.js';

describe('postureFromOrientation', () => {
  it('reads a phone held up in front of the face as standing', () => {
    expect(postureFromOrientation(90, 0)).toBe('standing');
    expect(postureFromOrientation(70, 5)).toBe('standing');
    expect(postureFromOrientation(110, -8)).toBe('standing');
  });

  it('reads a phone flat with the screen up as lying on the back', () => {
    expect(postureFromOrientation(0, 0)).toBe('lying-back');
    expect(postureFromOrientation(20, 10)).toBe('lying-back');
    expect(postureFromOrientation(-15, -5)).toBe('lying-back');
  });

  it('reads a phone on its edge as lying on the side, whatever the tilt', () => {
    // Checked before the others: on its side a phone can report almost any beta.
    for (const beta of [0, 45, 90, 135, 180]) {
      expect(postureFromOrientation(beta, 80), `beta ${beta}`).toBe('lying-side');
      expect(postureFromOrientation(beta, -80), `beta ${beta}`).toBe('lying-side');
    }
  });

  it('says nothing at a boundary instead of guessing', () => {
    expect(postureFromOrientation(42, 0)).toBeNull();
  });

  it('says nothing for an unusable reading', () => {
    for (const bad of [null, undefined, NaN, Infinity, 'x']) {
      expect(postureFromOrientation(bad, 0)).toBeNull();
      expect(postureFromOrientation(0, bad)).toBeNull();
    }
  });
});

describe('PostureSensor settling', () => {
  function makeSensor(onPosture) {
    let clock = 0;
    const s = new PostureSensor({ onPosture }, { settleMs: 500, now: () => clock });
    s.active = true;
    return { s, tick: (ms) => { clock += ms; }, at: () => clock };
  }

  it('does not report a posture that has not held long enough', () => {
    const seen = [];
    const { s, tick } = makeSensor(p => seen.push(p));
    s.handleOrientation({ beta: 90, gamma: 0 });
    tick(200);
    s.handleOrientation({ beta: 90, gamma: 0 });
    expect(seen).toEqual([]);
  });

  it('reports once the reading has held', () => {
    const seen = [];
    const { s, tick } = makeSensor(p => seen.push(p));
    s.handleOrientation({ beta: 90, gamma: 0 });
    tick(600);
    s.handleOrientation({ beta: 90, gamma: 0 });
    expect(seen).toEqual(['standing']);
  });

  it('does not report the same posture twice', () => {
    const seen = [];
    const { s, tick } = makeSensor(p => seen.push(p));
    for (let i = 0; i < 5; i++) { s.handleOrientation({ beta: 90, gamma: 0 }); tick(600); }
    expect(seen).toEqual(['standing']);
  });

  it('does not flip back and forth while the phone is moved through a boundary', () => {
    const seen = [];
    const { s, tick } = makeSensor(p => seen.push(p));
    s.handleOrientation({ beta: 90, gamma: 0 }); tick(600);
    s.handleOrientation({ beta: 90, gamma: 0 });        // standing
    // Now sweep through the boundary, as a hand does.
    for (const beta of [60, 45, 42, 30, 42, 60, 80]) {
      s.handleOrientation({ beta, gamma: 0 });
      tick(100);
    }
    expect(seen).toEqual(['standing']);
  });

  it('follows a real change that is held', () => {
    const seen = [];
    const { s, tick } = makeSensor(p => seen.push(p));
    s.handleOrientation({ beta: 90, gamma: 0 }); tick(600);
    s.handleOrientation({ beta: 90, gamma: 0 });
    s.handleOrientation({ beta: 5, gamma: 0 }); tick(600);
    s.handleOrientation({ beta: 5, gamma: 0 });
    expect(seen).toEqual(['standing', 'lying-back']);
  });

  it('ignores events once stopped', () => {
    const seen = [];
    const { s, tick } = makeSensor(p => seen.push(p));
    s.active = false;
    s.handleOrientation({ beta: 90, gamma: 0 }); tick(600);
    s.handleOrientation({ beta: 90, gamma: 0 });
    expect(seen).toEqual([]);
  });

  it('ships a settle time long enough to survive a hand moving', () => {
    expect(SETTLE_MS).toBeGreaterThanOrEqual(500);
  });

  it('stop is safe when it was never started', () => {
    const s = new PostureSensor({});
    expect(() => { s.stop(); s.stop(); }).not.toThrow();
  });
});
