import { describe, it, expect } from 'vitest';
import { SOUNDS, CATEGORY_HUE, FIXED_HUE, CATEGORIES, soundsByCategory, getSound } from './SoundLibrary.js';

describe('the library registry', () => {
  it('gives every sound a type, kind and category that exists', () => {
    const cats = new Set(CATEGORIES.map(c => c.id));
    for (const s of SOUNDS) {
      expect(typeof s.type, 'type').toBe('string');
      expect(['sample', 'synth', 'generator'], s.type).toContain(s.kind);
      expect(cats.has(s.category), `${s.type} category ${s.category}`).toBe(true);
    }
  });

  it('uses each type exactly once', () => {
    const types = SOUNDS.map(s => s.type);
    expect(new Set(types).size).toBe(types.length);
  });

  it('returns a usable fallback for a type it does not know', () => {
    const def = getSound('no_such_sound_12345');
    expect(def).toBeTruthy();
    expect(typeof def.kind).toBe('string');
  });

  it('lists every sound under exactly one category', () => {
    let total = 0;
    for (const c of CATEGORIES) total += soundsByCategory(c.id).length;
    expect(total).toBe(SOUNDS.filter(s => s.category !== 'custom').length);
  });
});

describe('colour discipline', () => {
  const hueOf = (hex) => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx === mn) return 0;
    const d = mx - mn;
    const h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? ((b - r) / d + 2) : ((r - g) / d + 4);
    return h * 60;
  };

  it('keeps every sound inside its category hue band', () => {
    const exempt = new Set(FIXED_HUE);
    for (const s of SOUNDS) {
      if (exempt.has(s.type)) continue;
      const band = CATEGORY_HUE[s.category];
      if (!band) continue;
      const h = hueOf(s.color);
      expect(h, `${s.type} (${s.color})`).toBeGreaterThanOrEqual(band[0] - 2);
      expect(h, `${s.type} (${s.color})`).toBeLessThanOrEqual(band[1] + 2);
    }
  });

  it('keeps the bands apart, so category membership is legible', () => {
    const bands = Object.values(CATEGORY_HUE).sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < bands.length; i++) {
      expect(bands[i][0] - bands[i - 1][1], `gap before band ${i}`).toBeGreaterThanOrEqual(20);
    }
  });

  it('keeps every band clear of the accent by the same margin as each other', () => {
    // --accent is #f26f3b, hue 18. Merely sitting outside the bands is not
    // enough: a category 12 degrees away still competes with the one colour
    // that is supposed to mean "this one is yours".
    const ACCENT = 18;
    for (const [cat, band] of Object.entries(CATEGORY_HUE)) {
      const dist = Math.min(
        ...[band[0], band[1]].map(h => Math.min(Math.abs(h - ACCENT), 360 - Math.abs(h - ACCENT))),
      );
      expect(dist, `${cat} is ${dist} degrees from the accent`).toBeGreaterThanOrEqual(20);
    }
  });

  it('gives every sound a colour, and every colour a six-digit hex', () => {
    for (const s of SOUNDS) expect(s.color, s.type).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('keeps entries distinguishable inside a band rather than collapsing them', () => {
    const byCat = {};
    for (const s of SOUNDS) (byCat[s.category] ||= []).push(s.color);
    for (const [cat, cols] of Object.entries(byCat)) {
      if (cols.length < 3) continue;
      expect(new Set(cols).size, `${cat} distinct colours`).toBe(cols.length);
    }
  });

  // Distinct hex values are not the same thing as distinguishable colours.
  // A first attempt spread hue and lightness by two irrational sequences and
  // produced pairs 1.6 apart in CIE76, which is below the threshold at which
  // anyone can tell two colours apart at all.
  const lab = (hex) => {
    let r = parseInt(hex.slice(1, 3), 16) / 255;
    let g = parseInt(hex.slice(3, 5), 16) / 255;
    let b = parseInt(hex.slice(5, 7), 16) / 255;
    const f = (c) => (c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92);
    r = f(r); g = f(g); b = f(b);
    let x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
    let y = r * 0.2126 + g * 0.7152 + b * 0.0722;
    let z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
    const t = (c) => (c > 0.008856 ? Math.cbrt(c) : 7.787 * c + 16 / 116);
    x = t(x); y = t(y); z = t(z);
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
  };
  const deltaE = (a, b) => {
    const A = lab(a), B = lab(b);
    return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
  };

  it('separates every pair in a category by more than the just-noticeable difference', () => {
    const byCat = {};
    for (const s of SOUNDS) (byCat[s.category] ||= []).push(s);
    for (const [cat, list] of Object.entries(byCat)) {
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const d = deltaE(list[i].color, list[j].color);
          expect(d, `${cat}: ${list[i].type} vs ${list[j].type}`).toBeGreaterThan(8);
        }
      }
    }
  });

  it('separates the sounds of a journey, which are the ones seen side by side', () => {
    const together = [
      ['ocean_deep', 'underwater_ambient', 'whales', 'waves', 'dolphins'],
      ['jungle_night', 'jungle_river', 'monkeys', 'jungle_birds', 'crickets'],
      ['gong', 'wind-chimes', 'bowl_c', 'bowl_g', 'bowl_b'],
    ];
    for (const group of together) {
      const cols = group.map(t => SOUNDS.find(s => s.type === t).color);
      for (let i = 0; i < cols.length; i++) {
        for (let j = i + 1; j < cols.length; j++) {
          expect(deltaE(cols[i], cols[j]), `${group[i]} vs ${group[j]}`).toBeGreaterThan(8);
        }
      }
    }
  });

  it('exempts only sounds that actually exist', () => {
    const types = new Set(SOUNDS.map(s => s.type));
    for (const t of FIXED_HUE) expect(types.has(t), t).toBe(true);
  });
});
