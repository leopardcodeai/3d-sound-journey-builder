# What comparable soundscape apps actually ship

Survey date: 15 September 2026. Sixteen apps with an enumerable catalogue.
Where an app is open source or ships its catalogue in client-side JavaScript,
the list was read out of the source and the count is exact. Where the catalogue
sits behind a login or a bot wall, that is stated. Nothing here is an estimate
dressed up as a fact; anything unconfirmed is marked unverified.

Apps counted: Moodist, A Soft Murmur, Noisli, myNoise, Defonic, Rainy Mood,
Tide, BetterSleep, TMSoft White Noise, Atmosphere, Blanket, Ambie, Calm,
Naturespace, Portal, Lofi.co. Endel and Ambient Mixer were excluded because
neither has a bounded list.

---

## 1. How large the catalogues really are

| App | Sounds | Basis |
|---|---|---|
| myNoise | 100 public generators, ~390 total, each with 7-10 sliders | catalogue pages; the 390 is derived arithmetic, not a published figure |
| BetterSleep | claims 300+ | marketing claim, not verified at source |
| Tide | ~170 | catalogue page |
| Naturespace | 162 to 170 depending which of its own pages you read | its own pages disagree |
| Atmosphere | 70+ | catalogue page |
| Portal | ~65 | catalogue page |
| TMSoft | ~47 | search-surfaced, medium confidence, its sound index returns 404 |
| **Moodist** | **84 in 8 categories** | **read from `src/data/sounds/*.tsx`, exact** |
| Defonic | ~40 | asset paths |
| **Noisli** | **28, flat list** | **read from its Next.js chunk, exact** |
| **A Soft Murmur** | **25 active** | **read from the page bundle, exact** |
| Endel | 4 scenes, ~17 soundscapes | all generated in real time |
| Blanket | 14 | open source |
| Ambie | 13 | open source |
| **This app** | **62 entries, of which 26 are recordings** | the rest is synthesised |

The headline counts are not comparable. Moodist's 84 are 84 audio files.
This app's 62 include 36 synthesised entries that cost no bytes and no licence.
The number that matters for a gap analysis is **26 recorded samples**.

---

## 2. Table stakes, tier by tier

Counts are how many of the sixteen ship the sound.

**Tier 1, universal, 12 to 16 of 16.** Absence is conspicuous.

Rain (16), ocean waves (15), campfire or fireplace (15), thunder (14),
wind (12), **stream or creek (12)**, cafe (12).

**Tier 2, expected, 7 to 11.**

City or traffic (11), generic birds (11), white noise (10), waterfall (9),
forest ambience (8), pink noise (8), fan (8), crickets (8), train (8),
jungle (7), underwater (7), brown noise (7), night ambience (7).

**Tier 3, common but not assumed, 4 to 6.**

Cat purring (7), singing bowl (6), cicadas (6), wind chimes (5), airplane (5),
frogs (5), binaural beats (5), owl (4), seagulls (4), whale (4), horse (4),
library (4), clock (4), washing machine (4).

**Tier 4, niche, 1 to 3.** These are differentiators, not gaps.

Wolf (3), chickens (3), sheep (3), bees (3), dolphins (3), keyboard (3),
office (3), crows (2), woodpecker (2), dog (2), loon (2), **monkeys (1)**,
**cows (1)**.

**Tier 5, in none of the sixteen.** Geese, ducks, elephant, big cats.

---

## 3. Where this app stands on animals

Present: birds, tropical birds, jungle birds, crickets, monkeys, elephant,
leopard, whales, dolphins. Nine of 26 recordings are animals, which is a high
share.

The shape of the gap is specific and worth naming. **This app is already ahead
on the exotic tail** and holds four sounds that almost nobody else has: monkeys
and cows appear in one app each, elephant and big cats in none. What is missing
is the **domestic and temperate middle**: cat purring, owl, frog, seagulls,
wolf, chickens, cows, sheep, horse, dog, crows, woodpecker, bees, geese, loon.

Two further observations:

- **Cat purring is the most universal animal sound in the field**, in seven of
  the sixteen. It is table stakes and this app does not have it.
- **Only myNoise does species-level, individually mixable animal layers**
  (red-winged blackbirds, snipes, lapwings, titmice, tawny owls). Everyone else
  ships one generic birds loop. Given this app places every source in space
  individually, that is open territory.

Non-animal gaps against Tier 1 and 2: **stream**, waterfall, wind, forest
ambience, fan, airplane, library, office, keyboard, clock, washing machine, and
rain textures. Moodist ships six rain variants (window, car roof, umbrella,
tent, leaves, heavy); this app ships one.

---

## 4. How the field handles presets

Three schools, and they barely overlap.

- **By activity.** Noisli (Productivity, Relax, Noise Blocker, Motivation,
  Sleep, Studying, Creative Thinking, Writing), Defonic, Endel, Calm. This is
  the dominant model for focus tools.
- **By place.** Portal (real locations in Iceland, Scotland, Slovenia), Tide,
  Atmosphere, Ambient Mixer. Dominant for immersion tools.
- **By sonic character.** myNoise alone. Its twenty categories are about
  texture (Tonal Drones, Patterns, Vocal, Industrial), not use case.

Naming: Moodist and Defonic say *presets*, Noisli says *combos* inside
*playlists*, A Soft Murmur and Atmosphere say *mixes*, Endel says *scenes* and
*soundscapes*, Tide and Calm say *soundscapes*, Portal says *portals*.

