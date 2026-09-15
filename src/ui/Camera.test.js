import { describe, it, expect } from 'vitest';
import { Camera } from './Camera.js';

describe('Camera', () => {
  it('top-down orthographic projection maps metres to pixels around the centre', () => {
    const cam = new Camera({ cx: 400, cy: 300, scale: 25, pitch: 90, yaw: 0, persp: 0 });
    const p = cam.project(2, 3, 0);
    expect(p.sx).toBeCloseTo(450);
    expect(p.sy).toBeCloseTo(225); // forward (+y) is up on screen
    expect(p.k).toBeCloseTo(25);
  });

  it('screenToPlane inverts project on the ground plane', () => {
    const cam = new Camera({ cx: 400, cy: 300, scale: 25, pitch: 90, yaw: 0, persp: 0 });
    const p = cam.project(-3.5, 1.25, 0);
    const back = cam.screenToPlane(p.sx, p.sy, 0);
    expect(back.x).toBeCloseTo(-3.5);
    expect(back.y).toBeCloseTo(1.25);
  });

  it('round-trips through a tilted, rotated, perspective view', () => {
    const cam = new Camera({ cx: 512, cy: 384, scale: 30, pitch: 55, yaw: 37, persp: 1, distance: 24 });
    for (const [x, y, z] of [[0, 0, 0], [4, -2, 0], [-6, 5, 2], [1.5, 8, -1]]) {
      const p = cam.project(x, y, z);
      const back = cam.screenToPlane(p.sx, p.sy, z);
      expect(back.x).toBeCloseTo(x, 3);
      expect(back.y).toBeCloseTo(y, 3);
    }
  });

  it('height raises points on screen when the camera is tilted', () => {
    const cam = new Camera({ cx: 0, cy: 0, scale: 20, pitch: 45, persp: 0 });
    const ground = cam.project(0, 0, 0);
    const high = cam.project(0, 0, 2);
    expect(high.sy).toBeLessThan(ground.sy);
    expect(cam.verticalPixelsPerMetre(0, 0, 0)).toBeGreaterThan(0);
  });

  it('height does not move points when looking straight down, and depth orders them', () => {
    const cam = new Camera({ cx: 0, cy: 0, scale: 20, pitch: 90, persp: 0 });
    const ground = cam.project(1, 1, 0);
    const high = cam.project(1, 1, 3);
    expect(high.sx).toBeCloseTo(ground.sx);
    expect(high.sy).toBeCloseTo(ground.sy);
    expect(high.depth).toBeLessThan(ground.depth); // nearer to the viewer
    expect(cam.verticalPixelsPerMetre(1, 1, 0)).toBeCloseTo(0);
  });

  it('perspective shrinks far points and grows near ones', () => {
    const cam = new Camera({ cx: 0, cy: 0, scale: 20, pitch: 45, persp: 1, distance: 20 });
    const near = cam.project(0, -6, 0);
    const far = cam.project(0, 6, 0);
    expect(near.k).toBeGreaterThan(20);
    expect(far.k).toBeLessThan(20);
  });

  it('returns null for the plane when the view is edge-on', () => {
    const cam = new Camera({ pitch: 0 });
    expect(cam.screenToPlane(10, 10, 0)).toBeNull();
  });
});
