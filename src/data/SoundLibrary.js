/**
 * SoundLibrary
 * The single registry of every sound the app can place in the field.
 *
 * - `kind: 'sample'`     streams an mp3 from /sounds (decoded once, looped)
 * - `kind: 'synth'`      instrument buffers rendered offline by InstrumentSynth
 * - `kind: 'generator'`  procedural Web Audio graphs built by Generators.js
 *
 * Every UI surface (library panel, map, timeline, inspector, focus view) reads
 * from here, so adding a sound is one entry. Names resolve through i18n keys.
 */
import { t } from '../i18n.js';

export const CATEGORIES = [
  { id: 'nature',      nameKey: 'catNature',      icon: 'leaf' },
  { id: 'places',      nameKey: 'catPlaces',      icon: 'city' },
  { id: 'healing',     nameKey: 'catHealing',     icon: 'bowl' },
  { id: 'instruments', nameKey: 'catInstruments', icon: 'piano' },
  { id: 'frequencies', nameKey: 'catFrequencies', icon: 'wave' },
  { id: 'generative',  nameKey: 'catGenerative',  icon: 'layers' },
  { id: 'custom',      nameKey: 'catCustom',      icon: 'file' },
];

/** Evidence grades shown next to frequency tools. */
export const EVIDENCE = {
  moderate: { key: 'evidenceModerate' },
  weak:     { key: 'evidenceWeak' },
  none:     { key: 'evidenceNone' },
};

/**
 * One-line caveats, keyed by note id and resolved through i18n. They sit next
 * to the grade so a reader gets the reason, not just the verdict. Sources are
 * in docs/research/2026-09-15-sound-apps-and-evidence.md.
 */
export const EVIDENCE_NOTES = [
  'noteBinaural', 'noteIsochronic', 'noteNoiseFocus', 'noteNoiseBrown',
  'noteBreath', 'noteSolfeggio', 'noteSchumann', 'noteGamma', 'noteTone',
];

const S = (type, o) => ({ type, kind: 'sample', spatial: true, url: `/sounds/${o.file}`, ...o });
const Y = (type, o) => ({ type, kind: 'synth', spatial: true, ...o });
const G = (type, o) => ({ type, kind: 'generator', spatial: true, ...o });

