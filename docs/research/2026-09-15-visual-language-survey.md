# How the ambient and focus apps actually look

Survey date: 15 September 2026. Products examined at source level where their
own CSS, brand guidelines or asset trees are public: Endel, Brain.fm, Portal,
Oak, Breathwrk, Spotify, Headspace, Calm, Insight Timer, Aura.

Almost everything below is a measurement, not an impression. Where a value was
read out of a shipped stylesheet, an official brand guideline or a decoded
asset, it is stated as such. Where something could not be confirmed, it says so
rather than guessing.

This app has to be two things at once: an instrument for placing sound in space,
and a room to sit in. The survey exists to find out how the field solves that,
and the answer turns out to be consistent enough to act on.

---

## 1. The single organising finding

**Numbers are stratified by layer, not removed.** Every product in the survey
shows figures where the user is choosing, and removes them where the user is
doing.

Breathwrk is the clearest case. During an exercise the screen is pure black,
three grey concentric rings, and one word: *Inhale*. No digit, no countdown, no
depleting arc. The timing is carried entirely by the rate of the animation and
by haptics. One layer out, on the browse tile, the same exercise is labelled
`6:4` in small dim type, seconds in to seconds out. Two layers out, in the
profile, it is dense: `14 / Streak`, `68k / Breaths`, `96 out of 100`.

Endel goes further. Its entire technical readout is one present participle,
**"Generating"**, at 14 pixels. Its state is named as a circadian phase in
words, *Night Energy Fade*, *Afternoon Energy Peak*. Its inputs, including heart
rate, are shown as icons and never as values: the heart is a heart, there is no
figure in beats per minute. The only digits in the product are a wall clock and
a countdown the user set themselves.

**What this means here.** The field view is the instrument layer and should keep
every number it has. The focus view is the performing layer and should not
compete with it. The app already splits this way; the survey says the split is
correct and should be pushed further, not softened.

---

## 2. Five ways the field dodges a number

1. **Name the mode instead of giving a value.** Calm offers *Timed Meditation*
   against *Open-Ended Meditation*, and a timer that runs to **"Endless"**.
   Insight Timer offers an **infinity glyph** as a duration. Brain.fm quantises
   a continuous signal-processing parameter into **Low, Medium, High**, gives
   each an ordinal bars glyph, and justifies each in a sentence of prose.
2. **Discrete pills, never a stepper or a scrubber.** Not one product in the
   survey ships a numeric input for length. Calm offers 3, 5, 10, 15, 20, 25,
   30. Insight Timer offers 1, 2, 5, 10, 15, 20, 25, 30, 60. This app's focus
   lengths already work this way.
3. **Counts instead of clocks.** Headspace's own breathing content says *to the
   count of 3, then the count of 6*, never "3 seconds". Calm sets breathing as
   **breaths per minute, 4, 6 or 8**, a rate rather than a countdown, and draws
   it as a bubble. This app's breath pacer is already parameterised in breaths
   per minute, 3 to 10, defaulting to 6.
4. **Unlabelled continuous controls.** Every volume control in the survey is an
   unnumbered slider. Calm ships two of them, guidance against scene, and the
   scene one mutes at full left rather than reading zero.
5. **Progress moved off the main surface, and switchable.** Calm's streak lives
   behind the profile and is manually repairable: add a missed session, enter a
   duration, the count recalculates. Insight Timer puts the counter on the home
   screen but ships three independent switches to turn it off, plus a setting
   that redefines what counts at all.

**The neatest single move is removing the interface entirely.** Endel ships a
*Hide interface* button. Calm's Zen Mode fades everything after fifteen idle
seconds on the web, or on a tap. Both leave only the moving artwork. This app
gained the same thing on 15 September 2026, as an explicit button rather than an
idle timer: an interface that dissolves by itself reads as a fault the first
time it happens.

---

## 3. The orb, measured

The most useful single result of the survey. Endel's signature visual is **not**
a sphere, a blob, a particle system or a shader. It is a field of flat
overlapping circles, and three details decide whether it reads as lit volume.

Decoded from their own artwork, a 1152 by 611 asset:

| Property | Value |
|---|---|
| Circles | about 18, plus 4 dots of radius 2 |
| Radii | 43 to 78 pixels on a 1152 canvas, so **7 to 13 per cent of width** |
| Radius pairs | exact duplicates, one filled and one stroked |
| Layer opacity | quantised to **0.3, 0.6, 1.0**, not continuous |
| Backdrop | one radial gradient, elliptical, exactly half the canvas in each axis, at 0.35 |
| Gradient angles | 19 distinct values, no global light direction |

