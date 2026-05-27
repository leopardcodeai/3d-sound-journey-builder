/**
 * HeadTracker
 * Uses the DeviceOrientation API to track head movement and feed it
 * into the Web Audio listener orientation for spatial audio head-tracking.
 */
export class HeadTracker {
  constructor(audioEngine, callbacks = {}) {
    this.audioEngine = audioEngine;
    this.callbacks = callbacks;
    this.active = false;
    this.enabled = false;
    this.alpha = 0;
    this.beta = 0;
    this.gamma = 0;
    this._handler = null;
    this._permissionGranted = false;
    this._calibrationAlpha = 0;
    this._calibrationBeta = 0;
    this._calibrationGamma = 0;
    this._calibrated = false;
  }

  async requestPermission() {
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const permission = await DeviceOrientationEvent.requestPermission();
        this._permissionGranted = (permission === 'granted');
        return this._permissionGranted;
      } catch (e) {
        console.error('DeviceOrientation permission denied:', e);
        return false;
      }
    }
    this._permissionGranted = true;
    return true;
  }

  start() {
    if (!this._permissionGranted) return false;
    if (this.active) return true;

    this._handler = (event) => this._onOrientation(event);
    window.addEventListener('deviceorientation', this._handler, true);
    this.active = true;
    this.enabled = true;

    if (this.callbacks.onStart) this.callbacks.onStart();
    return true;
  }

  stop() {
    if (this._handler) {
      window.removeEventListener('deviceorientation', this._handler, true);
      this._handler = null;
    }
    this.active = false;
    this.enabled = false;
    this._calibrated = false;
    if (this.callbacks.onStop) this.callbacks.onStop();
  }

  toggle() {
    if (this.active) {
      this.stop();
    } else {
      return this.start();
    }
  }

  calibrate() {
    this._calibrationAlpha = this.alpha;
    this._calibrationBeta = this.beta;
    this._calibrationGamma = this.gamma;
    this._calibrated = true;
  }

  _onOrientation(event) {
    if (!this.enabled) return;

    const alpha = event.alpha || 0;
    const beta = event.beta || 0;
    const gamma = event.gamma || 0;

    this.alpha = alpha;
    this.beta = beta;
    this.gamma = gamma;

    if (!this._calibrated) {
      this.calibrate();
      return;
    }

    let dAlpha = alpha - this._calibrationAlpha;
    let dBeta = beta - this._calibrationBeta;
    let dGamma = gamma - this._calibrationGamma;

    if (dAlpha > 180) dAlpha -= 360;
    if (dAlpha < -180) dAlpha += 360;

    const yawRad = (dAlpha * Math.PI) / 180;
    const pitchRad = (dBeta * Math.PI) / 180;
    const rollRad = (dGamma * Math.PI) / 180;

    if (this.audioEngine.isInitialized && this.audioEngine.ctx) {
      const listener = this.audioEngine.ctx.listener;

      const cosYaw = Math.cos(yawRad);
      const sinYaw = Math.sin(yawRad);
      const cosPitch = Math.cos(pitchRad);
      const sinPitch = Math.sin(pitchRad);
      const cosRoll = Math.cos(rollRad);
      const sinRoll = Math.sin(rollRad);

      let fx = -sinYaw * cosPitch;
      let fy = sinPitch;
      let fz = -cosYaw * cosPitch;

      let ux = sinRoll * cosYaw;
      let uy = cosRoll * cosPitch;
      let uz = -sinRoll * sinYaw;

      const fLen = Math.sqrt(fx * fx + fy * fy + fz * fz);
      const uLen = Math.sqrt(ux * ux + uy * uy + uz * uz);
      if (fLen > 0) { fx /= fLen; fy /= fLen; fz /= fLen; }
      if (uLen > 0) { ux /= uLen; uy /= uLen; uz /= uLen; }

      if (listener.forwardX) {
        listener.forwardX.setValueAtTime(fx, this.audioEngine.ctx.currentTime);
        listener.forwardY.setValueAtTime(fy, this.audioEngine.ctx.currentTime);
        listener.forwardZ.setValueAtTime(fz, this.audioEngine.ctx.currentTime);
        listener.upX.setValueAtTime(ux, this.audioEngine.ctx.currentTime);
        listener.upY.setValueAtTime(uy, this.audioEngine.ctx.currentTime);
        listener.upZ.setValueAtTime(uz, this.audioEngine.ctx.currentTime);
      } else {
        listener.setOrientation(fx, fy, fz, ux, uy, uz);
      }
    }

    if (this.callbacks.onUpdate) {
      this.callbacks.onUpdate(this.alpha, this.beta, this.gamma);
    }
  }

  isAvailable() {
    return 'DeviceOrientationEvent' in window;
  }
}
