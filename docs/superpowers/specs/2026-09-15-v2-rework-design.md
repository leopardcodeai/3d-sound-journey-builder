# Sound Journey Builder v2: Rework Design

**Date:** 2026-09-15
**Status:** In implementation
**Scope:** Whole app: audio engine, sound library, spatial 3D view, timeline, inspector, a new Focus view, a landing page, visual redesign.

## 1. Goals

1. More depth in what can be heard: real frequency tools (binaural, isochronic, monaural, pure tones, noise colors, breath pacer, Schumann-style modulation), generative layers (pad, drone, shimmer), per-source inserts (filter, amplitude modulation, reverb send) and a master bus with reverb and a limiter.
2. A single-screen **Focus view** in the spirit of FlowTunes: one big play control, session modes, timer, readouts of the active frequencies. Suggested automatically when a session is frequency-only.
3. A rebuilt **spatial view**: a real camera (orthographic top-down to perspective orbit, blended), correct picking and dragging in 3D, ground grid with distance rings, depth sorting and fog, audio-reactive nodes driven by per-source analysers instead of random ripples.
4. A rebuilt **timeline**: draggable keyframes, volume envelopes, mute and solo per track, journey sections, snapping, fit-to-view, undo for every edit.
5. Visual language: modern, clean, minimal, engineering-grade. Hairline grids, monospace readouts with units, SVG line icons instead of emoji, a restrained warm-orange accent on near-black. The leopard texture stays as a faint brand layer, bold only on the landing hero.
6. A **landing page** at `/` that explains the features honestly, with the app moving to `/app`.

## 2. Architecture

```
src/
  audio/
    AudioEngine.js      master bus, sources (samples + generators), inserts, analysers
    Generators.js       procedural sources: binaural, isochronic, monaural, tone, noise, breath, pad, drone, shimmer, schumann
    InstrumentSynth.js  offline-rendered instrument buffers (unchanged)
    SceneManager.js     save/load/share incl. generator params
    SpeakerConfig.js    output modes (unchanged)
    HeadTracker.js      device orientation (unchanged)
  core/
    UndoManager.js      command stack (+ keyframe move, mute/solo commands)
  data/
    SoundLibrary.js     THE registry: type, kind, category, glyph, color, url or generator params, evidence label
    SoundUrls.js        re-export for compatibility
    Presets.js          journeys (with sections) + session modes for Focus view
  ui/
    Icons.js            SVG line icons (DOM) and Path2D glyphs (canvas)
    Camera.js           projection math (ortho/perspective blend, unproject to plane)
    CanvasGrid.js       spatial view: rendering, input, automations
    Timeline.js         journey editor
    Library.js          left panel: categories, cards, search, audition, upload
    Inspector.js        right panel: Sound / Space / Motion / Time tabs
    FocusView.js        simple player view
    Shell.js            top bar, view switching, settings, welcome, output, posture
    KeyboardShortcuts.js
    Timer.js
  i18n.js
  main.js               wiring
  landing.js            landing page hero (live map demo, no audio)
app.html                the app
index.html              the landing page
```

## 3. Coordinate system

World: X right, Y forward (front of the listener), Z up. Metres. Web Audio mapping stays `(x, z, -y)`.

Camera: orbit around a target with `yaw` (deg), `pitch` (deg, 90 = top-down), `zoom` (px per metre via `unitScale`), `persp` (0 = orthographic, 1 = perspective) and a pan offset in screen pixels. 2D mode is pitch 90, persp 0. 3D mode animates to pitch ~55, persp 1. All screen positions come from `Camera.project`, all pointer positions go back through `Camera.screenToPlane(sx, sy, z0)`, so hit tests and drags are exact in every view.

## 4. Audio graph

```
sample:    BufferSource -> Filter(LP) -> Filter(HP) -> ModGain(AM) -> Shoulder -> Pinna -> Panner(HRTF) -> Gain -> Master
generator: Generator.output ------------------------------------------> Shoulder -> Pinna -> Panner -> Gain -> Master
binaural:  Generator.output (stereo, head-locked, bypasses the panner) -----------------------------> Gain -> Master
each:      Gain -> ReverbSend -> Convolver -> ReverbReturn -> Master ; Gain -> Analyser (level readout)
master:    Master -> Limiter (DynamicsCompressor) -> Destination ; Master -> Splitter -> L/R analysers
```

Binaural beats need a different frequency in each ear; sending them through the HRTF panner mixes the channels and destroys the beat. They are therefore head-locked and drawn at the listener.

## 5. Evidence labels

Frequency tools carry an `evidence` field (`moderate`, `weak`, `none`) and a one-line note. The UI shows it in the library and the inspector. Values are set from the research report in `docs/research/2026-09-15-sound-apps-and-evidence.md`.

## 6. Out of scope

Native apps, accounts, cloud sync, AI-generated audio, new sample assets beyond the ones already in `public/sounds`.