**The transferable detail is the alpha ramp.** Every circle's fill uses a
ten-stop gradient whose alpha follows **t squared** to within 0.01 at every
stop. A plain two-stop linear gradient looks like a disc. The squared ramp looks
like a sphere. This is why flat circles read as lit.

Equally important is what it is not. Grepping Endel's entire 1.55 megabyte
bundle returns **zero** occurrences of `AnalyserNode`, `createAnalyser`,
`getByteFrequencyData` or `fftSize`. The audio is a server-generated stream
played through a plain audio element, and the visual receives exactly one
property: playing or paused. **The generative visual is a fixed authored loop.**

That settles a design question directly. Tying a calm surface to transient audio
peaks makes it twitch. This app's circle field follows the same rule: intensity
is a slow scalar the caller sets, and nothing reads the analyser.

---

## 4. Typography, and the one rule everyone shares

**A monospace kept in reserve for figures.**

- **Headspace** licenses a bespoke *Apercu Pro Mono* whose documented role is,
  verbatim, *"Use for small ANNOTATIONS and technical bits, like dates, page
  numbers, etc."*
- **Spotify** ships a bespoke *SpotifyMixMono* exposed through exactly two
  utility classes, both at regular weight and body size.
- **Brain.fm** licenses JetBrains Mono Bold and uses it on exactly one
  component: FAQ question titles, in capitals, wrapped in literal quote marks.

In every case the mono is small, regular weight, and never a heading. It reads
as instrumentation. This app already sets its readouts in mono, which is the
right instinct; the survey says keep it narrow and never promote it.

**Weight discipline.** Endel ships **two weights in the entire product**, 400
and 500, and emphasises with size and colour instead. Aura ships two, 400 and
600. Calm uses regular and demi only.

**Tracking splits by role, and the direction is not what you would guess.**
Headspace tracks headlines tight and negative, scaling with size: 120 pixels at
minus 30, 30 pixels at minus 20, 18 pixels at minus 10. Brain.fm is more extreme
still, minus 5.2 pixels at 104. But **Endel tracks its headlines slightly
loose**, plus 0.35 pixels, and Aura is positive almost everywhere. The one thing
everyone agrees on is that small uppercase micro-labels get strongly positive
tracking, 1 to 2.5 pixels, at low opacity. This app already does that.

**Uppercase is rationed.** In Endel it appears exactly once in the whole system,
as a black-on-white pill at 12 pixels with plus 1 pixel tracking. Everywhere
else in the field, uppercase is confined to taxonomy labels that are meant to
recede.

---

## 5. Motion speed is the genre marker

| Product | Longest routine transition | Curve |
|---|---|---|
| Spotify | **300 ms** | named `productive`, `cubic-bezier(.3, 0, 0, 1)` |
| Endel | 400 ms | mostly linear |
| Brain.fm | 1000 to 1500 ms, entrance only, nothing loops | ease |
| Portal | **1400 ms** opacity, a 120 second marquee | `cubic-bezier(.43, .19, .21, .97)` |

Spotify's curve is literally called productive, and even on its sleep surfaces
the chrome moves at app speed while the calm is delegated entirely to artwork
and audio. Portal's is a long, late settle with parallax tokens.

Headspace is the only one to publish a frame-rate rule: **12 frames per second
for playful narrative, 24 for relaxing and ambient, 60 for technical and
in-app**, with breath loops specified at 24. Their guidance also says, verbatim,
to avoid default easing and to *"avoid creating lazy and drifting animations"*.

**Reading for this app.** The field view is an instrument and should stay at
instrument speed, which it does at 140 ms. The focus view is the other half and
should run seconds, not milliseconds, with something moving continuously.

---

## 6. Texture, and the two ways to do grain

Both exist to kill banding across large dark washes, and both sit at very low
opacity.

- **Spotify generates it in CSS**: a 300 by 300 tile of `feTurbulence`,
  `type="fractalNoise"`, `baseFrequency="0.75"`, `stitchTiles="stitch"`, fully
  desaturated, at **5 per cent opacity**.
- **Brain.fm ships a bitmap**: 220 by 220 pixels, 1-bit palette, 83 per cent
  white to 17 per cent black, composited under a white-to-transparent gradient.

**Endel uses neither.** Grepping its stylesheets returns zero occurrences of
`backdrop-filter`, `filter: blur()` and `mix-blend-mode`. All texture lives
inside the artwork. Headspace's brand guidelines likewise specify flat fills
with no outlines, depth coming from *"clever use of shadows and scale
contrast"*.

