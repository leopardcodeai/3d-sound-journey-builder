import { describe, it, expect } from 'vitest';
import { SPEAKER_PRESETS } from './SpeakerConfig.js';

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
