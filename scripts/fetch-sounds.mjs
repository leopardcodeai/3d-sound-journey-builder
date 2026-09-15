#!/usr/bin/env node
/**
 * fetch-sounds: check and fetch the candidate audio files listed in
 * scripts/sound-sources.json.
 *
 * Why this exists. Every file in public/sounds/ has to be redistributable on
 * its own, because this repo publishes loose .mp3 files under MIT and MIT
 * grants downstream users the right to copy and sell. Licences that forbid
 * standalone redistribution (Pixabay Content License), forbid commercial use
 * (CC-BY-NC), or forbid inclusion in a sound library (ZapSplat) are therefore
 * unusable here no matter how convenient the file is. Eight bundled files were
 * removed for exactly that reason on 2026-09-15.
 *
 * The trap this script is built around: a US federal agency page is public
 * domain only when the recording is the agency's own. The NPS says so itself,
 * "some content is protected by third party rights". So the script never
 * hard-codes an audio URL. It reads the source page, extracts both the audio
 * URL and the credit line, and refuses any file whose credit is not the
 * agency. A page that changes its credit tomorrow fails tomorrow.
 *
 * Usage:
 *   node scripts/fetch-sounds.mjs              # check only, writes nothing
 *   node scripts/fetch-sounds.mjs --apply      # also download what passed
 *   node scripts/fetch-sounds.mjs --apply --force   # re-download existing files
 *   node scripts/fetch-sounds.mjs --only stream,wolf
 *
 * Idempotent: a file already in public/sounds/ is left alone unless --force.
 * After --apply, run `npm run audit:audio`; the new files still need an entry
 * in src/data/SoundLibrary.js before the app can use them.
 */

import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = join(ROOT, 'scripts', 'sound-sources.json');
const OUT_DIR = join(ROOT, 'public', 'sounds');
const RECORD = join(ROOT, 'docs', 'sound-provenance.json');

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const FORCE = args.includes('--force');
const ONLY = (() => {
  const i = args.indexOf('--only');
  return i >= 0 && args[i + 1] ? new Set(args[i + 1].split(',').map(s => s.trim())) : null;
})();

const UA = 'sound-journey-builder/2.0 (+https://github.com/leopardcodeai/3d-sound-journey-builder)';

function die(msg) {
  console.error(`\n  ${msg}\n`);
  process.exit(1);
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/** Strips tags and collapses whitespace, so credit text can be matched. */
export function textOf(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, '\n')
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
    .split('\n').map(s => s.trim()).filter(Boolean);
}

/**
 * Reads the audio URL and the credit out of a source page.
 * The credit is the first non-empty line after a "Credit" label; pages that
 * do not carry one are rejected rather than assumed to be the agency's.
 */