Glow, where it exists, is a box-shadow rather than a filter. Brain.fm's pattern
is consistent: 90 to 120 pixels of blur, 15 to 20 pixels of spread, 20 to 50 per
cent alpha, always paired with a 24 pixel radius and `overflow: hidden`.

---

## 7. Palette

Two schools, and this app sits with the first.

**Monochrome, colour from the artwork.** Endel's entire palette is white, black
and a five-step grey ramp, plus three accents that each appear exactly once in
134 kilobytes of stylesheet. Apple's own description is *"an elegant monochromatic
interface"*. Portal is nine greys, four of them text, with every colour coming
from the footage.

**Saturated and coded by content.** Headspace runs a high-chroma palette with
named sub-palettes per product area, and publishes the proportions: yellow 50
per cent, blue 30, accents 20. Its black is a named token set to a warm
`#2D2C2B`, not pure black. Insight Timer codes by content type: sleep deep
purple, music green, courses gold, live magenta.

**Palette shifting is common, but on different axes.** Headspace shifts by
product area, Insight Timer by content type, Breathwrk explicitly by time of day
(*"Bright visuals match your active and focused day, whilst muted colors prepare
you for a restful night"*), Calm by scene with a documented automatic day-to-night
switch on four named backgrounds. **Endel does not shift the artwork at all**:
the animation is chosen by mode identifier only, and what changes with circadian
phase is the text label.

Spotify's editorial covers are worth one number: across eight of them,
**saturation never exceeds 38 per cent and sits under 20 for five**, while value
tracks the use case almost linearly, darkest for Deep Focus and Sleep, lightest
for White Noise.

---

## 8. Shape and iconography

**Radii cluster hard.** Brain.fm on 24 pixels, seven uses. Headspace on 32
pixels, seventy-five uses. Endel on an 8-12-16-20-24 ladder for cards and fully
round for anything interactive. Portal on 16 and 12, with `border-radius: 50%`
as its signature.

**Endel's icon system is the most reusable idea in the survey.** Every mode icon
is 56 by 56 pixels, white stroke only, no fill, stroke width 1.7 to 2.1, round
caps and joins, and almost all of them contain a full-bleed outer circle at
radius 26.83 centred on 28, 28. The circle is the constant, the inner glyph is
the variable, and the company logo is structurally one more mode icon.

Headspace's rule is the opposite and equally firm: *"Our icons are bespoke,
quirky, rounded, and one of a kind. We never use stock icons."*

**Portal's selection affordance is one line of CSS.** A circle of live video
with a two-pixel white rim at 70 per cent and a ten-pixel glow; selection raises
those to 80 per cent and twenty pixels. That is the entire state change.

**The solid white filled circle is the universal play control.** Brain.fm uses
it at about 64 pixels, centred, with a dark glyph, and it is the only
high-contrast element on a screen that is otherwise white at 60 to 80 per cent
alpha. Breathwrk uses the same thing at the corner of a card.

---

## 9. What was changed here as a result

- **A circle field behind the focus orb**, built to the measured construction
  above, including the squared alpha ramp, the narrow radius band, the three
  opacity tiers and per-circle lighting. Not audio-reactive, for the reason
  Endel is not.
- **Hide interface**, as an explicit button rather than an idle timer.
- **Confirmed as already correct and left alone**: monospace reserved for
  readouts, uppercase confined to receding taxonomy labels with positive
  tracking, discrete length pills instead of a numeric input, and a breath pacer
  measured in breaths per minute.

---

## 10. Corrections to claims that went into this survey

1. **Endel did not win an Apple Design Award.** It won Apple Watch App of the
   Year 2020, plus Editors' Choice. It does not appear on Apple's design awards
   list.
2. **Headspace's breath cycle is not 4-2-6.** That figure comes from a
   third-party designer's reconstruction whose published brand colours also
   disagree with Headspace's own guidelines. Headspace's own content is
   count-based, not clock-based.
3. **"Dorm" could not be confirmed to exist** as an ambient or focus product.
   Every plausible domain either fails to resolve or is unrelated.
4. Portal calls its scenes **portals**, not destinations.
5. Calm's own site is behind bot protection and returned 403 throughout. Its
   typography was read from Calm-owned properties that are not, so the consumer
   app's exact face is an inference from letterforms, not a verified fact.
6. **Aura's store screenshots are visibly dated**, showing iPhone 5 and SE
   device frames, so its in-app observations reflect an older build than its
   marketing site. Its motion language and player could not be verified at all.
