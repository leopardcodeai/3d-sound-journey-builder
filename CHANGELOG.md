# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.2.2] - 2026-09-17

Found by building a journey from nothing, the way a first user would.

### Changed

- **A move lands in the keyframes at the playhead.** Put the playhead
  somewhere, move the sound, and that is where it is at that time; a keyframe
  already there is edited, otherwise one is added. Drags, the inspector's
  distance, direction and height sliders, and the arrow keys all do this, and
  all of it is undoable. Before, every move rewrote the last keyframe whatever
  the playhead said, so seek, move, add keyframe gave two identical keyframes
  and a sound that never moved; and a height set in the inspector reached no
  keyframe at all, so play snapped it back to the floor.
- **Keyframes show in the Motion tab too**, with one line saying how they
  come about.
- **No more prompt().** A saved scene takes its name from a field in the
  drawer or gets one that reads as a moment; a link goes to the phone's share
  sheet, the desktop's clipboard, or a visible box.
- An empty field says what to do instead of how to drag what is not there.

### Fixed

- The :root block was closed a line early by 2.2.1, so on every desktop the
  panels lost their width. Live for about twenty minutes. A test reads the
  stylesheet now.

## [2.2.1] - 2026-09-17

### Added

- **Speakers move by double-click.** With a speaker layout on screen, a double
  click on a speaker starts moving the layout and a double click anywhere ends
  it; the settings list says so. Moving is a mode because a speaker and a
  sound can share a spot.
- **A ten-second sleep timer**, so the fade can be heard without waiting a
  quarter of an hour.

### Fixed

- Dragging a preset speaker wrote into the preset constant itself, so one drag
  of the Ls badge and the ITU layout was gone for the session, in the settings
  list too. It also wrote into the custom list whatever preset was active, and
  rebuilt the speaker graph on every pointer move. Presets now have a working
  copy, the custom list is only touched when it is the active one, and a move
  re-pans in place.
- The header on a phone was too full once the sleep timer joined it: measured
  with a timer running, the row reached 394 px on a 375 px screen. Tighter
  gaps, a slider that gives way, and the time standing in for the clock.
- Installed on a home screen, a phone without a notch reports no top inset at
  all, though the status bar still sits over the page. In standalone mode the
  header now keeps a twenty-point floor. A field losing focus also scrolls the
  page back to the top, which iOS does not do on its own after the keyboard.

## [2.2.0] - 2026-09-17

Everything in this release came from using the app on an iPhone in bed, which
is what it is for.

### Added

- **Audio keeps playing when the screen locks.** iOS stops Web Audio the moment
  a page leaves the foreground unless a media element is playing, so a
  one-second loop of digital silence now runs in an `<audio>` element while
  anything plays, started inside the same gesture that starts the sound. The
  lock screen gets a play and pause that drive the transport. Released again
  when nothing plays.
- **Sleep timer in the header.** One press from anywhere: 15, 30, 45, 60 or 90
  minutes, remaining time shown on the button, and a twenty-second fade to
  silence instead of a three-second stop. The drawer section stays and shows
  the same state.
- **Home-screen install**: a web app manifest, a real icon (the app's logo, not
  the purple placeholder bolt the scaffold shipped with), and room for the
  translucent status bar at the top. Installed, the header sat under the clock.

### Changed

- **Lying on your back: feet towards the top of the map, head towards the
  bottom.** Decided on the mat with the phone in hand. The vectors then put the
  right ear on the map's right, so a sound drawn on the right is heard on the
  right; the earlier orientation mirrored it, which was defensible for a map
  seen from underneath and wrong for a person holding a phone.
- **The transport runs on the audio clock.** It added frame-clock deltas, so
  after a locked screen the first frame added the whole absence at once, the
  journey jumped to its end, faded, and came back at full level from zero. That
  was the tone at the end. It follows `AudioContext.currentTime` now, and a
  slow interval carries the loop while the page is hidden so fades and
  keyframes still happen with the screen off.
- **A journey that ends now ends.** The end fade used to leave every buffer
  looping and re-gain it to its opening level.
