#!/usr/bin/env node
/**
 * audit-audio — what is in public/sounds, and does it match the library?
 *
 * Why this exists: the bundled audio arrived in one commit with no record of
 * where it came from, and the library in src/data/SoundLibrary.js is the only
 * place that says which file belongs to which sound. Those two can drift apart
 * silently — a deleted file leaves an entry pointing at nothing, and a new file
 * nobody references just sits there. This reports both, plus everything that
 * can be established about a file from its own bytes.
 *
 * Reads only. Never writes, never downloads.
 *
 *   node scripts/audit-audio.mjs           report
 *   node scripts/audit-audio.mjs --json    machine-readable
 *
 * Exit code 1 when the library and the folder disagree, so it can gate a
 * release. Expected on a healthy tree: "no problems".
 *
 * ffprobe (from ffmpeg) is used for duration and tags when present. Without it
 * the report still works, minus those two columns.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const soundsDir = join(root, 'public', 'sounds');
const asJson = process.argv.includes('--json');

const hasFfprobe = (() => {
  try { execFileSync('ffprobe', ['-version'], { stdio: 'ignore' }); return true; }
  catch { return false; }
})();

function probe(file) {
  if (!hasFfprobe) return {};
  try {
    const out = execFileSync('ffprobe', [
      '-v', 'quiet', '-print_format', 'json',
      '-show_format', '-show_streams', file,
    ], { encoding: 'utf8' });
    const d = JSON.parse(out);
    const stream = (d.streams || [])[0] || {};
    return {
      duration: d.format?.duration ? Number(d.format.duration) : null,
      sampleRate: stream.sample_rate ? Number(stream.sample_rate) : null,
      channels: stream.channels ?? null,
      tags: { ...(d.format?.tags || {}) },
    };
  } catch {
    return {};
  }
}

/** The encoder writes its name near the start of the file; that is a clue to origin. */
function encoder(file) {
  const head = readFileSync(file).subarray(0, 4096).toString('latin1');
  const m = head.match(/LAME\d+\.\d+[a-z]?|GarageBand [\d.]+|Lavf[\d.]+/);
  return m ? m[0] : '';
}

/** Types the library expects to find as files on disk. */
function libraryFiles() {
  const src = readFileSync(join(root, 'src', 'data', 'SoundLibrary.js'), 'utf8');
  const wanted = new Map();
  // S('type', { file: 'name.mp3', ... })
  for (const m of src.matchAll(/S\('([^']+)',\s*\{[^}]*file:\s*'([^']+)'/g)) {
    wanted.set(m[2], m[1]);
  }
  return wanted;
}

const files = existsSync(soundsDir)
  ? readdirSync(soundsDir).filter(f => /\.(mp3|ogg|wav|m4a|opus)$/i.test(f)).sort()
  : [];

const wanted = libraryFiles();
const rows = files.map(name => {
  const full = join(soundsDir, name);
  const info = probe(full);
  return {
    file: name,
    referencedBy: wanted.get(name) || null,
    bytes: statSync(full).size,
    sha256: createHash('sha256').update(readFileSync(full)).digest('hex'),
    encoder: encoder(full),
    duration: info.duration ?? null,
    sampleRate: info.sampleRate ?? null,
    tags: info.tags && Object.keys(info.tags).length ? info.tags : null,
  };
});

const orphans = rows.filter(r => !r.referencedBy).map(r => r.file);
const missing = [...wanted.entries()]
  .filter(([file]) => !files.includes(file))
  .map(([file, type]) => ({ file, type }));

if (asJson) {
  console.log(JSON.stringify({ rows, orphans, missing, generated: new Date().toISOString() }, null, 2));
  process.exit(orphans.length || missing.length ? 1 : 0);
}

const mb = (n) => (n / 1048576).toFixed(2);
const total = rows.reduce((n, r) => n + r.bytes, 0);

console.log(`\n${rows.length} files in public/sounds, ${mb(total)} MB total\n`);
console.log('FILE                        SIZE      DUR    RATE   ENCODER          USED BY');
console.log('-'.repeat(92));
for (const r of rows) {
  const dur = r.duration ? `${r.duration.toFixed(0)}s`.padStart(5) : '    ?';
  const rate = r.sampleRate ? String(r.sampleRate).padStart(6) : '     ?';
  console.log(
    `${r.file.padEnd(26)} ${mb(r.bytes).padStart(7)}M ${dur} ${rate}   ${(r.encoder || '-').padEnd(16)} ${r.referencedBy || '(unused)'}`
  );
  if (r.tags) console.log(`${' '.repeat(28)}tags: ${Object.entries(r.tags).map(([k, v]) => `${k}=${String(v).slice(0, 60)}`).join(', ')}`);
}

const groups = new Map();
for (const r of rows) {
  const key = r.encoder || '(none)';
  groups.set(key, (groups.get(key) || 0) + 1);
}
console.log('\nEncoders, one group per origin:');
for (const [enc, n] of [...groups].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(3)}  ${enc}`);

let bad = false;
if (orphans.length) {
  bad = true;
  console.log(`\nNot referenced by the library (${orphans.length}):`);
  for (const f of orphans) console.log(`  ${f}`);
}
if (missing.length) {
  bad = true;
  console.log(`\nReferenced by the library but not on disk (${missing.length}):`);
  for (const m of missing) console.log(`  ${m.file}  <- ${m.type}`);
}
console.log(bad ? '\nProblems found.\n' : '\nNo problems: every file is used, every entry has its file.\n');
console.log('Licence status per file: docs/ATTRIBUTION.md\n');
process.exit(bad ? 1 : 0);
