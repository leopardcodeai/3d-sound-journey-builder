import { describe, it, expect } from 'vitest';
import { JOURNEYS, JOURNEY_ORDER, MODES, MODE_ORDER, SOUND_SETS, SET_ORDER, arc, hold, sessionPhases, phaseAt, modeForHour } from './Presets.js';
import { SOUND_INDEX } from './SoundLibrary.js';

describe('preset helpers', () => {
  it('arc spreads keyframes over the time range and follows the radius', () => {
    const kfs = arc({ from: 0, to: 180, radius: 4, z: 0, volume: 0.5, start: 10, end: 70, steps: 5, fadeIn: 0, fadeOut: 0 });
    expect(kfs).toHaveLength(5);
    expect(kfs[0].time).toBe(10);
    expect(kfs[4].time).toBe(70);
    expect(Math.hypot(kfs[0].x, kfs[0].y)).toBeCloseTo(4, 1);
    expect(kfs[0].x).toBeCloseTo(4, 1);
    expect(kfs[4].x).toBeCloseTo(-4, 1);
  });

  it('arc interpolates a spiral radius and a three-point volume swell', () => {
    const kfs = arc({ from: 0, to: 90, radius: [2, 8], z: [0, 4], volume: [0, 0.6, 0.2], start: 0, end: 100, steps: 3, fadeIn: 0, fadeOut: 0 });
    expect(Math.hypot(kfs[0].x, kfs[0].y)).toBeCloseTo(2, 1);
    expect(Math.hypot(kfs[2].x, kfs[2].y)).toBeCloseTo(8, 1);
    expect(kfs[0].z).toBe(0);
    expect(kfs[2].z).toBe(4);
    expect(kfs[1].volume).toBeCloseTo(0.6, 2);
    expect(kfs[2].volume).toBeCloseTo(0.2, 2);
  });

  it('hold keeps one position and walks the volume', () => {
    const kfs = hold({ at: [1, 2, 3], start: 0, end: 60, volume: [0.2, 0.5, 0.3], fadeIn: 0, fadeOut: 0 });
    expect(kfs.map(k => k.x)).toEqual([1, 1, 1]);
    expect(kfs.map(k => k.time)).toEqual([0, 30, 60]);
    expect(kfs[1].volume).toBe(0.5);
  });

  it('applyFades opens and closes the clip in silence', () => {
    const kfs = hold({ at: [0, 4, 0], start: 0, end: 100, volume: [0.6, 0.6], fadeIn: 5, fadeOut: 20 });
    expect(kfs[0].time).toBe(0);
    expect(kfs[0].volume).toBe(0);
    expect(kfs[1].time).toBe(5);
    expect(kfs[1].volume).toBeCloseTo(0.6, 2);
    expect(kfs[kfs.length - 2].time).toBe(80);
    expect(kfs[kfs.length - 1].time).toBe(100);
    expect(kfs[kfs.length - 1].volume).toBe(0);
  });

  it('applyFades samples the path so a moving source does not jump at the fade points', () => {
    const kfs = arc({ from: 0, to: 180, radius: 5, z: 0, volume: 0.5, start: 0, end: 100, steps: 5, fadeIn: 10, fadeOut: 10 });
    const first = kfs[0];
    const atFade = kfs[1];
    expect(first.time).toBe(0);
    expect(atFade.time).toBe(10);
    // 10 % of a half-circle from +x: still in the upper right quadrant
    expect(atFade.x).toBeLessThan(first.x);
    expect(atFade.y).toBeGreaterThan(0);
    expect(Math.hypot(atFade.x, atFade.y)).toBeLessThanOrEqual(5.01);
  });

  it('applyFades never lets the fades swallow a short clip', () => {
    const kfs = hold({ at: [0, 0, 0], start: 0, end: 10, volume: [0.5, 0.5], fadeIn: 30, fadeOut: 30 });
    const peak = Math.max(...kfs.map(k => k.volume));
    expect(peak).toBeCloseTo(0.5, 2);
    expect(kfs[0].volume).toBe(0);
    expect(kfs[kfs.length - 1].volume).toBe(0);
    expect(kfs.every((k, i, a) => i === 0 || k.time > a[i - 1].time)).toBe(true);
  });
});

describe('journeys', () => {
  it('lists every journey in the display order', () => {
    expect(JOURNEY_ORDER.every(id => JOURNEYS[id])).toBe(true);
    expect(Object.keys(JOURNEYS).sort()).toEqual([...JOURNEY_ORDER].sort());
  });

  it('only references sounds the library knows', () => {
    for (const [id, j] of Object.entries(JOURNEYS)) {
      for (const s of j.sources) {
        expect(SOUND_INDEX.has(s.type), `${id}: ${s.type}`).toBe(true);
      }
    }
  });

  it('keeps every clip and keyframe inside the journey duration', () => {
    for (const [id, j] of Object.entries(JOURNEYS)) {
      for (const s of j.sources) {
        expect(s.startTime, `${id}/${s.id} start`).toBeGreaterThanOrEqual(0);
        expect(s.startTime + s.duration, `${id}/${s.id} end`).toBeLessThanOrEqual(j.duration);
        for (const k of s.keyframes) {
          expect(k.time).toBeGreaterThanOrEqual(0);
          expect(k.time).toBeLessThanOrEqual(j.duration);
          expect(Math.hypot(k.x, k.y)).toBeLessThanOrEqual(10.01);
          expect(Math.abs(k.z)).toBeLessThanOrEqual(10);
          expect(k.volume).toBeGreaterThanOrEqual(0);
          expect(k.volume).toBeLessThanOrEqual(1);
        }
      }
      for (const sec of j.sections || []) {
        expect(sec.time).toBeLessThan(j.duration);
      }
    }
  });

  it('starts each source at its first keyframe position', () => {
    for (const j of Object.values(JOURNEYS)) {
      for (const s of j.sources) {
        expect(s.x).toBe(s.keyframes[0].x);
        expect(s.y).toBe(s.keyframes[0].y);
        expect(s.z).toBe(s.keyframes[0].z);
      }
    }
  });
});

