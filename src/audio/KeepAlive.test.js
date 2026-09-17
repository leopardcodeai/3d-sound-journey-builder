import { describe, it, expect, vi } from 'vitest';
import { KeepAlive, buildSilentWav } from './KeepAlive.js';

/**
 * A stand-in for the audio element: records play and pause, reports paused
 * state, and can be told to refuse, which is what iOS does outside a gesture.
 */
function fakeElement({ refuse = false } = {}) {
  const el = {
    loop: false, preload: '', muted: true, volume: 0, src: '', paused: true,
    attrs: {}, plays: 0, pauses: 0,
    setAttribute(k, v) { this.attrs[k] = v; },
    play() {
      this.plays += 1;
      if (refuse) return Promise.reject(new Error('NotAllowedError'));
      this.paused = false;
      return Promise.resolve();
    },
    pause() { this.pauses += 1; this.paused = true; },
  };
  return el;
}

function fakeDoc() {
  const listeners = {};
  return {
    hidden: false,
    body: { appended: [], appendChild(el) { this.appended.push(el); el.isConnected = true; } },
    addEventListener(type, fn) { listeners[type] = fn; },
    removeEventListener(type) { delete listeners[type]; },
    fire(type) { if (listeners[type]) listeners[type](); },
  };
}

describe('buildSilentWav', () => {
  it('is a valid PCM WAV of the right length', () => {
    const buf = buildSilentWav(1, 8000);
    const v = new DataView(buf);
    const tag = (o) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
    expect(tag(0)).toBe('RIFF');
    expect(tag(8)).toBe('WAVE');
    expect(tag(12)).toBe('fmt ');
    expect(tag(36)).toBe('data');
    expect(v.getUint16(20, true)).toBe(1);        // PCM
    expect(v.getUint16(22, true)).toBe(1);        // mono
    expect(v.getUint32(24, true)).toBe(8000);
    expect(v.getUint16(34, true)).toBe(16);
    expect(v.getUint32(40, true)).toBe(16000);    // one second of 16-bit mono
    expect(buf.byteLength).toBe(44 + 16000);
    expect(v.getUint32(4, true)).toBe(buf.byteLength - 8);
  });

  it('is actually silent', () => {
    const bytes = new Uint8Array(buildSilentWav(0.1, 8000)).slice(44);
    expect(bytes.every(b => b === 0)).toBe(true);
  });
});

describe('KeepAlive', () => {
  it('builds an unmuted, looping, inline element and puts it in the document', () => {
    const el = fakeElement();
    const doc = fakeDoc();
    const k = new KeepAlive({ doc, createElement: () => el });
    k.ensure();
    k.ensure();
    expect(el.loop).toBe(true);
    expect(el.muted).toBe(false);
    expect(el.volume).toBe(1);
    expect(el.attrs.playsinline).toBe('');
    expect(el.hidden).toBe(true);
    expect(doc.body.appended).toEqual([el]);
  });

  it('plays synchronously so it can sit inside a gesture', () => {
    const el = fakeElement();
    const k = new KeepAlive({ doc: fakeDoc(), createElement: () => el });
    k.play();
    // No await between the call and the element starting.
    expect(el.plays).toBe(1);
    expect(k.wanted).toBe(true);
  });

  it('follows the engine: alive while anything plays, released when nothing does', () => {
    const el = fakeElement();
    const k = new KeepAlive({ doc: fakeDoc(), createElement: () => el });
    k.sync(true);
    k.sync(true);
    expect(el.plays).toBe(1);
    k.sync(false);
    expect(el.pauses).toBe(1);
    expect(k.wanted).toBe(false);
    k.sync(false);
    expect(el.pauses).toBe(1);
  });

  it('restarts the loop and the context when the page comes back in front', () => {
    const el = fakeElement();
    const doc = fakeDoc();
    const ctx = { state: 'interrupted', resume: vi.fn(() => Promise.resolve()), addEventListener: vi.fn(), removeEventListener: vi.fn() };
    const k = new KeepAlive({ doc, createElement: () => el });
    k.attach(ctx);
    k.play();
    el.paused = true;               // iOS stopped it while locked
    doc.fire('visibilitychange');
    expect(ctx.resume).toHaveBeenCalledTimes(1);
    expect(el.plays).toBe(2);
  });

  it('does nothing on a visibility change while hidden or while not wanted', () => {
    const el = fakeElement();
    const doc = fakeDoc();
    const ctx = { state: 'interrupted', resume: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() };
    const k = new KeepAlive({ doc, createElement: () => el });
    k.attach(ctx);
    doc.fire('visibilitychange');             // never asked to play
    expect(ctx.resume).not.toHaveBeenCalled();
    k.play();
    el.paused = true;
    doc.hidden = true;
    doc.fire('visibilitychange');             // still in the background
    expect(ctx.resume).not.toHaveBeenCalled();
  });

  it('restarts the loop from a lock-screen play before handing over to the app', () => {
    const handlers = {};
    const ms = { setActionHandler: (k, f) => { handlers[k] = f; }, playbackState: 'none', metadata: null };
    Object.defineProperty(navigator, 'mediaSession', { value: ms, configurable: true });
    try {
      const el = fakeElement();
      const order = [];
      const k = new KeepAlive({ doc: fakeDoc(), createElement: () => el, onPlay: () => order.push('app'), onPause: () => order.push('pause') });
      k.play();
      el.paused = true;                       // iOS stopped it behind our back
      handlers.play();
      expect(el.plays).toBe(2);
      expect(order).toEqual(['app']);
      handlers.pause();
      expect(order).toEqual(['app', 'pause']);
      expect(ms.playbackState).toBe('playing');
    } finally {
      delete navigator.mediaSession;
    }
  });

  it('survives an element that refuses to play', async () => {
    const el = fakeElement({ refuse: true });
    const k = new KeepAlive({ doc: fakeDoc(), createElement: () => el });
    await expect(k.play()).resolves.toBeUndefined();
    expect(k.wanted).toBe(true);
  });
});
