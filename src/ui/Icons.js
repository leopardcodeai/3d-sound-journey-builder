/**
 * Icons
 * A small stroke-based line icon set (24 x 24 grid, 1.6 px stroke) used both
 * as inline SVG in the DOM and as Path2D glyphs on the canvas. Everything is
 * plain path data, so one definition serves both renderers.
 */

// Circle as path data (SVG arcs), so canvas Path2D can draw it too.
const c = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0`;

export const ICONS = {
  // ---- transport / controls ----
  play:     ['M7 4.5v15l12-7.5z'],
  pause:    ['M8 5v14M16 5v14'],
  stop:     ['M6 6h12v12H6z'],
  loop:     ['M12 12c-2-3-3.2-4.5-5.5-4.5a4.5 4.5 0 0 0 0 9C8.8 16.5 10 15 12 12s3.2-4.5 5.5-4.5a4.5 4.5 0 0 1 0 9C15.2 16.5 14 15 12 12z'],
  once:     ['M4 12h13M13 7l5 5-5 5M21 5v14'],
  plus:     ['M12 5v14M5 12h14'],
  minus:    ['M5 12h14'],
  close:    ['M6 6l12 12M18 6L6 18'],
  check:    ['M5 12l5 5 9-10'],
  chevronDown:  ['M6 9l6 6 6-6'],
  chevronUp:    ['M6 15l6-6 6 6'],
  chevronRight: ['M9 6l6 6-6 6'],
  chevronLeft:  ['M15 6l-6 6 6 6'],
  more:     [c(5, 12, 1.2), c(12, 12, 1.2), c(19, 12, 1.2)],
  settings: ['M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1', c(15, 6, 2), c(9, 12, 2), c(17, 18, 2)],
  home:     ['M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z'],
  compass:  [c(12, 12, 9), 'M15.5 8.5l-2 5-5 2 2-5z'],
  cube:     ['M12 3l8 4.5v9L12 21l-8-4.5v-9z', 'M12 12l8-4.5M12 12v9M12 12L4 7.5'],
  grid:     ['M4 4h16v16H4zM4 12h16M12 4v16'],
  clock:    [c(12, 12, 9), 'M12 7v5l3 2'],
  timer:    ['M10 2h4M12 8v5l3 2', c(12, 14, 8)],
  layers:   ['M12 3l9 5-9 5-9-5z', 'M3 13l9 5 9-5', 'M3 17l9 5 9-5'],
  save:     ['M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6'],
  share:    ['M9 12l6-3.5M9 12l6 3.5', c(18, 6, 2.5), c(6, 12, 2.5), c(18, 18, 2.5)],
  trash:    ['M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3'],
  mute:     ['M4 10v4h4l5 4V6L8 10zM17 9l4 6M21 9l-4 6'],
  volume:   ['M4 10v4h4l5 4V6L8 10zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11'],
  undo:     ['M9 14L4 9l5-5M4 9h9a7 7 0 0 1 0 14h-3'],
  redo:     ['M15 14l5-5-5-5M20 9h-9a7 7 0 0 0 0 14h3'],
  search:   [c(11, 11, 7), 'M16 16l5 5'],
  focus:    [c(12, 12, 8), c(12, 12, 3), 'M12 2v3M12 19v3M2 12h3M19 12h3'],
  map:      ['M3 20l6-2 6 2 6-2V4l-6 2-6-2-6 2zM9 4v14M15 6v14'],
  headphones: ['M4 15v-3a8 8 0 0 1 16 0v3', 'M4 15a2 2 0 0 1 2-2h1v6H6a2 2 0 0 1-2-2z', 'M20 15a2 2 0 0 0-2-2h-1v6h1a2 2 0 0 0 2-2z'],
  speaker:  ['M6 3h12v18H6z', c(12, 15, 3.5), c(12, 7.5, 1.2)],
  person:   [c(12, 5, 3), 'M6 21v-5a6 6 0 0 1 12 0v5'],
  bed:      ['M3 7v12M3 14h18v5M21 14v-2a3 3 0 0 0-3-3h-7v5', c(6.5, 10.5, 1.5)],
  side:     [c(8, 6, 2.5), 'M5 20c0-6 3-8 6-8h5a3 3 0 0 1 0 6h-4'],
  sun:      [c(12, 12, 4), 'M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4'],
  moon:     ['M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z'],
  info:     [c(12, 12, 9), 'M12 8h.01M12 11v5'],
  lock:     ['M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4'],
  keyframe: ['M12 3l9 9-9 9-9-9z'],
  record:   [c(12, 12, 8), c(12, 12, 3)],
  fit:      ['M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5'],
  move:     ['M12 2v20M2 12h20M12 2l-3 3M12 2l3 3M12 22l-3-3M12 22l3-3M2 12l3-3M2 12l3 3M22 12l-3-3M22 12l-3 3'],
  orbit:    [c(12, 12, 3), 'M2 12a10 4.5 0 1 0 20 0a10 4.5 0 1 0-20 0'],
  pingpong: ['M3 12h18M3 12l4-4M3 12l4 4M21 12l-4-4M21 12l-4 4'],
  drift:    ['M4 18c2-6 5-8 7-6s1 6 4 6 4-8 5-12'],
  breathe:  [c(12, 12, 3), c(12, 12, 7.5), 'M12 1.5v2M12 20.5v2M1.5 12h2M20.5 12h2'],
  upload:   ['M12 16V4M7 9l5-5 5 5M4 20h16'],
  link:     ['M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1', 'M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1'],
  external: ['M14 4h6v6M20 4l-9 9M18 13v6H5V6h6'],
  snap:     ['M4 4v16M20 4v16M8 12h8M12 8v8'],
  solo:     ['M7 15a3 3 0 0 0 3 3h4a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h4a3 3 0 0 1 3 3'],
  mark:     ['M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11z', c(12, 10, 2.5)],
  brackets: ['M8 4H4v4M16 4h4v4M8 20H4v-4M16 20h4v-4'],
  heart:    ['M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z'],
  github:   ['M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21'],

  // ---- sound glyphs ----
  bird:     ['M21 9l-3 1.5V10a4 4 0 0 0-4-4c-3 0-4 3-7 4.5L3 12c2 2 4 3 7 3h1l-3 4h4l2-4c3 0 5-2 5-5l2-1z'],
  leaf:     ['M4 20c0-8 5-14 16-16-1 11-7 16-14 16', 'M4 20c4-6 8-9 12-11'],
  flame:    ['M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z'],
  drop:     ['M12 3c3 4 6 7 6 11a6 6 0 0 1-12 0c0-4 3-7 6-11z'],
  bolt:     ['M13 2L4 14h7l-1 8 9-12h-7z'],
  waves:    ['M2 8c2.5 0 2.5 2 5 2s2.5-2 5-2 2.5 2 5 2 2.5-2 5-2', 'M2 14c2.5 0 2.5 2 5 2s2.5-2 5-2 2.5 2 5 2 2.5-2 5-2'],
  bubbles:  [c(8, 15, 4), c(16, 9, 3), c(15, 18, 1.8), c(7, 6, 1.8)],
  whale:    ['M2 12c3-5 8-6 13-6 2 0 4 1 7 4-3 3-5 4-7 4-5 0-10-1-13-2z', 'M17 6l3-3v5M14 14l2 4-4-1'],
  fish:     ['M3 12c3-4 7-6 12-6l6 3-6 3c-5 0-9 2-12 0z', 'M15 6l3-3M15 12l3 3', c(7, 10, 0.8)],
  paw:      [c(7.5, 10, 1.8), c(10.5, 6, 1.8), c(13.5, 6, 1.8), c(16.5, 10, 1.8), 'M12 11c-3 0-5 2.5-5 5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2c0-2.5-2-5-5-5z'],
  cup:      ['M4 8h13v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM17 10h2a2 2 0 0 1 0 4h-2M7 3v2M11 3v2'],
  train:    ['M6 4h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M4 10h16M8 17l-1.5 3M16 17l1.5 3', c(8, 14, 1), c(16, 14, 1)],
  city:     ['M3 21V9l5-2v14M8 21V3l6 3v15M14 21v-8l7-2v10M3 21h18'],
  tree:     ['M12 3l6 8h-3l4 6H5l4-6H6zM12 17v4'],
  tunnel:   ['M4 20V12a8 8 0 0 1 16 0v8M8 20v-4h8v4M4 20h16'],
  bowl:     ['M3 10h18c0 5-4 9-9 9s-9-4-9-9z', 'M8 20h8'],
  gong:     [c(12, 13, 7), c(12, 13, 2.5), 'M3 4h18M6 4v3M18 4v3'],
  chimes:   ['M4 4h16M7 4v10M11 4v14M15 4v8M19 4v12'],
  bell:     ['M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 21h4'],
  piano:    ['M3 5h18v14H3zM8 5v8M12 5v8M16 5v8'],
  synth:    ['M3 6h18v12H3z', c(7, 12, 2), c(12, 12, 2), c(17, 12, 2)],
  bass:     ['M15 3l6 6-2 2-2-2-4 4a5 5 0 1 1-2-2l4-4-2-2z'],
  strings:  ['M4 20L20 4M6 12l6 6M15 5l4 4'],
  flute:    ['M3 12h18', c(7, 12, 1), c(11, 12, 1), c(15, 12, 1)],
  drone:    ['M2 12c3-7 5-7 8 0s5 7 8 0 3-3 4 0'],
  sparkle:  ['M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z', 'M19 15l1 2 2 1-2 1-1 2-1-2-2-1 2-1z'],
  wave:     ['M2 12c1.7-5 3.3-5 5 0s3.3 5 5 0 3.3-5 5-5 3.3 5 5 0'],
  pulse:    ['M2 16h4V8h4v8h4V8h4v8h4'],
  noise:    ['M3 11v2M6 8v8M9 5v14M12 10v4M15 3v18M18 8v8M21 11v2'],
  tone:     [c(12, 12, 2), 'M7.5 7.5a6.4 6.4 0 0 0 0 9M16.5 7.5a6.4 6.4 0 0 1 0 9M4.5 4.5a10.6 10.6 0 0 0 0 15M19.5 4.5a10.6 10.6 0 0 1 0 15'],
  breath:   ['M12 4v8', 'M12 12c-2 0-3 1-3.5 3.5S7 20 5 20s-2-5 0-7 3-3 7-1', 'M12 12c2 0 3 1 3.5 3.5s1.5 4.5 3.5 4.5 2-5 0-7-3-3-7-1'],
  brain:    ['M12 4a4 4 0 0 0-4 4 4 4 0 0 0-3 4 4 4 0 0 0 3 4 3 3 0 0 0 4 3V4z', 'M12 4a4 4 0 0 1 4 4 4 4 0 0 1 3 4 4 4 0 0 1-3 4 3 3 0 0 1-4 3V4'],
  file:     ['M6 3h8l4 4v14H6zM14 3v4h4'],
  logo:     [c(12, 12, 9), c(12, 12, 4.5), 'M12 3v4M12 17v4M3 12h4M17 12h4'],
};

/**
 * Inline SVG markup for an icon.
 * @param {string} name
 * @param {{size?:number, cls?:string, stroke?:number, title?:string}} [opts]
 */
export function icon(name, opts = {}) {
  const paths = ICONS[name] || ICONS.info;
  const size = opts.size || 16;
  const cls = opts.cls ? ` ${opts.cls}` : '';
  const sw = opts.stroke || 1.6;
  const title = opts.title ? `<title>${opts.title}</title>` : '';
  return `<svg class="ic${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${title}${paths.map(d => `<path d="${d}"/>`).join('')}</svg>`;
}