describe('modes and scenes', () => {
  it('modes reference known sounds and have a length', () => {
    expect(MODE_ORDER.every(id => MODES[id])).toBe(true);
    for (const [id, m] of Object.entries(MODES)) {
      expect(m.minutes, id).toBeGreaterThan(0);
      for (const l of m.layers) expect(SOUND_INDEX.has(l.type), `${id}: ${l.type}`).toBe(true);
    }
  });

  it('sets reference known sounds', () => {
    for (const [id, s] of Object.entries(SOUND_SETS)) {
      for (const so of s.sources) expect(SOUND_INDEX.has(so.type), `${id}: ${so.type}`).toBe(true);
    }
  });

  it('every set is listed in SET_ORDER exactly once', () => {
    expect([...SET_ORDER].sort()).toEqual(Object.keys(SOUND_SETS).sort());
    expect(new Set(SET_ORDER).size).toBe(SET_ORDER.length);
  });

  it('every set carries what the drawer renders', () => {
    for (const [id, s] of Object.entries(SOUND_SETS)) {
      expect(typeof s.name, id).toBe('string');
      expect(typeof s.icon, id).toBe('string');
      expect(typeof s.summary, id).toBe('string');
      expect(s.sources.length, id).toBeGreaterThan(1);
    }
  });

  it('set source ids are unique across all sets, so two sets cannot collide', () => {
    const ids = Object.values(SOUND_SETS).flatMap(s => s.sources.map(x => x.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('set positions and levels are finite and in range', () => {
    for (const [id, s] of Object.entries(SOUND_SETS)) {
      for (const so of s.sources) {
        for (const k of ['x', 'y', 'z', 'volume']) {
          expect(Number.isFinite(so[k]), `${id}.${so.id}.${k}`).toBe(true);
        }
        expect(so.volume, `${id}.${so.id}`).toBeGreaterThan(0);
        expect(so.volume, `${id}.${so.id}`).toBeLessThanOrEqual(1);
        expect(Math.hypot(so.x, so.y), `${id}.${so.id} within the field`).toBeLessThanOrEqual(10);
      }
    }
  });
});

describe('journey envelopes', () => {
  it('reaches a useful level within the first 20 seconds', () => {
    for (const [id, j] of Object.entries(JOURNEYS)) {
      const opening = j.sources.filter(s => s.startTime === 0);
      expect(opening.length, `${id} has a source at t=0`).toBeGreaterThan(0);
      for (const s of opening) {
        const early = s.keyframes.find(k => k.time > 0 && k.time <= 20);
        expect(early, `${id}/${s.id} rises early`).toBeTruthy();
        expect(early.volume).toBeGreaterThan(0.1);
      }
    }
  });

  it('opens and closes every clip in silence', () => {
    for (const [id, j] of Object.entries(JOURNEYS)) {
      for (const s of j.sources) {
        expect(s.keyframes[0].volume, `${id}/${s.id} starts silent`).toBe(0);
        expect(s.keyframes[s.keyframes.length - 1].volume, `${id}/${s.id} ends silent`).toBe(0);
      }
    }
  });

  it('keeps keyframe times strictly increasing', () => {
    for (const [id, j] of Object.entries(JOURNEYS)) {
      for (const s of j.sources) {
        for (let i = 1; i < s.keyframes.length; i++) {
          expect(s.keyframes[i].time, `${id}/${s.id}`).toBeGreaterThan(s.keyframes[i - 1].time);
        }
      }
    }
  });
});

describe('session phases', () => {
  const mode = { minutes: 20, fadeOut: 120, taper: true };

  it('splits a session into settling, main and wind-down', () => {
    const p = sessionPhases(mode);
    expect(p.total).toBe(1200);
    expect(p.intro).toBe(90);        // capped at 90 s
    expect(p.windDown).toBe(120);    // the mode's own fade
  });

  it('caps the wind-down when a mode declares none', () => {
    const p = sessionPhases({ minutes: 60 });
    expect(p.windDown).toBe(300);    // 20 % would be 720 s, capped at 5 min
  });

  it('reports the phase and its progress', () => {
    expect(phaseAt(mode, 20, 10).id).toBe('intro');
    expect(phaseAt(mode, 20, 10).progress).toBeCloseTo(10 / 90, 3);
    expect(phaseAt(mode, 20, 600).id).toBe('sustain');
    expect(phaseAt(mode, 20, 1140).id).toBe('windDown');
    expect(phaseAt(mode, 20, 1140).progress).toBeCloseTo(0.5, 2);
    expect(phaseAt(mode, 20, 1200).progress).toBe(1);
  });

  it('suggests a mode that exists for every hour of the day', () => {
    for (let h = 0; h < 24; h++) {
      const id = modeForHour(h);
      expect(MODES[id], `hour ${h} -> ${id}`).toBeTruthy();
    }
    expect(modeForHour(23)).toBe('sleep');
    expect(modeForHour(3)).toBe('sleep');
    expect(modeForHour(9)).toBe('focus');
    expect(modeForHour(19)).toBe('calm');
  });
});