- **The timer keeps a deadline, not a counter.** A phone with its screen off
  throttles timers; the old one fell behind by however long the tab slept.
- **Sheets on a phone take half the picture**, and the field gives up that
  half rather than hiding under it, so the listener re-centres where a finger
  can still reach it.
- **Selecting a sound on a phone no longer opens the inspector sheet.** It
  fired on pointer-down, which is how a drag begins, so the sheet rose over
  the field the moment a finger landed on a sound and nothing could be moved.
  The Inspector tab carries a dot while there is a selection and opens it.
- Adding a sound from the library sheet puts the sheet away and says where the
  sound landed, instead of leaving it out of sight behind the list.

### Fixed

- The X on a phone sheet emptied the panel but left the sheet up.
- Stop, scrub, mute and solo started every source whose clip covered the
  playhead, even with the transport paused.
- Clarity described a binaural beat it never played.
- Choosing a posture applied its tilt and filter strengths but stored only
  the name, so a reload silently undid them.

## [2.1.0] - 2026-09-15

Presets, preferences that survive a reload, a head-turn control, and a pass over
accessibility driven by a live browser test and an external code review.

### Added

- **Sound sets**: ten placed soundscapes with no timeline, as a quicker way in
  than a composed journey. Three scene templates existed in the data but were
  never rendered anywhere; these replace them.
- **Start with**: chooses what opens on start, across every set, every journey,
  the focus view and an empty field. No app in the surveyed field offers this.
- **Preferences that persist**: output mode, posture, head tilt, head turn,
  shoulder and ear filters, room level, master level, 2D or 3D, labels, grid,
  motion paths and timeline snapping. Previously only the language and saved
  scenes survived a reload.
- **Head turn**: a yaw control for the listener. The app had head tilt, which is
  a roll; yaw existed only through device sensors and had no control at all.
- **Keyboard sheet**: thirteen shortcuts that were not written down anywhere,
  opened with `?`.
- **Hide interface** in the focus view, leaving the orb and the field.
- **Wind and stream** as generators, two of the largest gaps against comparable
  apps, synthesised so no licence question arises.
- **Circle field** behind the focus orb, built to a measured construction.
- **Build identity**: version, commit and date, shown on the welcome card and in
  the settings drawer.
- `npm run sounds:check` and `sounds:fetch`: a tool that reads the licence and
  the credit off a source page and refuses anything it cannot confirm.

### Changed

- **Colour**: 64 entries carried 58 unrelated hues and every category spanned
  most of the colour wheel. Now one hue band per category, at least 20 degrees
  apart and clear of the accent, with membership assigned by farthest-point
  sampling so no two entries in a category are closer than 10.3 in CIE76. The
  seven chakra bowls keep their spectrum, which is subject matter rather than
  decoration.
- **Motion paths** carry time: tick dots whose spacing is the speed, a split at
  the playhead, a direction arrow, and thinned time labels.
- **Secondary text contrast** raised from 2.98:1 to 4.81:1, measured against the
  darkest ground each token actually appears on.
- **Presets before technology** in the settings drawer.

### Fixed

- The timer faded the master to silence and never restored it, so the app went
  quiet permanently while the fader still showed its old value. It also did not
  stop a running journey, which restarted the sources it had just paused.
- Adding a sound was mouse-only: the card was a focus stop with no effect and
  the add affordance was hidden from assistive technology.
- The view tabs lost their accessible names below 900px, and the master fader
  disappeared entirely.
- The transport announced "Play" while playing.
- Solo, mute and remove buttons carried no track or sound name.
- The mobile tab bar showed one selection across four buttons, so opening the
  timeline un-highlighted the panel that was still on screen.
- Deleting a source left its solo state behind, muting everything else.
- Scenes did not store the head turn.
- A focus session kept running after its view was closed.
- Labels in the field overprinted each other and ran across other nodes.
- The shoulder and ear filters ran their first render quantum at 350 Hz.

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
- **`npm run audit:audio`**: reports every bundled audio file with its size,
  duration, encoder and embedded tags, and fails when the library and the
  folder disagree.
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
- **Tests**: 245 unit tests across the engine, generators, camera, timeline,
  library, focus view, instrument synthesis, presets, scenes, undo and i18n,
  up from 104.

