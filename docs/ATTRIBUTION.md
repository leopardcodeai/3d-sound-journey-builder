# Attribution

What is known about every bundled audio file, and what is not.

Investigated on 2026-09-15 by comparing file bytes, reading the embedded
encoder and tag data, and searching the public code index. Nothing here is
assumed: each row says how it was established.

## Summary

| Group | Files | Established | Status |
|---|---|---|---|
| Identical to [remvze/moodist](https://github.com/remvze/moodist) | 10 | byte-for-byte identical, SHA-256 verified | licence unresolved, see below |
| Unknown origin, LAME 3.99.5 group | 22 | shared encoder signature, no other trace | licence unknown |
| SoundBible | 1 | tag inside the file | attribution required, author unknown |
| GarageBand | 1 | tag inside the file | redistribution not permitted |

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

## The twenty-two of unknown origin

`bowl-a` `bowl-b` `bowl-d` `bowl-e` `bowl-f` `bowl-g`, `city-park`,
`city-traffic`, `dolphins`, `elephant`, `gong`, `gong-chinese`,
`jungle-birds`, `jungle-night`, `jungle-river`, `leopard`, `monkeys`,
`ocean-deep`, `subway`, `tropical-birds`, `underwater-ambient`, `whales`.

All encoded with LAME 3.99.5, a different encoder from the Moodist set, so
they came from somewhere else. No tags, no download script in the repository
history, and no credits file ever existed. The public code index returns no
repository containing `jungle-river.mp3` or `tropical-birds.mp3` at all, so
they were not taken as a set from a public project.

Origin unknown. Treat as unlicensed until established.

## The two with a name in them

| File | Tag in the file | What it means |
|---|---|---|
| `bell.mp3` | title and artist both read `SoundBible.com Must Credit`, dated 2017 | SoundBible distributes under Creative Commons Attribution or Public Domain. "Must credit" means the Attribution licence: a credit naming the author is required, and we do not know who the author is. |
| `gong-old.mp3` | `TSS = GarageBand 10.2.0` | Produced in GarageBand. Apple's licence permits using the output in your own work; it does not permit redistributing the material as a standalone file. |

## What follows from this

The bundled audio cannot be treated as covered by this project's MIT licence.
For local use it is fine. Before anyone forks, relicenses or ships this
commercially, each file needs either a licence on record or a replacement.

Order of work, by exposure:

1. **Replace the two named files.** `bell.mp3` needs either a proper credit
   with the author's name or a CC0 replacement. `gong-old.mp3` needs a
   replacement outright.
2. **Resolve the ten from Moodist.** Each one is either CC0 or Pixabay. Find
   the original on Pixabay or Freesound and record which; replace the Pixabay
   ones with CC0 equivalents.
3. **Replace the twenty-two unknowns** with CC0 files whose source URL is
   recorded here as they are added.

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
