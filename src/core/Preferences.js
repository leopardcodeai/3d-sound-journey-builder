/**
 * Preferences: the settings that should survive a reload.
 *
 * Before this module the app remembered the interface language and saved
 * scenes, nothing else. Output mode, listener posture, head tilt, the shoulder
 * and ear filters, the room level, the master level and the choice of what to
 * open on start were all rebuilt from hard-coded defaults on every visit, so a
 * user on speakers had to switch away from HRTF every single time.
 *
 * Everything read back from storage is treated as hostile: the store is shared
 * with whatever else runs on the origin, it survives version changes, and a
 * NaN reaching an AudioParam throws and takes the graph down with it. Every
 * field is clamped or dropped, and a blocked or corrupt store degrades to the
 * defaults rather than failing.
 */

const KEY = 'sjb_prefs';

export const OUTPUT_MODES = ['stereo-headphones', 'stereo-speakers', 'surround-5.1', 'custom'];
export const POSTURES = ['standing', 'lying-back', 'lying-side'];

/** What the app opens with. A journey id, a set id, or one of these two. */
// Not 'focus'. That is also the id of the Deep work journey, and openTarget
// checked this first, so that journey could never be started from the setting.
export const START_FOCUS = 'frequencies';
export const START_EMPTY = 'empty';

export const DEFAULTS = Object.freeze({
  output: 'stereo-headphones',
  room: 0.3,
  posture: 'standing',
  headTilt: 0,
  headTurn: 0,
  shoulder: 0.5,
  pinna: 0.5,
  masterVolume: 0.5,
  startWith: 'meditate',
  rememberStart: true,
  // What the field looks like. These were toolbar toggles that reset on every
  // reload, so anyone who works without labels had to switch them off again
  // each visit.
  fieldMode: '2d',
  showLabels: true,
  showGrid: true,
  showPaths: true,
  snap: true,
  followDevice: false,
});

const num = (min, max) => (v, fallback) => {
  const n = typeof v === 'number' ? v : parseFloat(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
};

const oneOf = (list) => (v, fallback) => (list.includes(v) ? v : fallback);

// One optional kind prefix, so "journey:storm" and "set:storm" can be told
// apart. They could not be: both were stored as "storm" and the set always won.
const id = (v, fallback) => (typeof v === 'string' && /^[A-Za-z0-9_-]{1,20}:?[A-Za-z0-9_-]{0,40}$/.test(v) ? v : fallback);

const bool = (v, fallback) => (typeof v === 'boolean' ? v : fallback);

const FIELDS = {
  output: oneOf(OUTPUT_MODES),
  room: num(0, 1),
  posture: oneOf(POSTURES),
  // The slider runs to plus and minus 90 and the listener maths handles any
  // angle, so the store must not be narrower than the control. It was, and a
  // tilt of 80 degrees came back as 45 after a reload without saying so.
  headTilt: num(-90, 90),
  headTurn: num(-180, 180),
  shoulder: num(0, 1),
  pinna: num(0, 1),
  masterVolume: num(0, 1),
  startWith: id,
  rememberStart: bool,
  fieldMode: oneOf(['2d', '3d']),
  showLabels: bool,
  showGrid: bool,
  showPaths: bool,
  snap: bool,
  followDevice: bool,
};

/**
 * Coerces an arbitrary object into a valid preferences object. Unknown keys are
 * dropped, invalid values fall back to their default, and the result is always
 * complete, so callers never have to guard a field.
 */
export function sanitisePrefs(raw) {
  const out = { ...DEFAULTS };
  if (!raw || typeof raw !== 'object') return out;
  for (const [key, coerce] of Object.entries(FIELDS)) {
    if (Object.prototype.hasOwnProperty.call(raw, key)) {
      out[key] = coerce(raw[key], DEFAULTS[key]);
    }
  }
  return out;
}

function storage() {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch (e) {
    return null;   // private mode, blocked site data
  }
}

/** Reads the stored preferences, or the defaults when nothing usable is there. */
export function loadPrefs() {
  const store = storage();
  if (!store) return { ...DEFAULTS };
  try {
    const text = store.getItem(KEY);
    if (!text) return { ...DEFAULTS };
    return sanitisePrefs(JSON.parse(text));
  } catch (e) {
    return { ...DEFAULTS };
  }
}

/**
 * Merges a patch into the stored preferences and writes them back.
 * Returns the full preferences object as stored, so a caller can use the
 * clamped value rather than the one it passed in.
 */
export function savePrefs(patch) {
  const next = sanitisePrefs({ ...loadPrefs(), ...(patch || {}) });
  const store = storage();
  if (store) {
    try { store.setItem(KEY, JSON.stringify(next)); } catch (e) { /* quota or blocked */ }
  }
  return next;
}

/** Drops the stored preferences. Used by "Clear all". */
export function resetPrefs() {
  const store = storage();
  if (store) {
    try { store.removeItem(KEY); } catch (e) { /* blocked */ }
  }
  return { ...DEFAULTS };
}