### Changed

- **Audio provenance**: the bundled files were traced. Ten are byte-identical
  to Moodist, whose sounds are Pixabay- or CC0-licensed rather than covered by
  its MIT licence; sixteen have no traceable origin; eight had terms that were
  clearly unmet and have been removed.
- **The healing set is synthesised**, not recorded: the bowl strike, the gong
  and the seven chakra bowls. The chakra set used to be one recording
  pitch-shifted six ways, which tied its pitch to that file; it is now
  generated at the frequencies it claims, measured to within ten cents.
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

- A slow wobble in the bowl generator was written as `sin(2*pi*f(t)*t)`, which
  is phase distortion rather than frequency modulation. It dragged the pitch
  about two percent flat and further off the longer the note rang. The phase is
  now accumulated per sample, so the written frequency is the heard one.
- **Security**: a shared link could run script in the reader's browser. Display
  names were escaped everywhere, but a source's identifier was written into a
  `data-id` attribute unescaped, and a scene from a URL is written by whoever
  sent the link. Scenes are now validated on import, identifiers that are not
  plain identifiers are rejected, and every identifier is escaped where it
  reaches markup.
- An undo step could take its starting value from a different control, so
  undoing a Solfeggio preset could set the tone to 0.3 Hz.
- A timeline drag released outside the window stayed live, and the next click
  anywhere dropped the keyframe there.
- Switching a binaural source to an isochronic one left it head-locked, which
  is exactly what the switch exists to undo.
- A focus session paused mid-fade left the next session without a fade-out.
- Two quick journey clicks interleaved into one hybrid state.
- On a phone the timeline dock, the sheets and the tab bar could disagree.
- A shared link, opened for the first time on another machine, restored only
  the generators. Loading a scene built its sources without decoding the
  samples first, so every recorded sound was silently dropped. Loading is now
  asynchronous and decodes what it needs.
- Undo after deleting a generator brought it back with the library defaults
  instead of the parameters it had. Fades and repeat settings were lost the
  same way, and were never stored in a scene at all.
- Changing a fade or repeat setting mid-cycle left the previous automation
  scheduled, so the volume jumped at timestamps belonging to the old settings.
- Loading a scene restored the listener pose but not the shoulder and ear
  filter strengths that belong with it.
- The pad's chord control changed the label but not the sound.
- Sharing a link wrote a scene called "_temp" into the user's saved list.
- Chrome reported an unstable filter on every sample source: the low-pass sat
  at 20 kHz, within 9 percent of Nyquist. Its open position is now 40 percent
  of the sample rate, above hearing and above what the bundled files carry.
- The field sized its canvas from the window rather than from its own box. It
  sits below the top bar, so the backing store was 48 pixels too tall and got
  squashed: the drawn centre was 24 pixels off and every click landed short of
  its target. Found by the external review.
- The audition button of a previously previewed sound stayed stuck showing the
  stop icon. Found by the external review.
- A focus layer whose main parameter has fixed options, such as the noise
  colour, rendered a numeric slider and displayed NaN. Those now get a select.
- Level meters read silence as silence. An analyser with no path to the
  destination never ran, so an unwritten buffer was being measured as full
  scale.
- The field paints on load even when the tab starts hidden, instead of staying
  blank until the first visible frame.
- Removed four placeholder audio files that contained an HTML 404 page.
- Brown noise is graded as weak evidence; no noise-colour trial covers it.

### Removed

- Eight audio files whose licence terms could not be met: `bell.mp3` (required
  a credit naming an author that was never recorded), `gong-old.mp3` (produced
  in GarageBand, whose licence does not cover redistributing the file), and the
  six chakra bowl recordings of unknown origin. All eight are synthesised now.
- `ControlPanel.js`, `ControlPanelEvents.js` and `EventBindings.js`, replaced by
  `Library.js`, `Inspector.js`, `FocusView.js` and a slimmer `main.js`.

## [1.0.0] - 2026-06-06

First public version: spatial audio engine, drag-and-drop canvas, keyframe
timeline, activity presets and scene sharing.