export const SOUNDS = [
  // ---- Nature -------------------------------------------------------------
  S('birds',              { file: 'birds.mp3',              category: 'nature', nameKey: 'birds',            glyph: 'bird',    color: '#7fb069', desc: 'Forest songbirds at dawn', restorative: true }),
  S('tropical_birds',     { file: 'tropical-birds.mp3',     category: 'nature', nameKey: 'tropicalBirds',    glyph: 'bird',    color: '#e07a9a', desc: 'Exotic birds in a rainforest', restorative: true }),
  S('jungle_birds',       { file: 'jungle-birds.mp3',       category: 'nature', nameKey: 'jungleBirds',      glyph: 'bird',    color: '#9ac46a', desc: 'Sparse jungle bird calls', restorative: true }),
  S('campfire',           { file: 'campfire.mp3',           category: 'nature', nameKey: 'campfire',         glyph: 'flame',   color: '#ef8a5a', desc: 'Crackling fire' }),
  S('rain',               { file: 'rain.mp3',               category: 'nature', nameKey: 'rain',             glyph: 'drop',    color: '#8fb3ff', desc: 'Steady rain', restorative: true }),
  S('thunder',            { file: 'thunder.mp3',            category: 'nature', nameKey: 'thunder',          glyph: 'bolt',    color: '#b48cff', desc: 'Rolling thunder' }),
  S('waves',              { file: 'waves.mp3',              category: 'nature', nameKey: 'waves',            glyph: 'waves',   color: '#4ea8de', desc: 'Gentle shore waves', restorative: true }),
  S('crickets',           { file: 'crickets.mp3',           category: 'nature', nameKey: 'crickets',         glyph: 'moon',    color: '#a3d977', desc: 'Summer night crickets' }),
  S('jungle_night',       { file: 'jungle-night.mp3',       category: 'nature', nameKey: 'jungleNight',      glyph: 'moon',    color: '#4f9d69', desc: 'Tropical jungle after dark' }),
  S('jungle_river',       { file: 'jungle-river.mp3',       category: 'nature', nameKey: 'jungleRiver',      glyph: 'waves',   color: '#3aa6a0', desc: 'A river through the jungle', restorative: true }),
  S('monkeys',            { file: 'monkeys.mp3',            category: 'nature', nameKey: 'monkeys',          glyph: 'paw',     color: '#d9a441', desc: 'Monkeys calling in the canopy' }),
  S('elephant',           { file: 'elephant.mp3',           category: 'nature', nameKey: 'elephant',         glyph: 'paw',     color: '#a89f91', desc: 'Elephant trumpeting' }),
  S('leopard',            { file: 'leopard.mp3',            category: 'nature', nameKey: 'leopard',          glyph: 'paw',     color: '#e6b422', desc: 'A leopard nearby' }),
  S('ocean_deep',         { file: 'ocean-deep.mp3',         category: 'nature', nameKey: 'oceanDeep',        glyph: 'waves',   color: '#2f7f9a', desc: 'Deep ocean ambience', restorative: true }),
  S('underwater_ambient', { file: 'underwater-ambient.mp3', category: 'nature', nameKey: 'underwaterAmbient', glyph: 'bubbles', color: '#43b3c9', desc: 'Underwater pressure and bubbles' }),
  S('whales',             { file: 'whales.mp3',             category: 'nature', nameKey: 'whales',           glyph: 'whale',   color: '#6b7cff', desc: 'Whale song' }),
  S('dolphins',           { file: 'dolphins.mp3',           category: 'nature', nameKey: 'dolphins',         glyph: 'fish',    color: '#5cc8e0', desc: 'Dolphin clicks and whistles' }),

  // ---- Places -------------------------------------------------------------
  S('cafe',         { file: 'cafe.mp3',         category: 'places', nameKey: 'cafe',        glyph: 'cup',    color: '#e07a9a', desc: 'Coffee house murmur' }),
  S('train',        { file: 'train.mp3',        category: 'places', nameKey: 'train',       glyph: 'train',  color: '#c9a86a', desc: 'A passing train' }),
  S('city_traffic', { file: 'city-traffic.mp3', category: 'places', nameKey: 'cityTraffic', glyph: 'city',   color: '#c4b8a5', desc: 'Busy street' }),
  S('city_park',    { file: 'city-park.mp3',    category: 'places', nameKey: 'cityPark',    glyph: 'tree',   color: '#7fb069', desc: 'City park with distant voices' }),
  S('subway',       { file: 'subway.mp3',       category: 'places', nameKey: 'subway',      glyph: 'tunnel', color: '#8a8cf0', desc: 'Underground station' }),

  // ---- Healing ------------------------------------------------------------
  Y('bell',         { category: 'healing', nameKey: 'bell',        glyph: 'bell',   color: '#e0b458', desc: 'Bright bowl strike, 528 Hz. Synthesised.' }),
  S('singing-bowl', { file: 'singing-bowl.mp3', category: 'healing', nameKey: 'singingBowl', glyph: 'bowl',   color: '#d4a24c', desc: 'Deep singing bowl' }),
  S('gong',         { file: 'gong.mp3',         category: 'healing', nameKey: 'gong',        glyph: 'gong',   color: '#f0a35a', desc: 'Deep gong strike' }),
  S('gong_chinese', { file: 'gong-chinese.mp3', category: 'healing', nameKey: 'gongChinese', glyph: 'gong',   color: '#e08a4a', desc: 'Chinese gong' }),
  Y('gong_old',     { category: 'healing', nameKey: 'gongOld',     glyph: 'gong',   color: '#c98a5a', desc: 'Deep gong that blooms after the strike. Synthesised.' }),
  S('wind-chimes',  { file: 'wind-chimes.mp3',  category: 'healing', nameKey: 'windChimes',  glyph: 'chimes', color: '#9ed8ff', desc: 'Wind chimes in a breeze' }),
  // Chakra bowls are synthesised at their exact frequencies by InstrumentSynth.
  // They used to be pitch-shifted copies of a recording, which tied the realised
  // pitch to that file and left seven unlicensed mp3s in the repository.
  Y('bowl_c', { category: 'healing', nameKey: 'bowlC', glyph: 'bowl', color: '#e5484d', desc: 'Root, 256 Hz' }),
  Y('bowl_d', { category: 'healing', nameKey: 'bowlD', glyph: 'bowl', color: '#f0883e', desc: 'Sacral, 288 Hz' }),
  Y('bowl_e', { category: 'healing', nameKey: 'bowlE', glyph: 'bowl', color: '#e5c53a', desc: 'Solar plexus, 320 Hz' }),
  Y('bowl_f', { category: 'healing', nameKey: 'bowlF', glyph: 'bowl', color: '#46a758', desc: 'Heart, 341 Hz' }),
  Y('bowl_g', { category: 'healing', nameKey: 'bowlG', glyph: 'bowl', color: '#3e9bf0', desc: 'Throat, 384 Hz' }),
  Y('bowl_a', { category: 'healing', nameKey: 'bowlA', glyph: 'bowl', color: '#8e4ec6', desc: 'Third eye, 426 Hz' }),
  Y('bowl_b', { category: 'healing', nameKey: 'bowlB', glyph: 'bowl', color: '#e6e6e6', desc: 'Crown, 480 Hz' }),

  // ---- Instruments (offline-rendered) -------------------------------------
  Y('instr_piano',      { category: 'instruments', nameKey: 'piano',     glyph: 'piano',   color: '#e6e6e6', desc: 'Soft piano tone' }),
  Y('instr_synth-pad',  { category: 'instruments', nameKey: 'synthPad',  glyph: 'synth',   color: '#a78bfa', desc: 'Ambient synthesizer' }),
  Y('instr_bass',       { category: 'instruments', nameKey: 'bass',      glyph: 'bass',    color: '#f59e0b', desc: 'Deep bass tone' }),
  Y('instr_strings',    { category: 'instruments', nameKey: 'strings',   glyph: 'strings', color: '#f472b6', desc: 'String section' }),
  Y('instr_flute',      { category: 'instruments', nameKey: 'flute',     glyph: 'flute',   color: '#67e8f9', desc: 'Gentle flute' }),
  Y('instr_bell-synth', { category: 'instruments', nameKey: 'bellSynth', glyph: 'bell',    color: '#fbbf24', desc: 'Synthetic bells' }),
  Y('instr_drone',      { category: 'instruments', nameKey: 'drone',     glyph: 'drone',   color: '#c084fc', desc: 'Meditative drone' }),
  Y('instr_arpeggio',   { category: 'instruments', nameKey: 'arpeggio',  glyph: 'sparkle', color: '#22d3ee', desc: 'Ascending tone sequence' }),

  // ---- Frequencies (procedural) -------------------------------------------
  // Binaural beats are head-locked: each ear must get its own frequency.
  G('bw_delta', { gen: 'binaural', spatial: false, params: { carrier: 200, beat: 2.5, bed: 0.25 }, category: 'frequencies', nameKey: 'bwDelta', glyph: 'wave', color: '#5b6cff', desc: 'Delta 2.5 Hz, deep sleep range', evidence: 'weak', noteKey: 'noteBinaural', band: 'delta' }),
  G('bw_theta', { gen: 'binaural', spatial: false, params: { carrier: 200, beat: 6,   bed: 0.25 }, category: 'frequencies', nameKey: 'bwTheta', glyph: 'wave', color: '#3fa7d6', desc: 'Theta 6 Hz, meditation range',  evidence: 'weak', noteKey: 'noteBinaural', band: 'theta' }),
  G('bw_alpha', { gen: 'binaural', spatial: false, params: { carrier: 200, beat: 10,  bed: 0.25 }, category: 'frequencies', nameKey: 'bwAlpha', glyph: 'wave', color: '#2ec4b6', desc: 'Alpha 10 Hz, relaxed focus', evidence: 'weak', noteKey: 'noteBinaural', band: 'alpha' }),
  G('bw_beta',  { gen: 'binaural', spatial: false, params: { carrier: 200, beat: 15,  bed: 0.25 }, category: 'frequencies', nameKey: 'bwBeta',  glyph: 'wave', color: '#7bd389', desc: 'Beta 15 Hz, active attention',   evidence: 'weak', noteKey: 'noteBinaural', band: 'beta' }),
  G('bw_gamma', { gen: 'binaural', spatial: false, params: { carrier: 200, beat: 40,  bed: 0.25 }, category: 'frequencies', nameKey: 'bwGamma', glyph: 'wave', color: '#f4a261', desc: 'Gamma 40 Hz',                    evidence: 'weak', noteKey: 'noteGamma', band: 'gamma' }),
  G('iso_alpha', { gen: 'isochronic', params: { freq: 220, beat: 10, duty: 0.5 }, category: 'frequencies', nameKey: 'isoAlpha', glyph: 'pulse', color: '#2ec4b6', desc: 'Pulsed tone, 10 Hz. Works on speakers.', evidence: 'weak', noteKey: 'noteIsochronic', band: 'alpha' }),
  G('iso_theta', { gen: 'isochronic', params: { freq: 180, beat: 6,  duty: 0.5 }, category: 'frequencies', nameKey: 'isoTheta', glyph: 'pulse', color: '#3fa7d6', desc: 'Pulsed tone, 6 Hz',  evidence: 'weak', noteKey: 'noteIsochronic', band: 'theta' }),
  G('iso_gamma', { gen: 'isochronic', params: { freq: 240, beat: 40, duty: 0.5 }, category: 'frequencies', nameKey: 'isoGamma', glyph: 'pulse', color: '#f4a261', desc: 'Pulsed tone, 40 Hz', evidence: 'weak', noteKey: 'noteGamma', band: 'gamma' }),
  G('mono_alpha', { gen: 'monaural', params: { carrier: 200, beat: 10 }, category: 'frequencies', nameKey: 'monoAlpha', glyph: 'pulse', color: '#59c3a5', desc: 'Two tones beating in the air, 10 Hz', evidence: 'weak', noteKey: 'noteIsochronic', band: 'alpha' }),
  G('tone_pure',      { gen: 'tone', params: { freq: 432, harmonics: 0.15, vibrato: 0 }, category: 'frequencies', nameKey: 'tonePure',      glyph: 'tone',  color: '#e9c46a', desc: 'Sine tone, any frequency', evidence: 'none', noteKey: 'noteTone' }),
  G('tone_solfeggio', { gen: 'tone', params: { freq: 528, harmonics: 0.2,  vibrato: 0.3 }, category: 'frequencies', nameKey: 'toneSolfeggio', glyph: 'tone',  color: '#f2cc8f', desc: 'Solfeggio scale, 174 to 963 Hz', evidence: 'none', noteKey: 'noteSolfeggio' }),
  G('schumann',       { gen: 'schumann', params: { carrier: 136.1, beat: 7.83, depth: 0.8 }, category: 'frequencies', nameKey: 'schumann', glyph: 'drone', color: '#8ab17d', desc: 'Low tone pulsing at 7.83 Hz', evidence: 'none', noteKey: 'noteSchumann' }),
  G('noise_white', { gen: 'noise', params: { color: 'white', cutoff: 12000 }, category: 'frequencies', nameKey: 'noiseWhite', glyph: 'noise', color: '#d0d0d0', desc: 'Flat spectrum, masks speech', evidence: 'moderate', noteKey: 'noteNoiseFocus' }),
  G('noise_pink',  { gen: 'noise', params: { color: 'pink',  cutoff: 12000 }, category: 'frequencies', nameKey: 'noisePink',  glyph: 'noise', color: '#f4a3c2', desc: 'Softer, like steady rain',   evidence: 'moderate', noteKey: 'noteNoiseFocus' }),
  // No noise-colour trial covers brown specifically; only white and pink.
  G('noise_brown', { gen: 'noise', params: { color: 'brown', cutoff: 8000 },  category: 'frequencies', nameKey: 'noiseBrown', glyph: 'noise', color: '#b07d62', desc: 'Deep rumble. Masking and texture.', evidence: 'weak', noteKey: 'noteNoiseBrown' }),
  // A pacing cue belongs to the listener, not to a point in the room.
  G('breath', { gen: 'breath', spatial: false, params: { bpm: 6, inhale: 0.45, tone: 0.5 }, category: 'frequencies', nameKey: 'breath', glyph: 'breath', color: '#94d2bd', desc: 'Breathing pacer, 6 breaths per minute', evidence: 'moderate', noteKey: 'noteBreath' }),

  // ---- Generative ---------------------------------------------------------
  G('wind',    { gen: 'wind',    params: { brightness: 0.5, gust: 0.08, body: 0.5 },                          category: 'nature',     nameKey: 'genWind',    glyph: 'waves',   color: '#9fb8c9', desc: 'Gusting wind, synthesised', restorative: true }),
  G('stream',  { gen: 'stream',  params: { brightness: 0.5, burble: 0.5, depth: 0.5 },                        category: 'nature',     nameKey: 'genStream',  glyph: 'drop',    color: '#6fb4c9', desc: 'A running creek, synthesised', restorative: true }),
  G('pad',     { gen: 'pad',     params: { root: 110, chord: 'sus2', brightness: 0.4, movement: 0.4, detune: 7 }, category: 'generative', nameKey: 'genPad',     glyph: 'layers',  color: '#b5a0ff', desc: 'Slowly evolving chord pad' }),
  G('drone',   { gen: 'drone',   params: { freq: 55, richness: 0.5, movement: 0.3 },                            category: 'generative', nameKey: 'genDrone',   glyph: 'drone',   color: '#7c6cff', desc: 'Deep sub drone' }),
  G('shimmer', { gen: 'shimmer', params: { root: 880, density: 0.35, decay: 5 },                                category: 'generative', nameKey: 'genShimmer', glyph: 'sparkle', color: '#ffd6a5', desc: 'Sparse bell-like notes' }),
];

