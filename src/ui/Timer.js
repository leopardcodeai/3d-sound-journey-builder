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
    this.running = false;
    this.duration = 0;
    this.remaining = 0;
    if (this.callbacks.onStop) this.callbacks.onStop();
  }

  _fadeAndPause() {
    const engine = this.audioEngine;
    if (!engine.isInitialized || !engine.ctx || !engine.masterGain) return;

    const currentVolume = engine.masterGain.gain.value;
    const ctx = engine.ctx;

    engine.masterGain.gain.cancelScheduledValues(ctx.currentTime);
    engine.masterGain.gain.setValueAtTime(currentVolume, ctx.currentTime);
    engine.masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 3);

    setTimeout(() => {
      for (const src of engine.sources.values()) {
        if (src.isPlaying) {
          engine.toggleSource(src.id);
        }
      }
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
