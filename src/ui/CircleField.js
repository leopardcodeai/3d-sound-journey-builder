/**
 * CircleField: the slow, quiet backdrop behind the focus orb.
 *
 * The field view is an instrument and shows numbers everywhere. The focus view
 * is the opposite half of the brief and needs a surface that reads as calm
 * without turning into decoration that fights the controls. This is that
 * surface.
 *
 * The construction is taken from a measurement of Endel's own artwork rather
 * than invented: a field of flat overlapping circles, each filled with a linear
 * gradient at its own angle, over one wide elliptical glow, on the page ground.
 * Three details make it read as lit volume rather than as flat discs, and all
 * three are easy to get wrong:
 *
 *  1. The alpha ramp is quadratic, not linear. Measured across ten stops, their
 *     gradients follow alpha = t^2 to within 0.01. A plain two-stop gradient
 *     looks like a disc; this looks like a sphere.
 *  2. The radii sit in a narrow band, 7 to 13 per cent of the canvas width. Wide
 *     variation reads as scattered bubbles; a tight band reads as one organism.
 *  3. Every circle is lit from its own angle. There is no global light
 *     direction, which is what stops it looking like a rendered 3D scene.
 *
 * Opacity is quantised to three steps rather than left continuous, for the same
 * reason: three tiers read as depth, a continuous spread reads as noise.
 *
 * Nothing here is audio-reactive. Endel's is not either, and an analyser would
 * tie a calm surface to transient peaks. Intensity is a slow scalar the caller
 * sets.
 */

/** Circle radii as a fraction of canvas width. */
const R_MIN = 0.07;
const R_MAX = 0.13;

/** The three tiers a circle's opacity can take. */
const TIERS = [0.3, 0.6, 1.0];

/**
 * A small deterministic generator, so a given seed always lays the field out
 * the same way. Math.random would make the result untestable and would reshuffle
 * the composition on every resize.
 */
export function makeRandom(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;  s >>>= 0;
    return s / 4294967296;
  };
}

/**
 * The quadratic alpha ramp. Returns [t, alpha] pairs to feed as gradient stops.
 * Ten stops is what the measured original uses; fewer starts to band on a large
 * circle, more buys nothing.
 */
export function easedStops(steps = 10) {
  const out = [];
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    out.push([t, t * t]);
  }
  return out;
}

/**
 * Lays out the field. Pure, so the composition can be asserted in a test
 * without a canvas. Returns circles in world units where x and y are fractions
 * of width and height, and r is a fraction of width.
 */
export function layout(seed, count, aspect = 1) {
  const rnd = makeRandom(seed);
  const circles = [];
  for (let i = 0; i < count; i++) {
    const r = R_MIN + rnd() * (R_MAX - R_MIN);
    circles.push({
      x: 0.5 + (rnd() - 0.5) * 0.66,
      y: 0.5 + (rnd() - 0.5) * 0.66 * (1 / aspect),
      r,
      angle: rnd() * Math.PI * 2,
      tier: TIERS[Math.floor(rnd() * TIERS.length)],
      // Drift is per-circle and slow. Two different rates per circle keep the
      // field from ever repeating a pose within a session.
      driftX: (rnd() - 0.5) * 0.012,
      driftY: (rnd() - 0.5) * 0.012,
      driftRate: 0.06 + rnd() * 0.10,
      spin: (rnd() - 0.5) * 0.06,
      phase: rnd() * Math.PI * 2,
      // Some circles are drawn as a hairline ring rather than a fill, which is
      // what gives the original its lattice quality where they overlap.
      stroke: rnd() < 0.42,
    });
  }
  // A handful of small dots, well under the radius band, read as stars.
  const dots = [];
  for (let i = 0; i < 4; i++) {
    dots.push({ x: rnd(), y: rnd(), r: 0.0014 + rnd() * 0.0008 });
  }
  return { circles, dots };
}

