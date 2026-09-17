import { describe, it, expect, vi } from 'vitest';
import { SPEAKER_PRESETS, SpeakerConfig } from './SpeakerConfig.js';

const bearing = (sp) => (Math.atan2(sp.x, sp.y) * 180) / Math.PI;

describe('speaker layouts', () => {
  it('places every speaker where its own angle says it is', () => {
    // The renderer reads x and y; the angle beside them was decoration and
    // disagreed by 15 to 20 degrees. They have to agree or one of them lies.
    for (const [key, preset] of Object.entries(SPEAKER_PRESETS)) {
      for (const sp of preset.speakerPositions || []) {
        if (sp.isSub) continue;
        expect(bearing(sp), `${key} ${sp.label}`).toBeCloseTo(sp.angle, 0);
      }
    }
  });

  it('keeps the front pair at the standard thirty degrees', () => {
    for (const key of ['stereo-speakers', 'surround-5.1']) {
      const l = SPEAKER_PRESETS[key].speakerPositions.find(s => s.label === 'L');
      const r = SPEAKER_PRESETS[key].speakerPositions.find(s => s.label === 'R');
      expect(bearing(l), `${key} L`).toBeCloseTo(-30, 0);
      expect(bearing(r), `${key} R`).toBeCloseTo(30, 0);
    }
  });

  it('puts the surrounds at a hundred and ten degrees', () => {
    const p = SPEAKER_PRESETS['surround-5.1'].speakerPositions;
    expect(bearing(p.find(s => s.label === 'Ls'))).toBeCloseTo(-110, 0);
    expect(bearing(p.find(s => s.label === 'Rs'))).toBeCloseTo(110, 0);
  });

  it('keeps every placed speaker the same distance away', () => {
    for (const [key, preset] of Object.entries(SPEAKER_PRESETS)) {
      const placed = (preset.speakerPositions || []).filter(s => !s.isSub);
      if (placed.length < 2) continue;
      const d = placed.map(s => Math.hypot(s.x, s.y));
      for (const one of d) expect(one, `${key}`).toBeCloseTo(d[0], 2);
    }
  });

  it('is mirror-symmetric left to right', () => {
    for (const [key, preset] of Object.entries(SPEAKER_PRESETS)) {
      for (const sp of preset.speakerPositions || []) {
        if (sp.isSub || !/^[LR]s?$/.test(sp.label)) continue;
        // Chaining two replaces undoes the first: 'Ls' -> 'Rs' -> 'Ls'. One swap.
        const twinLabel = sp.label.startsWith('L') ? `R${sp.label.slice(1)}` : `L${sp.label.slice(1)}`;
        const twin = preset.speakerPositions.find(o => o.label === twinLabel);
        if (!twin) continue;
        expect(sp.x, `${key} ${sp.label}`).toBeCloseTo(-twin.x, 3);
        expect(sp.y, `${key} ${sp.label}`).toBeCloseTo(twin.y, 3);
      }
    }
  });

  it('carries no emoji, which the house rules keep out of generated surfaces', () => {
    const text = JSON.stringify(SPEAKER_PRESETS);
    expect(/\p{Extended_Pictographic}/u.test(text)).toBe(false);
  });
});

/**
 * Choosing "Custom speakers" used to break the app until localStorage was
 * cleared by hand. The preset carried the string 'custom' as its channel
 * count, which reached createChannelMerger and threw IndexSizeError, but only
 * after _reconnectSource had already disconnected the panner. Every playing
 * source went silent. The choice is remembered, so the next launch applied it
 * again with no sources present, where it succeeds quietly, and then every
 * later addSource threw before the source was registered: nothing could be
 * added to the field at all, with nothing on screen to say why.
 */
describe('a speaker choice can never break the signal path', () => {
  it('gives no preset a channel count that is not a number', () => {
    for (const [key, preset] of Object.entries(SPEAKER_PRESETS)) {
      if (preset.channels === null) continue;
      expect(Number.isInteger(preset.channels), `${key}`).toBe(true);
      expect(preset.channels, `${key}`).toBeGreaterThan(0);
    }
  });

  it('derives the custom count from the speakers actually placed', () => {
    expect(SPEAKER_PRESETS.custom.channels).toBe(null);
    expect(SPEAKER_PRESETS.custom.speakerPositions).toEqual([]);
  });

});

/**
 * Moving a speaker used to write into SPEAKER_PRESETS itself, so one drag of
 * the Ls badge and the ITU layout was gone for the rest of the session, in the
 * settings list as well. It also wrote into the custom list whatever preset
 * was active, and rebuilt the whole speaker graph on every pointer move.
 */
describe('moving a speaker', () => {
  const engine = () => ({ setOutputMode: vi.fn(), refreshSpeakerPanning: vi.fn() });

  it('leaves the preset constant untouched and moves a working copy', () => {
    const e = engine();
    const sc = new SpeakerConfig(e, null);
    sc.setConfig('surround-5.1');
    const shipped = SPEAKER_PRESETS['surround-5.1'].speakerPositions.map(p => ({ ...p }));
    expect(sc.moveSpeaker(0, 3, 3)).toBe(true);
    expect(SPEAKER_PRESETS['surround-5.1'].speakerPositions).toEqual(shipped);
    expect(sc.activePositions()[0]).toMatchObject({ x: 3, y: 3 });
    expect(e.refreshSpeakerPanning).toHaveBeenCalledTimes(1);
    expect(e.setOutputMode).toHaveBeenCalledTimes(1);   // once for setConfig, never for the move
  });

  it('moves custom speakers in the custom list and nothing else', () => {
    const e = engine();
    const sc = new SpeakerConfig(e, null);
    sc.setConfig('surround-5.1');
    sc.moveSpeaker(0, 3, 3);
    expect(sc.customSpeakers).toEqual([]);
    sc.setConfig('custom');
    sc.addCustomSpeaker(1, 1, 0);
    sc.moveSpeaker(0, 2, 2);
    expect(sc.customSpeakers[0]).toMatchObject({ x: 2, y: 2 });
  });

  it('refuses to move a subwoofer and keeps a preset resettable', () => {
    const e = engine();
    const sc = new SpeakerConfig(e, null);
    sc.setConfig('surround-5.1');
    const sub = sc.activePositions().findIndex(p => p.isSub);
    expect(sc.moveSpeaker(sub, 5, 5)).toBe(false);
    sc.moveSpeaker(0, 3, 3);
    sc.resetLayout();
    expect(sc.activePositions()[0]).toMatchObject({ x: SPEAKER_PRESETS['surround-5.1'].speakerPositions[0].x });
  });

  it('feeds the engine the working copy, so a drag pans in place', () => {
    const e = engine();
    const sc = new SpeakerConfig(e, null);
    sc.setConfig('stereo-speakers');
    const fed = e.setOutputMode.mock.calls[0][1];
    expect(fed).toBe(sc.activePositions());
    expect(fed).not.toBe(SPEAKER_PRESETS['stereo-speakers'].speakerPositions);
  });
});