User-saved mixes exist in Moodist, Noisli (capped at ten on the free tier),
myNoise, A Soft Murmur, Defonic, Tide, Atmosphere and BetterSleep. They do not
exist in Endel, Portal or Naturespace, and apparently not in Calm. The pattern
is near-universal: a modal with a name field and a Save button, backed by
browser storage, listed below the form with rename and delete, usually paired
with share-by-URL.

**Time of day and weather are used by almost nobody as a browsing axis.** Endel
uses them as runtime modulators, not as a way to find something. That is open
space.

### The finding that matters most

**Not one of the apps inspected at source level has a setting for a default
preset.** Moodist's settings store holds exactly two values, global volume and
alarm volume. A Soft Murmur restores the last state but exposes no control.
Noisli has no such setting in its client data. myNoise's "save in this browser"
is a manual recall, not an auto-load. The closest anything comes is Endel
picking a scene from time of day and biometrics, which is algorithmic rather
than something the user sets.

This app now has three preset layers where every surveyed competitor has one:
nine timed journeys, ten untimed sets, six focus modes, plus an
hour-of-day function. The "Start with" control added on 15 September 2026 makes
the default selectable, which is genuinely absent from the field.

---

## 5. Licensing, and what is actually usable

The test that matters: this repo publishes loose audio files under MIT, and MIT
grants downstream users the right to copy, distribute, sublicense and sell. Any
audio licence that forbids commercial use, forbids standalone redistribution,
or forbids inclusion in a sound library is therefore disqualifying, because a
git repository full of audio files **is** a sound library.

| Source | Licence | Usable here |
|---|---|---|
| Freesound, CC0 filter | CC0 1.0 | **Yes.** Best option. |
| Freesound, CC-BY | CC BY 3.0 / 4.0 | **Yes, with a per-file attribution manifest.** |
| NPS sound gallery | US federal public domain | **Yes**, for recordings credited to the agency. |
| USFWS media library | US federal public domain | **Yes**, same caveat. |
| OpenGameArt, CC0 filter | CC0 | **Yes**, user-uploaded so spot-check. |
| Wikimedia Commons | mixed | **Per file.** CC-BY-SA audio stays CC-BY-SA. |
| Internet Archive | host, not licensor | **Per item**, only with real provenance. |
| Xeno-canto | per recording, often CC-BY-NC-SA | **Per recording, high effort.** The `lic:` search syntax could not be verified. |
| SoundBible | mixed CC-BY 3.0 and public domain | **Weak provenance.** No licence filter, no version clarity. |
| Ambient Mixer | CC Sampling Plus 1.0 | **No.** Prohibits commercial redistribution of the whole work; retired by Creative Commons in 2011. |
| Macaulay Library | permission-based | **No.** Not downloadable unless the media is yours. |
| BBC Sound Effects | RemArc | **No.** Non-commercial, personal, research or education only. |
| ZapSplat | its own EULA | **No, twice over.** Forbids redistributing sounds in sound libraries or apps, and forbids using them as the primary value in a relaxation product. |
| Pixabay | Pixabay Content License, not CC0 since 9 January 2019 | **No for a repo.** Forbids distributing content on a standalone basis. The app may be a new creative work; a directory of audio files is not. |
| FreePD | — | **Dead.** Shut down in 2025. |

### Precedent from peers in the same position

- **Ambie** ships thirteen sounds, every one CC0 from Freesound, with the
  source URL in an attribution field next to each entry. Cleanest model.
- **Blanket** ships fourteen with a licensing table giving sound, author,
  editor and licence. Its contribution rule accepts CC-BY and CC0, not CC0
  only.
- **Defonic**, a paid product, runs its whole library on Freesound CC-BY with a
  public credits page and 43 credits. Proof that CC-BY is workable when the
  attribution page is maintained.
- **Moodist** is the cautionary one. Its structure is right, MIT for code with
  a README carve-out for the sounds. But there is no per-file manifest, so
  nobody can tell which of its 84 files is CC0 and which is Pixabay, and the
  Pixabay half is exactly the half the standalone clause bites on.

### Availability for the missing animals

Live census against the Freesound CC0 filter, using
`https://freesound.org/search/?q=<term>&f=license%3A%22Creative+Commons+0%22`:

Abundant in CC0: bird, owl, cricket, dog bark, frog. Adequate: horse, cow,
sheep, chicken, monkey, seagull. Thin: cat purring (only 7 CC0 soundscapes),
goose, wolf howl (14), whale (29), dolphin (7). Hardest: **loon**, 11 CC0
results in total.

For the thin ones the NPS gallery covers wolf, whale, orca, geese, owl and
frog. Loon is the one genuine hole; the best candidate is a Wikimedia file
under CC BY-SA 2.5, which is usable with attribution but is not CC0.

---

## 6. Corrections to assumptions that went into this survey

1. **"Rainy Scope" does not exist.** The closest real products are *Rainy* by
   Loopray and *Rainscapes*.
2. **"Dorm" could not be confirmed to exist.** Its supposed domain does not
   resolve and no such app is listed.
3. Portal calls them **portals**, not destinations.
4. Naturespace is alive, version 7.0.0 from April 2025, not defunct.
5. Calm's soundscape list is genuinely unobtainable without a logged-in
   session. Beyond about twelve titles and its "30+" claim, treat it as
   unknown. Its lack of a mixer is probable but unverified.
6. An earlier pass concluded that cows appear in none of these apps. Reading
   Moodist's source contradicts that: it has cows, sheep and chickens.
