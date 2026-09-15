/**
 * PostureSensor: works out how the listener is lying or standing from the way
 * the device is held, so the field does not have to be set by hand.
 *
 * The rule the interface promises: hold the phone up in front of you and you
 * are standing, facing the field. Lie down with the phone above your face and
 * you are on your back, head towards the front of the field and feet towards
 * the back. Turn onto your side and the field turns with you.
 *
 * Two things this deliberately does not do.
 *
 * It does not change the posture silently while you are using it. A setting
 * that moves on its own reads as a fault, so the sensor reports a change and
 * the caller decides, and any manual choice switches the following off.
 *
 * It does not react instantly. Device orientation arrives at 60 Hz and crosses
 * a boundary constantly when a phone is held at 45 degrees. A posture has to
 * hold for a moment before it counts, or the listener flips back and forth
 * while you hold still.
 */

/** How long one reading has to hold before it counts, in milliseconds. */
export const SETTLE_MS = 900;

/**
 * Maps a device orientation to a listener posture.
 *
 * `beta` is the front-to-back tilt: 90 is upright with the screen facing you,
 * 0 is flat with the screen facing up, 180 is flat face down.
 * `gamma` is the left-to-right tilt: 0 is level, plus or minus 90 is on its side.
 *
 * Returns null when the reading is unusable, rather than guessing a posture
 * from nothing.
 */
export function postureFromOrientation(beta, gamma) {
  if (!Number.isFinite(beta) || !Number.isFinite(gamma)) return null;

  const b = Math.abs(beta);
  const g = Math.abs(gamma);

  // On its side, which is the clearest reading there is: one edge is down and
  // the screen faces sideways. Checked first because a phone on its side can
  // show almost any beta.
  if (g > 55) return 'lying-side';

  // Held up in front of the face. The band is wide because nobody holds a
  // phone at exactly 90 degrees.
  if (b > 50) return 'standing';

  // Flat, screen up: lying on the back with the phone above the face.
  if (b < 35) return 'lying-back';

  // In between, and honestly so. Keeping the previous posture is better than
  // picking one at a boundary the user is still moving through.
  return null;
}

export class PostureSensor {
  /**
   * @param {Object} callbacks onPosture(posture), onUnavailable()
   * @param {Object} opts settleMs, now() for tests
   */
  constructor(callbacks = {}, opts = {}) {
    this.callbacks = callbacks;
    this.settleMs = opts.settleMs === undefined ? SETTLE_MS : opts.settleMs;
    this.now = opts.now || (() => Date.now());
    this.active = false;
    this.posture = null;
    this._candidate = null;
    this._since = 0;
    this._handler = (e) => this.handleOrientation(e);
  }

  static isAvailable() {
    return typeof window !== 'undefined' && typeof window.DeviceOrientationEvent !== 'undefined';
  }

  /** True on iOS, where motion access needs a gesture and an explicit grant. */
  static needsPermission() {
    return typeof DeviceOrientationEvent !== 'undefined'
      && typeof DeviceOrientationEvent.requestPermission === 'function';
  }

  async requestPermission() {
    if (!PostureSensor.needsPermission()) return true;
    try {
      const state = await DeviceOrientationEvent.requestPermission();
      return state === 'granted';
    } catch (e) {
      return false;
    }
  }

  start() {
    if (this.active || !PostureSensor.isAvailable()) return false;
    this.active = true;
    this._candidate = null;
    this._since = 0;
    window.addEventListener('deviceorientation', this._handler);
    return true;
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    this._candidate = null;
    if (typeof window !== 'undefined') window.removeEventListener('deviceorientation', this._handler);
  }

  /** Exposed separately from the listener so a test can drive it directly. */
  handleOrientation(event) {
    if (!this.active) return;
    const next = postureFromOrientation(event.beta, event.gamma);
    if (next === null) { this._candidate = null; return; }

    const t = this.now();
    if (next !== this._candidate) {
      this._candidate = next;
      this._since = t;
      return;
    }
    if (next === this.posture) return;
    if (t - this._since < this.settleMs) return;

    this.posture = next;
    if (this.callbacks.onPosture) this.callbacks.onPosture(next);
  }
}