export function parsePage(html, pageUrl) {
  const audio = [...html.matchAll(/https?:\/\/[^"'\s]+?\.mp3/gi)].map(m => m[0]);
  const lines = textOf(html);
  let credit = null;
  for (let i = 0; i < lines.length; i++) {
    if (/^credit\b|^credit\s*\/\s*author/i.test(lines[i])) {
      credit = lines[i].includes(':') && lines[i].split(':')[1].trim()
        ? lines[i].split(':').slice(1).join(':').trim()
        : (lines[i + 1] || null);
      break;
    }
  }
  return { audio: audio[0] || null, credit, pageUrl };
}

/**
 * True when the credit line begins with one of the agency tokens.
 *
 * The agency token has to lead the credit, not merely appear in it.
 * "NPS / Theresa Thom" is a staff recording and so a federal work, in the
 * public domain. "Recording by an outside person, courtesy of NPS" is that
 * person's copyright and must not end up in this repo. A substring test cannot
 * tell those two apart; a prefix test can.
 */
export function creditLeadsWith(credit, agencies) {
  if (typeof credit !== 'string' || !credit.trim()) return false;
  const text = credit.trim();
  return agencies.some((a) => {
    const escaped = a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`^${escaped}\\b`, 'i').test(text);
  });
}

async function headInfo(url) {
  const res = await fetch(url, { method: 'HEAD', headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return {
    type: res.headers.get('content-type') || '',
    bytes: parseInt(res.headers.get('content-length') || '0', 10),
  };
}

async function exists(p) {
  try { await stat(p); return true; } catch { return false; }
}

function kb(n) { return `${(n / 1024).toFixed(0)}K`; }

async function main() {
  let manifest;
  try {
    manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
  } catch (e) {
    die(`Cannot read ${MANIFEST}: ${e.message}`);
  }

  const entries = manifest.entries.filter(e => !ONLY || ONLY.has(e.type));
  if (entries.length === 0) die('No entries selected.');

  console.log(`\n  ${APPLY ? 'Fetching' : 'Checking'} ${entries.length} candidate sounds`);
  console.log(`  Target: public/sounds/${APPLY ? '' : '   (nothing will be written)'}\n`);
  console.log(`  ${'file'.padEnd(17)}${'size'.padEnd(7)}${'credit'.padEnd(10)}status`);
  console.log(`  ${'-'.repeat(62)}`);

  const results = [];
  let failed = 0;
  let written = 0;
  let skipped = 0;

  for (const e of entries) {
    const src = manifest.sources[e.source];
    const row = { ...e, licence: src ? src.licence : null };
    const out = join(OUT_DIR, e.file);
    let note = '';

    try {
      if (!src) throw new Error(`unknown source "${e.source}"`);

      const html = await fetchText(e.page);
      const { audio, credit } = parsePage(html, e.page);
      if (!audio) throw new Error('no audio link on the page');
      if (!credit) throw new Error('page carries no credit line');

      if (!creditLeadsWith(credit, src.creditMustStartWith)) {
        throw new Error(`credit "${credit}" does not lead with the agency`);
      }

      const info = await headInfo(audio);
      if (!/audio\//i.test(info.type)) throw new Error(`content-type is ${info.type}`);

      row.audio = audio;
      row.credit = credit;
      row.bytes = info.bytes;

      const here = await exists(out);
      if (!APPLY) {
        note = here ? 'would keep (already here)' : 'would fetch';
        if (here) skipped++;
      } else if (here && !FORCE) {
        note = 'kept (already here)';
        skipped++;
      } else {
        const res = await fetch(audio, { headers: { 'user-agent': UA } });
        if (!res.ok) throw new Error(`download HTTP ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        await mkdir(OUT_DIR, { recursive: true });
        await writeFile(out, buf);
        row.sha256 = createHash('sha256').update(buf).digest('hex');
        row.bytes = buf.length;
        note = here ? 'replaced' : 'written';
        written++;
      }

      row.status = 'ok';
      console.log(`  ${e.file.padEnd(17)}${kb(row.bytes).padEnd(7)}${String(credit).slice(0, 8).padEnd(10)}${note}`);
    } catch (err) {
      failed++;
      row.status = 'rejected';
      row.reason = err.message;
      console.log(`  ${e.file.padEnd(17)}${'-'.padEnd(7)}${'-'.padEnd(10)}REJECTED: ${err.message}`);
    }

    row.checked = new Date().toISOString().slice(0, 10);
    results.push(row);
  }

  console.log(`  ${'-'.repeat(62)}`);
  const passed = results.filter(r => r.status === 'ok').length;
  console.log(`\n  ${passed} passed, ${failed} rejected, ${skipped} already present${APPLY ? `, ${written} written` : ''}`);

  if (APPLY && written > 0) {
    await mkdir(dirname(RECORD), { recursive: true });
    let prior = {};
    try { prior = JSON.parse(await readFile(RECORD, 'utf8')); } catch { /* first run */ }
    const byFile = { ...(prior.files || {}) };
    for (const r of results) {
      if (r.status !== 'ok' || !r.sha256) continue;
      byFile[r.file] = {
        type: r.type, name: r.name, source: r.source, page: r.page,
        audio: r.audio, credit: r.credit, licence: r.licence,
        bytes: r.bytes, sha256: r.sha256, retrieved: r.checked,
      };
    }
    await writeFile(RECORD, `${JSON.stringify({ sources: manifest.sources, files: byFile }, null, 2)}\n`);
    console.log(`  Provenance written to docs/sound-provenance.json`);
    console.log(`\n  Next: add an entry per file to src/data/SoundLibrary.js, then npm run audit:audio\n`);
  } else if (!APPLY) {
    console.log(`\n  Nothing was written. Re-run with --apply to fetch.\n`);
  } else {
    console.log('');
  }

  process.exit(failed > 0 ? 1 : 0);
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) main().catch(e => die(e.stack || e.message));
