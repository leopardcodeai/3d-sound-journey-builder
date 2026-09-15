export class SoundscapeTimer {
  constructor(audioEngine, callbacks = {}) {
    this.audioEngine = audioEngine;
    this.callbacks = callbacks;
    this.duration = 0;
    this.remaining = 0;
    this.interval = null;
    this.running = false;
  }

  start(minutes) {
    this.stop();
    this.duration = minutes * 60;
    this.remaining = this.duration;
    this.running = true;

    if (this.callbacks.onStart) this.callbacks.onStart();

    this.interval = setInterval(() => {
      this.remaining--;

      if (this.callbacks.onTick) {
        this.callbacks.onTick(this.remaining);
      }

      if (this.remaining <= 0) {
        this.stop();
        this._fadeAndPause();
      }
    }, 1000);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    if (this._fadeTimer) { clearTimeout(this._fadeTimer); this._fadeTimer = null; }
    this.running = false;
    this.duration = 0;
    this.remaining = 0;
    if (this.callbacks.onStop) this.callbacks.onStop();
  }

  /**
   * Fades the master out over three seconds, then pauses every source and puts
   * the master back where it was.
   *
   * The restore is the part that matters. Without it the gain stays at zero
   * after the timer expires while the fader still reads its old value, so the
   * next press of play produces silence and nothing on screen explains why.
   * The level has to come back once the sources are already stopped, which is
   * why it happens inside the same timeout rather than on the ramp.
   */
  _fadeAndPause() {
    const engine = this.audioEngine;
    if (!engine.isInitialized || !engine.ctx || !engine.masterGain) return;

    const ctx = engine.ctx;
    // Read the level before scheduling anything: _lastVolume is what the fader
    // says, and the live gain value is the fallback if the engine has not seen
    // a set yet.
    const level = typeof engine._lastVolume === 'number' ? engine._lastVolume : engine.masterGain.gain.value;

    engine.masterGain.gain.cancelScheduledValues(ctx.currentTime);
    engine.masterGain.gain.setValueAtTime(engine.masterGain.gain.value, ctx.currentTime);
    engine.masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 3);

    this._fadeTimer = setTimeout(() => {
      this._fadeTimer = null;
      for (const src of engine.sources.values()) {
        if (src.isPlaying) engine.toggleSource(src.id);
      }
      const t = engine.ctx ? engine.ctx.currentTime : 0;
      engine.masterGain.gain.cancelScheduledValues(t);
      engine.masterGain.gain.setValueAtTime(level, t);
      if (this.callbacks.onComplete) this.callbacks.onComplete();
    }, 3100);
  }

  getRemaining() {
    const h = Math.floor(this.remaining / 3600);
    const m = Math.floor((this.remaining % 3600) / 60);
    const s = this.remaining % 60;
    return { hours: h, minutes: m, seconds: s };
  }

  toggle(minutes) {
    if (this.running) {
      this.stop();
    } else {
      this.start(minutes);
    }
  }
}