export class CircleField {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {Object} opts colour (css colour of the circles), seed, count
   */
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext ? canvas.getContext('2d') : null;
    this.colour = opts.colour || '255, 246, 236';
    this.seed = opts.seed || 20260915;
    this.count = opts.count || 18;
    this.intensity = 0;
    this._target = 0;
    this.w = 0;
    this.h = 0;
    this.t = 0;
    this._raf = null;
    this._last = 0;
    this._field = layout(this.seed, this.count);
    this._reduced = typeof matchMedia === 'function'
      && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.resize();
  }

  resize() {
    const c = this.canvas;
    const rect = c.getBoundingClientRect ? c.getBoundingClientRect() : null;
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    const w = rect && rect.width > 0 ? rect.width : (c.width || 300);
    const h = rect && rect.height > 0 ? rect.height : (c.height || 300);
    this.w = w;
    this.h = h;
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    if (this.ctx && this.ctx.setTransform) this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._field = layout(this.seed, this.count, w / (h || 1));
    this.draw();
  }

  /** 0 is a still, dim field; 1 is the running state. Eased, never stepped. */
  setIntensity(v) {
    this._target = Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
  }

  start() {
    if (this._raf !== null) return;
    this._last = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const loop = () => {
      this._raf = requestAnimationFrame(loop);
      const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      const dt = Math.min(0.1, (now - this._last) / 1000);
      this._last = now;
      // A still field would look broken, so time advances even at rest, just
      // slowly. Reduced motion holds it completely.
      if (!this._reduced) this.t += dt * (0.25 + this.intensity * 0.75);
      this.intensity += (this._target - this.intensity) * Math.min(1, dt * 1.6);
      this.draw();
    };
    this._raf = requestAnimationFrame(loop);
  }

  stop() {
    if (this._raf === null) return;
    if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this._raf);
    this._raf = null;
  }

  draw() {
    const ctx = this.ctx;
    if (!ctx || !this.w || !this.h) return;
    const { w, h } = this;
    ctx.clearRect(0, 0, w, h);

    const lit = 0.25 + this.intensity * 0.75;

    // One wide elliptical glow, half the canvas in each axis.
    if (ctx.createRadialGradient) {
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.scale(1, h / w || 1);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, w / 2);
      g.addColorStop(0, `rgba(${this.colour}, ${0.09 * lit})`);
      g.addColorStop(1, `rgba(${this.colour}, 0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, w / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    const stops = easedStops();
    for (const c of this._field.circles) {
      const drift = Math.sin(this.t * c.driftRate + c.phase);
      const cx = (c.x + c.driftX * drift) * w;
      const cy = (c.y + c.driftY * drift) * h;
      const r = c.r * w;
      const angle = c.angle + c.spin * this.t;
      const alpha = c.tier * lit * 0.16;

      if (c.stroke) {
        ctx.strokeStyle = `rgba(${this.colour}, ${alpha * 0.5})`;
        ctx.lineWidth = Math.max(0.5, w * 0.001);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
        continue;
      }

      if (!ctx.createLinearGradient) continue;
      const dx = Math.cos(angle) * r;
      const dy = Math.sin(angle) * r;
      const g = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
      for (const [t, a] of stops) g.addColorStop(t, `rgba(${this.colour}, ${a * alpha})`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = `rgba(${this.colour}, ${0.32 * lit})`;
    for (const d of this._field.dots) {
      ctx.beginPath();
      ctx.arc(d.x * w, d.y * h, Math.max(0.6, d.r * w), 0, Math.PI * 2);
      ctx.fill();
    }

    this._maskToDisc();
  }

  /**
   * Fades the field out towards its own edge. Without this the circles end on a
   * hard canvas boundary and collide with whatever sits below, which reads as a
   * rectangle of bubbles rather than as a field the orb is in.
   */
  _maskToDisc() {
    const ctx = this.ctx;
    if (!ctx.createRadialGradient || !ctx.globalCompositeOperation) return;
    const { w, h } = this;
    const prev = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'destination-in';
    const r = Math.min(w, h) / 2;
    const g = ctx.createRadialGradient(w / 2, h / 2, r * 0.42, w / 2, h / 2, r);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.72, 'rgba(0,0,0,0.55)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = prev;
  }

  destroy() {
    this.stop();
  }
}
