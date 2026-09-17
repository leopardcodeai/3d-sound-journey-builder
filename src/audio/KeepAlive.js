/**
 * KeepAlive: keeps the audio session open on iOS while the screen is locked.
 *
 * iOS suspends Web Audio the moment a page leaves the foreground or the screen
 * locks. Only a page with a playing media element keeps its audio session, and
 * the whole point of a sleep journey is that the screen is off. So while
 * anything is playing, a one-second loop of digital silence runs in an
 * <audio> element. It is inaudible and it is not muted, because iOS treats a
 * muted element as not playing. When nothing plays, it is paused so the
 * session is released and the lock screen stops showing us.
 *
 * Two things this must get right, both learnt the hard way by others:
 *
 * The element has to start inside the same user gesture that starts the
 * audio, before any await, or iOS refuses it. So play() is synchronous and is
 * called at the top of the engine's resume(), which every gesture path goes
 * through.
 *
 * A phone call or Siri leaves the AudioContext "interrupted", and iOS denies
 * resuming it until the page is in front again. So the recovery hangs off
 * visibilitychange, not off the interruption itself.
 */

/**
 * A valid PCM WAV file of silence: 8 kHz, mono, 16-bit. The smallest thing a
 * media element will accept as real audio. Built at runtime so nothing has to
 * ship as a file, and returned as bytes so it can be tested without a DOM.
 */
export function buildSilentWav(seconds = 1, sampleRate = 8000) {
  const frames = Math.max(1, Math.round(seconds * sampleRate));
  const dataBytes = frames * 2;
  const buf = new ArrayBuffer(44 + dataBytes);
  const v = new DataView(buf);
  const ascii = (offset, s) => { for (let i = 0; i < s.length; i++) v.setUint8(offset + i, s.charCodeAt(i)); };
  ascii(0, 'RIFF');
  v.setUint32(4, 36 + dataBytes, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  v.setUint32(16, 16, true);        // PCM chunk size
  v.setUint16(20, 1, true);         // PCM
  v.setUint16(22, 1, true);         // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true); // byte rate
  v.setUint16(32, 2, true);         // block align
  v.setUint16(34, 16, true);        // bits per sample
  ascii(36, 'data');
  v.setUint32(40, dataBytes, true);
  // The data is already zero: an ArrayBuffer starts as silence.
  return buf;
}

export class KeepAlive {
  /**
   * @param {Object} opts
   *   doc: document to create the element in (tests pass a stand-in)
   *   createElement: factory for the audio element, for tests
   *   onPlay, onPause: lock-screen transport controls, wired by the app
   */
  constructor(opts = {}) {
    this.doc = opts.doc || (typeof document !== 'undefined' ? document : null);
    this.createElement = opts.createElement || (() => this.doc.createElement('audio'));
    this.onPlay = opts.onPlay || null;
    this.onPause = opts.onPause || null;
    this.el = null;
    this.url = null;
    this.wanted = false;
    this.ctx = null;
    this._onVisibility = () => this._recover();
    this._onState = () => this._recover();
  }

  /** Builds the element once. Safe to call repeatedly. */
  ensure() {
    if (this.el) return this.el;
    if (typeof Blob !== 'undefined' && typeof URL !== 'undefined' && URL.createObjectURL) {
      this.url = URL.createObjectURL(new Blob([buildSilentWav()], { type: 'audio/wav' }));
    }
    const el = this.createElement();
    el.loop = true;
    el.preload = 'auto';
    // Not muted, volume up: the silence is in the data. A muted element does
    // not keep the session on iOS.
    el.muted = false;
    el.volume = 1;
    if ('playsInline' in el) el.playsInline = true;
    if (el.setAttribute) el.setAttribute('playsinline', '');
    if (this.url) el.src = this.url;
    // In the document, hidden. A detached element plays too, but iOS ties
    // the session to what the page is doing, and an element the page can
    // see is the conservative reading of that.
    if (el.setAttribute) { el.setAttribute('aria-hidden', 'true'); el.hidden = true; }
    const body = this.doc && this.doc.body;
    if (body && body.appendChild && !el.isConnected) { try { body.appendChild(el); } catch (e) { /* detached doc */ } }
    this.el = el;
    return el;
  }

  /**
   * Starts the silent loop. Synchronous on purpose: it has to run inside the
   * user's gesture, before any await. The returned promise is for tests.
   */
  play() {
    this.wanted = true;
    const el = this.ensure();
    this._session('playback');
    let p;
    try { p = el.play(); } catch (e) { p = Promise.reject(e); }
    if (p && p.catch) p = p.catch(() => {});
    this._announce();
    return p || Promise.resolve();
  }

  pause() {
    this.wanted = false;
    if (this.el && !this.el.paused) { try { this.el.pause(); } catch (e) { /* not started */ } }
    if (typeof navigator !== 'undefined' && navigator.mediaSession) {
      try { navigator.mediaSession.playbackState = 'paused'; } catch (e) { /* unsupported */ }
    }
  }

  /** Follows what the engine is doing: alive while anything plays. */
  sync(anyPlaying) {
    if (anyPlaying && !this.wanted) this.play();
    else if (!anyPlaying && this.wanted) this.pause();
  }

  /**
   * Watches the context and the page. When the page comes back in front with
   * audio wanted, resume a context iOS interrupted and restart the loop.
   */
  attach(ctx) {
    this.ctx = ctx || null;
    if (this.doc && this.doc.addEventListener) {
      this.doc.removeEventListener('visibilitychange', this._onVisibility);
      this.doc.addEventListener('visibilitychange', this._onVisibility);
    }
    if (ctx && ctx.addEventListener) {
      ctx.removeEventListener('statechange', this._onState);
      ctx.addEventListener('statechange', this._onState);
    }
  }

  _recover() {
    if (!this.wanted) return;
    if (this.doc && this.doc.hidden) return;
    const ctx = this.ctx;
    if (ctx && (ctx.state === 'suspended' || ctx.state === 'interrupted') && ctx.resume) {
      try { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* denied */ }
    }
    if (this.el && this.el.paused) {
      try { const p = this.el.play(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* denied */ }
    }
  }

  /** Tells Safari this is playback, not a notification or a call. */
  _session(type) {
    if (typeof navigator === 'undefined' || !navigator.audioSession) return;
    try { navigator.audioSession.type = type; } catch (e) { /* older Safari */ }
  }

  /** Lock-screen title and transport, where the platform shows one. */
  _announce() {
    if (typeof navigator === 'undefined' || !navigator.mediaSession) return;
    const ms = navigator.mediaSession;
    try {
      if (typeof MediaMetadata !== 'undefined') {
        ms.metadata = new MediaMetadata({ title: 'Sound Journey', artist: 'Sound Journey Builder' });
      }
      ms.playbackState = 'playing';
      ms.setActionHandler('play', () => { if (this.onPlay) this.onPlay(); });
      ms.setActionHandler('pause', () => { if (this.onPause) this.onPause(); });
    } catch (e) { /* unsupported action */ }
  }

  dispose() {
    this.pause();
    if (this.doc && this.doc.removeEventListener) this.doc.removeEventListener('visibilitychange', this._onVisibility);
    if (this.ctx && this.ctx.removeEventListener) this.ctx.removeEventListener('statechange', this._onState);
    if (this.url && typeof URL !== 'undefined' && URL.revokeObjectURL) URL.revokeObjectURL(this.url);
    this.url = null;
    this.el = null;
  }
}
