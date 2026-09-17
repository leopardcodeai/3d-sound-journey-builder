/**
 * SoundscapeTimer: the sleep timer. Counts down, then fades everything out
 * gently and stops it.
 *
 * It keeps a deadline, not a counter. The old version decremented a number
 * once a second from setInterval, and a phone with its screen off throttles
 * or pauses timers, so a thirty-minute timer routinely ran well past thirty
 * minutes of wall clock, in exactly the situation the feature exists for.
 * Now every tick reads the clock, and when the page comes back in front it
 * settles up at once: if the deadline passed while it was away, the fade
 * starts immediately.
 *
 * The fade is long on purpose. Three seconds is a stop; twenty is falling
 * asleep to something that is leaving the room.
 */

export const DEFAULT_FADE_SECONDS = 20;

export class SoundscapeTimer {
  /**
   * @param {Object} callbacks onStart(), onTick(remainingSeconds), onStop(), onComplete()
   * @param {Object} opts fadeSeconds, now() for tests, doc for the visibility hook
   */
  constructor(audioEngine, callbacks = {}, opts = {}) {
    this.audioEngine = audioEngine;
    this.callbacks = callbacks;
    this.fadeSeconds = opts.fadeSeconds === undefined ? DEFAULT_FADE_SECONDS : opts.fadeSeconds;
    this.now = opts.now || (() => Date.now());
    this.doc = opts.doc || (typeof document !== 'undefined' ? document : null);
    this.duration = 0;
    this.remaining = 0;
    this.endsAt = 0;
    this.interval = null;
    this.running = false;
    this.fading = false;
    this._fadeTimer = null;
    this._onVisibility = () => { if (this.running && this.doc && !this.doc.hidden) this._tick(); };
  }

  start(minutes) {
    const mins = Number(minutes);
    if (!Number.isFinite(mins) || mins <= 0) return false;
    this.stop();
    this.duration = Math.round(mins * 60);
    this.remaining = this.duration;
    this.endsAt = this.now() + this.duration * 1000;
    this.running = true;
    this.fading = false;

    if (this.callbacks.onStart) this.callbacks.onStart();
    if (this.doc && this.doc.addEventListener) this.doc.addEventListener('visibilitychange', this._onVisibility);
    this.interval = setInterval(() => this._tick(), 1000);
    return true;
  }

  /** The same, in seconds, for the short option that lets you hear the fade. */
  startSeconds(seconds) {
    return this.start(Number(seconds) / 60);
  }

  /** Reads the clock and reports. Also the place the deadline is enforced. */
  _tick() {
    if (!this.running) return;
    this.remaining = Math.max(0, Math.ceil((this.endsAt - this.now()) / 1000));
    if (this.callbacks.onTick) this.callbacks.onTick(this.remaining);
    if (this.remaining <= 0) {
      this._clearInterval();
      this.running = false;
      this._fadeAndPause();
    }
  }

  stop() {
    this._clearInterval();
    if (this.doc && this.doc.removeEventListener) this.doc.removeEventListener('visibilitychange', this._onVisibility);
    // Cancelling the restore timeout is not enough on its own: the ramp to zero
    // is already scheduled on the audio clock and keeps running. Starting a new
    // timer calls stop() first, so without this the master fades to silence and
    // stays there while the sources play on. Found by an external review and
    // reproduced: master 0.0000 with five sources still audible.
    if (this._fadeTimer) {
      clearTimeout(this._fadeTimer);
      this._fadeTimer = null;
      this._abortFade();
    }
    const wasRunning = this.running || this.fading;
    this.running = false;
    this.fading = false;
    this.duration = 0;
    this.remaining = 0;
    this.endsAt = 0;
    if (wasRunning && this.callbacks.onStop) this.callbacks.onStop();
  }

  _clearInterval() {
    if (this.interval) { clearInterval(this.interval); this.interval = null; }
  }

  /**
   * Fades the master out, then pauses every source and puts the master back
   * where it was.
   *
   * The restore is the part that matters. Without it the gain stays at zero
   * after the timer expires while the fader still reads its old value, so the
   * next press of play produces silence and nothing on screen explains why.
   * The level has to come back once the sources are already stopped, which is
   * why it happens inside the same timeout rather than on the ramp.
   */
  _fadeAndPause() {
    const engine = this.audioEngine;
    if (!engine.isInitialized || !engine.ctx || !engine.masterGain) {
      if (this.callbacks.onComplete) this.callbacks.onComplete();
      return;
    }
    this.fading = true;
    const ctx = engine.ctx;
    const fade = Math.max(0.5, this.fadeSeconds);
    // Read the level before scheduling anything: _lastVolume is what the fader
    // says, and the live gain value is the fallback if the engine has not seen
    // a set yet.
    const level = typeof engine._lastVolume === 'number' ? engine._lastVolume : engine.masterGain.gain.value;

    engine.masterGain.gain.cancelScheduledValues(ctx.currentTime);
    engine.masterGain.gain.setValueAtTime(engine.masterGain.gain.value, ctx.currentTime);
    engine.masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + fade);
    if (this.callbacks.onFadeStart) this.callbacks.onFadeStart(fade);

    this._fadeTimer = setTimeout(() => {
      this._fadeTimer = null;
      this.fading = false;
      for (const src of engine.sources.values()) {
        if (src.isPlaying) engine.toggleSource(src.id);
      }
      const t = engine.ctx ? engine.ctx.currentTime : 0;
      engine.masterGain.gain.cancelScheduledValues(t);
      engine.masterGain.gain.setValueAtTime(level, t);
      if (this.callbacks.onComplete) this.callbacks.onComplete();
    }, fade * 1000 + 100);
  }

  /** Drops a fade in progress and puts the master back where the fader is. */
  _abortFade() {
    const engine = this.audioEngine;
    if (!engine || !engine.isInitialized || !engine.ctx || !engine.masterGain) return;
    const t = engine.ctx.currentTime;
    const level = typeof engine._lastVolume === 'number' ? engine._lastVolume : 0.8;
    engine.masterGain.gain.cancelScheduledValues(t);
    engine.masterGain.gain.setValueAtTime(level, t);
  }

  getRemaining() {
    const h = Math.floor(this.remaining / 3600);
    const m = Math.floor((this.remaining % 3600) / 60);
    const s = this.remaining % 60;
    return { hours: h, minutes: m, seconds: s };
  }

  /** "12:34" or "1:02:03" for a readout; compact gives "1h02" above an hour. */
  formatRemaining(compact = false) {
    const { hours, minutes, seconds } = this.getRemaining();
    const two = (n) => String(n).padStart(2, '0');
    if (hours > 0) return compact ? `${hours}h${two(minutes)}` : `${hours}:${two(minutes)}:${two(seconds)}`;
    return `${minutes}:${two(seconds)}`;
  }

  toggle(minutes) {
    if (this.running) {
      this.stop();
    } else {
      this.start(minutes);
    }
  }
}
