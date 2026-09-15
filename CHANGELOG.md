# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-09-15

A rebuild of the audio engine, the spatial view, the timeline and the interface.

### Added

- **Procedural generators** (`src/audio/Generators.js`): binaural, monaural and
  isochronic beats, pure and solfeggio tones, a Schumann-style pulse, white,
  pink and brown noise, a breathing pacer, an evolving pad, a deep drone and a
  sparse shimmer. Each exposes typed parameters that drive the inspector.
- **Focus view**: a single-screen player with six session modes, a countdown
  ring that follows the breathing pacer, a live frequency readout and per-layer
  controls.
- **Landing page** at `/` describing the features, with the app at `/app`.
- **Evidence labels** on every frequency tool, sourced from a literature review
  in `docs/research`, shown in the library and the inspector.
- **Per-source inserts**: low-pass, high-pass, playback speed, tremolo and a
  reverb send.
- **Master bus**: shared convolution reverb and a soft limiter.
- **Per-source analysers** so node halos and ripples follow the real signal.
- **Timeline**: draggable keyframes with volume envelopes, mute and solo per
  track, named journey sections, zoom-aware snapping and fit to view.
- **Undo** for keyframe moves, parameter changes and motion changes.
- **Camera module** with a tested inverse projection, so picking and dragging
  are exact in the tilted 3D view.
- **Line icon set** used by both the DOM and the canvas.
- **Evidence notes**: each frequency tool carries a one-line reason next to its
  grade, not just a verdict. A binaural source shows a headphone warning and a
  one-click swap to an isochronic pulse that survives on speakers.
- **Session phases**: focus sessions run settling, main and wind-down. A
  calming session tapers its own generators on the way out, slowing the beat
  toward delta, darkening the noise and dulling the pad, instead of only
  lowering the master.
- **Suggested mode** for the current hour in the focus view.
- **Two journeys**: Restore, built only from water and birdsong, and an
  hour-long Sound bath with the seven chakra bowls entering in order.
- **Tests**: 181 unit tests across the engine, generators, camera, timeline,
  presets, scenes, undo and i18n, up from 104.

### Changed

- **Research**: two literature reviews in `docs/research`, one on competing
  apps and the evidence behind each technique, one on where audio and
  frequency data can be sourced and what each licence allows.
- **Attribution**: `docs/ATTRIBUTION.md` records that the provenance of the
  bundled samples was never documented and states what has to happen before
  they can be treated as redistributable.
- **Sound library** is now one registry (`src/data/SoundLibrary.js`) that every
  surface reads from. Adding a sound is a single entry.
- **Journeys** are generated from path and envelope helpers instead of
  hand-written keyframe lists, and open at a useful level within ten seconds
  rather than fading in over several minutes.
- **Visual language**: near-black ground, hairline rules, one warm accent,
  monospace for every number, and line icons in place of emoji.
- **Breathing pacer and binaural beats** are head-locked, and the interface
  explains why.
- **Scenes** now persist generator parameters, track mute and solo state, and
  journey sections.
- Dependencies updated: Vite 8.3, Vitest 5, jsdom 30, Playwright 1.63.

### Fixed

- Level meters read silence as silence. An analyser with no path to the
  destination never ran, so an unwritten buffer was being measured as full
  scale.
- The field paints on load even when the tab starts hidden, instead of staying
  blank until the first visible frame.
- Removed four placeholder audio files that contained an HTML 404 page.
- Brown noise is graded as weak evidence; no noise-colour trial covers it.

### Removed

- `ControlPanel.js`, `ControlPanelEvents.js` and `EventBindings.js`, replaced by
  `Library.js`, `Inspector.js`, `FocusView.js` and a slimmer `main.js`.

## [1.0.0] - 2026-06-06

First public version: spatial audio engine, drag-and-drop canvas, keyframe
timeline, activity presets and scene sharing.