/** Filled variant (play triangle, stop square) */
export function iconFilled(name, opts = {}) {
  const paths = ICONS[name] || ICONS.info;
  const size = opts.size || 16;
  const cls = opts.cls ? ` ${opts.cls}` : '';
  return `<svg class="ic${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round" aria-hidden="true">${paths.map(d => `<path d="${d}"/>`).join('')}</svg>`;
}

const path2dCache = new Map();

/**
 * Path2D list for drawing an icon on a canvas. Draw with:
 *   ctx.save(); ctx.translate(x - s/2, y - s/2); ctx.scale(s/24, s/24);
 *   for (const p of glyphPaths(name)) ctx.stroke(p); ctx.restore();
 */
export function glyphPaths(name) {
  if (typeof Path2D === 'undefined') return [];
  if (!path2dCache.has(name)) {
    const paths = ICONS[name] || ICONS.info;
    path2dCache.set(name, paths.map(d => new Path2D(d)));
  }
  return path2dCache.get(name);
}

/**
 * Stroke an icon centred at (x, y) with the given pixel size on a 2D context.
 * The line width is scaled back so strokes stay a constant pixel width.
 */
export function drawGlyph(ctx, name, x, y, size, lineWidth = 1.5) {
  const paths = glyphPaths(name);
  if (!paths.length) return;
  const k = size / 24;
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2);
  ctx.scale(k, k);
  ctx.lineWidth = lineWidth / k;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const p of paths) ctx.stroke(p);
  ctx.restore();
}

/** Replace every `<i data-icon="name" data-size="16">` placeholder in a root. */
export function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach(el => {
    const name = el.dataset.icon;
    const size = parseInt(el.dataset.size || '16', 10);
    el.innerHTML = icon(name, { size, stroke: parseFloat(el.dataset.stroke || '1.6') });
    el.classList.add('ic-wrap');
  });
}
