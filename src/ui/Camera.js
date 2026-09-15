/**
 * Camera
 * Projection math for the spatial view. World space is metres with X to the
 * right, Y forward (in front of the listener) and Z up. The camera orbits the
 * origin: `yaw` rotates around Z, `pitch` is the elevation above the ground
 * plane (90 = straight down, i.e. the 2D map), `persp` blends between an
 * orthographic projection (0) and a perspective one (1) so the 2D/3D switch
 * can morph instead of cut.
 *
 * All values are plain numbers; the view that owns the camera animates them.
 */
export class Camera {
  constructor(opts = {}) {
    this.yaw = opts.yaw ?? 0;           // degrees
    this.pitch = opts.pitch ?? 90;      // degrees, 90 = top-down
    this.persp = opts.persp ?? 0;       // 0..1
    this.distance = opts.distance ?? 26; // metres from the target (perspective)
    this.scale = opts.scale ?? 25;      // px per metre at the target depth
    this.cx = opts.cx ?? 0;             // screen centre x (already includes pan)
    this.cy = opts.cy ?? 0;
  }

  /** Bulk-assign view parameters. */
  set(view) {
    Object.assign(this, view);
    return this;
  }

  _trig() {
    const yr = (this.yaw * Math.PI) / 180;
    const pr = (this.pitch * Math.PI) / 180;
    return { cy: Math.cos(yr), sy: Math.sin(yr), cp: Math.cos(pr), sp: Math.sin(pr) };
  }

  /**
   * World point -> camera-space { right, up, depth } in metres.
   * depth grows away from the viewer; the target sits at depth 0.
   */
  toCamera(x, y, z = 0) {
    const { cy, sy, cp, sp } = this._trig();
    const x1 = x * cy - y * sy;
    const y1 = x * sy + y * cy;
    return {
      right: x1,
      up: y1 * sp + z * cp,
      depth: y1 * cp - z * sp,
    };
  }

  /** Perspective scale factor for a camera-space depth (1 at the target). */
  _k(depth) {
    if (this.persp <= 0) return this.scale;
    const denom = Math.max(0.5, this.distance + depth);
    const p = this.distance / denom;
    return this.scale * (1 + (p - 1) * this.persp);
  }

  /**
   * Project a world point to screen pixels.
   * @returns {{sx:number, sy:number, k:number, depth:number}}
   *   k is the pixel-per-metre factor at that point (use it to scale sprites).
   */
  project(x, y, z = 0) {
    const c = this.toCamera(x, y, z);
    const k = this._k(c.depth);
    return { sx: this.cx + c.right * k, sy: this.cy - c.up * k, k, depth: c.depth };
  }

  /**
   * Inverse of project() onto the horizontal plane z = z0. Used for dragging
   * nodes: the pointer moves the node on the plane of its current height.
   * Returns null when the view is edge-on and the plane is degenerate.
   */
  screenToPlane(sx, sy, z0 = 0) {
    const { cy, sy: syaw, cp, sp } = this._trig();
    if (Math.abs(sp) < 1e-3) return null;
    let k = this.scale;
    let x1 = 0, y1 = 0;
    // Orthographic solve, then refine the perspective factor a few times.
    const iterations = this.persp > 0 ? 5 : 1;
    for (let i = 0; i < iterations; i++) {
      const right = (sx - this.cx) / k;
      const up = (this.cy - sy) / k;
      x1 = right;
      y1 = (up - z0 * cp) / sp;
      const depth = y1 * cp - z0 * sp;
      k = this._k(depth);
    }
    return {
      x: x1 * cy + y1 * syaw,
      y: -x1 * syaw + y1 * cy,
    };
  }

  /**
   * How many screen pixels one metre of height covers at a point, used for
   * vertical (z) dragging. Zero when looking straight down.
   */
  verticalPixelsPerMetre(x, y, z = 0) {
    const a = this.project(x, y, z);
    const b = this.project(x, y, z + 1);
    return a.sy - b.sy;
  }
}

/** Linear interpolation helper shared by the view animations. */
export function lerp(a, b, t) { return a + (b - a) * t; }