export const SOUND_INDEX = new Map(SOUNDS.map(s => [s.type, s]));

/** Map of type -> url for every sample (kept for older callers). */
export const SOUND_URLS = Object.fromEntries(SOUNDS.filter(s => s.kind === 'sample').map(s => [s.type, s.url]));

/**
 * Resolve a library entry. Unknown types (custom uploads, legacy ids) get a
 * synthesized descriptor so callers never have to null-check.
 */
export function getSound(type) {
  if (!type) return { type: 'custom', kind: 'sample', category: 'custom', glyph: 'file', color: '#ff7b7b', spatial: true, name: 'Custom' };
  const hit = SOUND_INDEX.get(type);
  if (hit) return hit;
  if (type.startsWith('custom')) {
    return { type, kind: 'sample', category: 'custom', glyph: 'file', color: '#ff7b7b', spatial: true, nameKey: 'customFile' };
  }
  if (type.startsWith('bw_')) {
    return { type, kind: 'generator', gen: 'binaural', spatial: false, params: { carrier: 200, beat: 10, bed: 0.25 }, category: 'frequencies', glyph: 'wave', color: '#2ec4b6', name: type };
  }
  return { type, kind: 'sample', category: 'custom', glyph: 'file', color: '#9a9a9a', spatial: true, name: type };
}

