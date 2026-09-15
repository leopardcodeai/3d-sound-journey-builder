# Attribution

What is known about every bundled audio file, and what is not.

Investigated on 2026-09-15 by comparing file bytes, reading the embedded
encoder and tag data, and searching the public code index. Nothing here is
assumed: each row says how it was established.

Run `node scripts/audit-audio.mjs` for the current contents of the folder.

## Summary

Eight of the original 34 files have been removed and replaced by synthesis.
Twenty-six remain.

| Group | Files | Established | Status |
|---|---|---|---|
| Identical to [remvze/moodist](https://github.com/remvze/moodist) | 10 | byte-for-byte identical, SHA-256 verified | licence unresolved, see below |
| Unknown origin, LAME 3.99.5 group | 16 | shared encoder signature, no other trace | licence unknown |
| ~~SoundBible~~ | ~~1~~ | tag inside the file | **removed**, synthesised instead |
| ~~GarageBand~~ | ~~1~~ | tag inside the file | **removed**, synthesised instead |
| ~~Chakra bowls~~ | ~~6~~ | unknown origin | **removed**, synthesised instead |

## Already settled: the eight that are gone

`bell.mp3` carried "SoundBible.com Must Credit" and needed a credit naming an
author we never knew. `gong-old.mp3` came out of GarageBand, whose licence does
not cover redistributing the file itself. `bowl-a`, `bowl-b`, `bowl-d`,
`bowl-e`, `bowl-f` and `bowl-g` had no traceable origin at all.

All eight are now generated at runtime by `src/audio/InstrumentSynth.js` and no
longer exist in the repository. Nothing was lost in the app: the bowl strike,
the gong and the seven chakra bowls all still appear under Sound healing.

The chakra set came out better for it. It used to be one recording
pitch-shifted six ways, so the realised pitch depended on that recording. It is
now generated at the frequencies it claims, and a test measures each one:
every bowl lands within ten cents of its label, where the old set drifted
roughly thirty cents flat.

## The ten from Moodist

`birds.mp3`, `cafe.mp3`, `campfire.mp3`, `crickets.mp3`, `rain.mp3` (their
`heavy-rain.mp3`), `singing-bowl.mp3`, `thunder.mp3`, `train.mp3`,
`waves.mp3`, `wind-chimes.mp3`.

All ten are byte-for-byte identical to the files in
`remvze/moodist/public/sounds`. That repository is MIT licensed, and its
README says plainly:

> Some sounds used in this project are sourced from third-party providers and
> are subject to different licenses: Pixabay Content License, CC0.

So the MIT licence there covers the code, not these files, and the repository
does not record which of the two licences applies to which file.

That distinction decides everything:

- A **CC0** file carries no conditions. Fine to keep.
- A file under the **Pixabay Content License** may not be redistributed on a
  standalone basis. The licence states: *"You cannot sell or distribute Content
  (either in digital or physical form) on a Standalone basis. Standalone means
  where no creative effort has been applied to the Content and it remains in
  substantially the same form as it exists on our website."* Committing the
  unchanged mp3 into a public repository is exactly that.

Being downloadable from a public repository is not a licence. A file that
arrived under the Pixabay licence keeps that licence no matter how many
repositories it passes through.

## The sixteen of unknown origin

`city-park`, `city-traffic`, `dolphins`, `elephant`, `gong`, `gong-chinese`,
`jungle-birds`, `jungle-night`, `jungle-river`, `leopard`, `monkeys`,
`ocean-deep`, `subway`, `tropical-birds`, `underwater-ambient`, `whales`.

All encoded with LAME 3.99.5, a different encoder from the Moodist set, so
they came from somewhere else. No tags, no download script in the repository
history, and no credits file ever existed. The public code index returns no
repository containing `jungle-river.mp3` or `tropical-birds.mp3` at all, so
they were not taken as a set from a public project.

Origin unknown. Treat as unlicensed until established.

## The two with a name in them

Both have been removed. Kept here as the record of why.

| File | Tag in the file | What it meant |
|---|---|---|
| `bell.mp3` | title and artist both read `SoundBible.com Must Credit`, dated 2017 | SoundBible distributes under Creative Commons Attribution or Public Domain. "Must credit" means the Attribution licence: a credit naming the author is required, and we never knew who the author was. |
| `gong-old.mp3` | `TSS = GarageBand 10.2.0` | Produced in GarageBand. Apple's licence permits using the output in your own work; it does not permit redistributing the material as a standalone file. |

## What follows from this

The bundled audio cannot be treated as covered by this project's MIT licence.
For local use it is fine. Before anyone forks, relicenses or ships this
commercially, each file needs either a licence on record or a replacement.

Order of work, by exposure:

1. ~~**Replace the two named files.**~~ Done: both removed, both synthesised.
2. ~~**Replace the six chakra bowls.**~~ Done: synthesised at exact pitch.
3. **Resolve the ten from Moodist.** Each one is either CC0 or Pixabay. Find
   the original on Pixabay or Freesound and record which; replace the Pixabay
   ones with CC0 equivalents. Needs a Freesound account, which only the owner
   can create.
4. **Replace the sixteen unknowns** with CC0 files whose source URL is
   recorded here as they are added. Several of them are short one-shots
   (`jungle-river` is one second, `monkeys` two) that a generator could cover
   as convincingly as a sample.

Vetted sources and the licence rules that apply to each are listed in
[research/2026-09-15-sound-sources-and-licensing.md](research/2026-09-15-sound-sources-and-licensing.md).
The short version: Freesound filtered to CC0 is the safest single source,
because CC0 is the only common licence with no redistribution clause at all.

## Row format for new files

| File | Sound | Source URL | Author | Licence | Added |
|---|---|---|---|---|---|
| example.mp3 | Example | https://freesound.org/s/000000/ | Name | CC0 | 2026-09-15 |

## Generated audio

Instrument tones, binaural and isochronic beats, noise, the breathing pacer and
the generative layers are synthesised at runtime by
`src/audio/InstrumentSynth.js` and `src/audio/Generators.js`. They contain no
third-party material.

## Texture

`public/leopard-texture.jpg` is a brand asset of LeopardCode.AI.
