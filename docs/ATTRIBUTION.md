# Attribution

Every bundled audio file and its licence. Add a row before adding a file to
`public/sounds/`.

## Format

| File | Sound | Source | Author | Licence | Notes |
|---|---|---|---|---|---|
| `birds.mp3` | Birdsong | to be confirmed | to be confirmed | to be confirmed | inherited from the first version of this project |

## Status

The samples in `public/sounds/` were collected before this file existed, and
their provenance has not been reconstructed. Until each row is filled in, treat
the bundled audio as unverified: it is fine for local use, but do not assume it
can be redistributed under the project's MIT licence.

The plan, in order:

1. Replace anything whose licence cannot be established with a CC0 equivalent.
2. Record the source URL, author and licence for every remaining file.
3. Add the attribution line required by the licence to this file and to the
   app's settings drawer where the licence asks for visible credit.

Vetted sources and the licence rules that apply to them are listed in
[research/2026-09-15-sound-sources-and-licensing.md](research/2026-09-15-sound-sources-and-licensing.md).

## Generated audio

Instrument tones, binaural and isochronic beats, noise, the breathing pacer and
the generative layers are synthesised at runtime by
`src/audio/InstrumentSynth.js` and `src/audio/Generators.js`. They contain no
third-party material.

## Texture

`public/leopard-texture.jpg` is a brand asset of LeopardCode.AI.