export function soundName(type) {
  const s = getSound(type);
  if (s.nameKey) return t(s.nameKey);
  return s.name || type;
}

export function soundColor(type) { return getSound(type).color; }
export function soundGlyph(type) { return getSound(type).glyph; }
export function isSpatial(type) { return getSound(type).spatial !== false; }
export function isFrequency(type) { return getSound(type).category === 'frequencies'; }

export function soundsByCategory(categoryId) {
  return SOUNDS.filter(s => s.category === categoryId);
}

/** Color lookup table in the shape older code expects (type -> hex). */
export function buildColorMap() {
  const m = {};
  for (const s of SOUNDS) m[s.type] = s.color;
  m.custom = '#ff7b7b';
  return m;
}

/** Brainwave band boundaries used for readouts and band pickers. */
export const BANDS = [
  { id: 'delta', min: 0.5, max: 4,  nameKey: 'bandDelta' },
  { id: 'theta', min: 4,   max: 8,  nameKey: 'bandTheta' },
  { id: 'alpha', min: 8,   max: 13, nameKey: 'bandAlpha' },
  { id: 'beta',  min: 13,  max: 30, nameKey: 'bandBeta' },
  { id: 'gamma', min: 30,  max: 100, nameKey: 'bandGamma' },
];

export function bandForBeat(hz) {
  return BANDS.find(b => hz >= b.min && hz < b.max) || BANDS[BANDS.length - 1];
}

export const SOLFEGGIO = [174, 285, 396, 417, 528, 639, 741, 852, 963];

/** Water and birdsong: the categories with the clearest restorative evidence. */
export function restorativeSounds() {
  return SOUNDS.filter(s => s.restorative);
}
