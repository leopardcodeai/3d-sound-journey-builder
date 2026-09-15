# Sound Sources and Licensing Research

Date: 2026-09-15. Scope: legal sources for more ambience recordings and frequency/preset
data for this repository (`pirate-healings-sound-journey-builder`), an MIT-licensed
browser spatial soundscape builder that bundles looped ambience mp3s and procedural tone
generators.

Method: every licence claim below was checked against the provider's own site on
2026-09-15 via live web search and page fetches; URLs are listed in Sources. Two pages
(BBC RemArc licence page, xeno-canto terms page) returned 403/bot-protection errors to
automated fetching, so those two entries rely on the provider's own wording as preserved
in search caches and cross-checked against at least one independent write-up. The ffmpeg
and Freesound API examples in Part 4 were executed against real tools during this
research, not recalled from memory; results are noted inline.

**The one rule that decides most of Part 1:** this repo is MIT-licensed, which lets
anyone fork it and reuse it commercially. That collides with two clauses that recur
across "free" sound sites: **non-commercial-only** licences (BBC RemArc, default
Freesound CC-BY-NC, ESC-50, UrbanSound8K), and **"no standalone redistribution"**
clauses that allow using a sound inside a finished build but forbid shipping the raw
file itself (Sonniss GDC, Philharmonia, Mixkit, Samplicity). Committing an mp3 straight
into a public git repo is arguably exactly the "standalone" distribution those clauses
forbid, even though baking the same file into a compiled app might be fine. Read every
row below with that distinction in mind.

## Part 1: Sample sources

| Source | Content | Licence | Redistribution in this OSS repo | Attribution | API / bulk | Account | Verdict |
|---|---|---|---|---|---|---|---|
| [Freesound](https://freesound.org/) | User-uploaded SFX, huge catalogue | CC0, CC-BY, CC-BY-NC per sound (legacy Sampling+ retired) | Yes for CC0/CC-BY; skip CC-BY-NC | Required for CC-BY/NC, not CC0 | Yes, APIv2 with `filter=license:"Creative Commons 0"` | Required to download originals (OAuth2) | Best single source once filtered to CC0 |
| [BBC Sound Effects](https://sound-effects.bbcrewind.co.uk/) | ~16,000 BBC WAV effects | RemArc licence (custom): personal, educational or research use only | No — non-commercial only, conflicts with MIT reuse downstream | BBC credit expected | No API; browse and download | Not required | Avoid for this app |
| [Pixabay](https://pixabay.com/sound-effects/) | SFX and music | Pixabay Content Licence (custom) | Unclear — licence bars selling/distributing content "on a Standalone basis"; doesn't address source-repo bundling directly | Not required | No public audio API | Not confirmed from the summary page | Use compiled into a build; don't commit raw files without reading the full ToS |
| [Mixkit](https://mixkit.co/) | Free SFX and music | Mixkit Free Licence (custom) | No — reselling or redistributing items "as is" is barred without significant modification | Appreciated, not required | No | Not required to browse | Fine inside a shipped build, not as a repo asset |
| [Zapsplat](https://www.zapsplat.com/) | Large SFX/music library | Standard (free) / Gold (paid) licence | Standard licence is a single-user usage grant; redistribution of the raw file isn't addressed | Required ("zapsplat.com" credit) unless Gold | No public API | Free account required to download | Attribution overhead unless paid; usable in a build, not as a free-standing repo asset |
| [Uppbeat](https://uppbeat.io/) | Music and SFX for creators | Uppbeat licence tiers, scoped to "open distribution platforms" | Built for finished videos/apps on named platforms, not source-file redistribution | Required on the Free plan | No | Account required | Not a fit for bundling raw loop files |
| [OpenGameArt](https://opengameart.org/) | Game art/audio from many contributors | CC0, CC-BY, CC-BY-SA, GPL, OGA-BY, chosen per asset | Yes, matching the per-asset licence | Depends on licence (none for CC0) | No API; direct download | Not required to download | Good — filter to CC0/CC-BY items |
| [Internet Archive](https://archive.org/details/audio) | Enormous mixed audio archive | Varies per item; uploader-declared and not guaranteed accurate | Only for items explicitly tagged CC0/public domain | Per item | Yes, metadata API and bulk item download | Not required for public items | Usable, but verify every item's own rights field |
| [Wikimedia Commons](https://commons.wikimedia.org/wiki/Commons:Licensing) | Media for Wikimedia projects | Accepts only CC0, CC-BY, CC-BY-SA, Free Art License, or public domain — CC-BY-NC/ND are rejected | Yes | Required for CC-BY/BY-SA | Yes, MediaWiki API | Not required | Good — every file is already commercial-safe by site policy |
| [xeno-canto](https://xeno-canto.org/) | Bird call recordings, huge species coverage | CC licences per recording; many are CC-BY-NC-SA | Only for the CC-BY/CC0 recordings; must check per file | Required | Yes, REST API (`xeno-canto.org/explore/api`) | Not required for API reads | Good for bird ambience, but filter out NC recordings; site discourages indiscriminate mass-download scraping |
| [NPS Sound Gallery](https://www.nps.gov/subjects/sound/gallery.htm) | US national park natural/cultural sounds | Public domain (US government work) | Yes | Requested, not required | No API; direct mp3 links | Not required | Excellent — public domain, on-topic nature ambience |
| [NASA audio](https://www.nasa.gov/audio-and-ringtones/) | Mission audio, space sounds | Public domain (US government work) per [NASA media guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/) | Yes, but avoid the NASA insignia/logotype and check for any third-party music mixed into a clip | Not required | No dedicated audio API | Not required | Excellent for space/mission ambience with that one caveat |
| [Sonniss GDC bundles](https://sonniss.com/gameaudiogdc) | Professional game-audio SFX, free annual GDC packs | Custom royalty-free licence | No — "no standalone redistribution" as a raw library, and AI/ML training is explicitly barred | Not required | No API; large zip downloads | Not confirmed | Great inside a compiled build, not for committing raw files |
| [Philharmonia Orchestra samples](https://philharmonia.co.uk/resources/sound-samples/) | Solo orchestral instrument notes | Custom free licence | No — "must not be sold or made available 'as is'" | Not required | No | Not required | Use for in-app synthesis, don't redistribute the sample files themselves |
| [VSCO2 / VCSL](https://github.com/sgossner/VCSL) | Community orchestral/instrument sample library | CC0 | Yes | Not required | Git clone / GitHub releases | Not required | Excellent — CC0, trivial to vendor into the repo |
| [University of Iowa MIS](https://theremin.music.uiowa.edu/MIS.html) | Solo instrument note samples | Site states samples "may be downloaded and used for any projects, without restrictions" — no formal licence text | Likely yes, but undocumented; keep written confirmation (e.g. an email) before shipping commercially | Not required | No | Not required | Good in practice; the lack of a formal licence is the only wrinkle |
| [Pianobook](https://www.pianobook.co.uk/) | Community-sampled instruments (mostly keys) | Pianobook licence: free for commercial and non-commercial use | No — repurposing a pack to resell on another site is explicitly barred | Not required | No | Free account required | Fine for in-app instrument sounds, not for redistributing the packs themselves |

## Part 2: Frequency and preset data

### 2.1 Open-source binaural/isochronic generators

| Tool | Licence | Preset format |
|---|---|---|
| [Gnaural](https://gnaural.sourceforge.net/) | Free/open source (SourceForge project); the modern "Gnaural Web" rewrite is open-source HTML5/JS | XML preset files describing a timeline of binaural "voices" as frequency/amplitude keyframes; separate "Mindstate" and "Soundscape" preset packs are distributed alongside the app on [SourceForge](https://sourceforge.net/projects/gnaural/files/Presets/) |
| [SBaGen](http://uazu.net/sbagen/) | GNU General Public Licence | Plain-text `.sbg` sequence files: a 24-hour schedule of timestamped lines, each mixing tone-generator blocks (binaural tones, pink/white noise, or an external audio file) with target frequency and amplitude |

### 2.2 Brainwave bands (EEG)

Boundaries are conventions, not physical constants, and vary slightly by source; the ranges below are the commonly cited consensus (e.g. [Emotiv's frequency-band reference](https://www.emotiv.com/neuroscience/frequency-bands)).

| Band | Range | Associated state |
|---|---|---|
| Delta | 0.5-4 Hz | Deep, dreamless sleep |
| Theta | 4-8 Hz | Light sleep, meditation, memory encoding |
| Alpha | 8-13 Hz | Relaxed wakefulness, calm focus |
| Beta | 13-30 Hz | Active thinking, alertness |
| Gamma | 30-100 Hz (entrainment tools typically use 30-50 Hz) | High-level cognitive binding, attention |

### 2.3 Solfeggio frequencies — no scientific or historical support

| Tone | Common marketing label |
|---|---|
| 396 Hz | "Liberating guilt and fear" |
| 417 Hz | "Facilitating change" |
| 528 Hz | "Transformation and DNA repair" |
| 639 Hz | "Connecting relationships" |
| 741 Hz | "Awakening intuition" |
| 852 Hz | "Returning to spiritual order" |

These numbers were not handed down from Gregorian chant or antiquity. They were derived in the late 20th century by Dr. Joseph Puleo using a numerology reduction on Bible verses, then popularized with health claims by Dr. Leonard Horowitz in his 1999 book. There is no historical or musicological evidence tying them to medieval chant, and no credible clinical evidence that any audible frequency "repairs DNA." One small, unreplicated 2018 pilot reported a stress-marker change from 528 Hz audio in a tiny sample — that is not a basis for a therapeutic claim, only for "some people find sustained tones relaxing," which is true of sound-based relaxation generally, not specific to 528 Hz.

### 2.4 Chakra tones — no scientific or historical support

| Chakra | Frequency commonly assigned |
|---|---|
| Root | 396 Hz |
| Sacral | 417 Hz |
| Solar Plexus | 528 Hz |
| Heart | 639 Hz |
| Throat | 741 Hz |
| Third Eye | 852 Hz |
| Crown | 963 Hz |

This list is the solfeggio numbers relabeled — a modern Western conflation, not a classical yogic teaching (traditional chakra texts describe qualities and colours, not Hz values, since the concept of measuring cycles per second postdates the texts by centuries). Different popular sources don't even agree with each other: some assign the root chakra 256 Hz, others 194 Hz. That inconsistency between "authoritative" charts is itself evidence there is no underlying measurement to be inconsistent about.

### 2.5 Schumann resonance — real physics, unsupported wellness claims

The Schumann resonance is a real, continuously measured phenomenon: the cavity between the Earth's surface and the ionosphere resonates at a fundamental of about **7.83 Hz**, with harmonics near 14.3, 20.8, 27.3 and 33.8 Hz, driven by global lightning activity ([Wikipedia summary](https://en.wikipedia.org/wiki/Schumann_resonances), monitored via feeds such as Tomsk Observatory and NOAA space-weather data). The exact value drifts slightly with ionospheric conditions, so "about 7.83 Hz" is more accurate than a fixed number.

What is **not** supported: the claim that playing a 7.83 Hz tone entrains human brainwaves or delivers specific health benefits. That is a leap from a real geophysical fact to an unproven physiological one, and no rigorous clinical evidence backs it.

### 2.6 Carrier frequency recommendations for binaural beats

Gerald Oster's 1973 *Scientific American* article "Auditory Beats in the Brain" found that binaural beats are perceived most clearly with carrier tones below roughly 1000 Hz, summarized informally as the "Oster curve" — commonly cited as favoring carriers in the 100-500 Hz range depending on the target beat frequency. Contemporary studies typically use carriers around 200-400 Hz (e.g. 250 Hz or 400 Hz) with the beat frequency set to the target EEG band. Oster was studying **perception thresholds**, not entrainment outcomes, and modern results on whether binaural beats actually shift brainwave state are mixed: a 2025 parametric study found only a 6 Hz (theta) beat significantly changed calmness/focus ratings out of several tested, and reviews describe outcomes as inconsistent across studies with varying carrier/beat/duration choices. Ship binaural beats as an ambience/relaxation feature, not as a medical or cognitive-enhancement claim.

### 2.7 Breathing protocols

| Protocol | Pattern | Source | Evidence |
|---|---|---|---|
| Resonance (coherent) breathing | ~4.5-7 breaths/min, ~6 breaths/min (0.1 Hz) typical, individualized per person | Paul Lehrer / Richard Gevirtz heart-rate-variability biofeedback research | Strongest evidence of the three below: repeatedly shown in lab and clinical studies to maximize heart-rate-variability amplitude at each person's own "resonance frequency" |
| Box breathing | 4s inhale - 4s hold - 4s exhale - 4s hold | Popularized by former Navy SEAL Mark Divine (SEALFIT), adapted from yogic *sama vritti* pranayama | Grounded in general slow-breathing/vagal-tone physiology; little direct controlled-trial evidence for the specific 4-4-4-4 ratio itself |
| 4-7-8 breathing | 4s inhale - 7s hold - 8s exhale | Popularized in 2015 by Dr. Andrew Weil as the "Relaxing Breath," adapted from pranayama | Marketed as a "natural tranquilizer for the nervous system"; evidence remains thin and mostly anecdotal, not backed by large controlled trials |

## Part 3: Spatial audio and effects data

### 3.1 HRTF datasets (SOFA format)

SOFA (Spatially Oriented Format for Acoustics) is the Audio Engineering Society's open standard **AES69** for storing HRTFs and spatial/binaural room impulse responses. The format itself carries no usage restriction — it's a container — and open-source read/write libraries exist for MATLAB/Octave, Python and Max ([sofaconventions.org](https://www.sofaconventions.org/mediawiki/index.php/SOFA_(Spatially_Oriented_Format_for_Acoustics))). Licensing applies per dataset, not to the format:

| Dataset | Licence | Size |
|---|---|---|
| [SADIE II](https://www.york.ac.uk/sadie-project/database.html) | Apache License 2.0 | 20 subjects (2 mannequins + 18 humans), up to 8,802 measured directions per subject, 44.1/48/96 kHz WAV plus SOFA; free on Zenodo |
| [CIPIC](https://github.com/amini-allight/cipic-hrtf-database) | Public domain (Release 1.0) | 45 subjects, 1,250 directions each, about 180 MB; the original UC Davis host is unreliable, GitHub mirrors exist |
| [MIT KEMAR](https://sound.media.mit.edu/resources/KEMAR.html) (Gardner & Martin) | Free, attribution required | 710 measurements per ear, -40° to +90° elevation; classic dummy-head baseline dataset |
| [ARI](https://projects.ari.oeaw.ac.at/research/experimental_audiology/hrtf/database/hrtfBtESOFA.html) (Austrian Academy of Sciences) | CC BY-SA 3.0 | 221 subjects, 1,550 directions each — one of the largest measured sets; share-alike applies to derivatives of the data itself |
| [IRCAM LISTEN](http://recherche.ircam.fr/equipes/salles/listen/) | "Public and available for any use," credit appreciated, copyright IRCAM 2002 | Multiple human subjects with anthropometric measurements and pinna photos (exact subject count not confirmed from the pages fetched here) |
| [HUTUBS](https://depositonce.tu-berlin.de/bitstreams/8f6e24a2-1c75-4f84-a50f-74a34bb480c7/download) (TU Berlin) | CC BY 4.0 | 96 subjects: HRIRs, headphone IRs, anthropometry, and 58 head 3D meshes |

### 3.2 Free reverb impulse responses

| Library | Licence | Notes |
|---|---|---|
| [OpenAIR](https://www.openair.hosted.york.ac.uk/) (University of York) | Per-contributor choice, most commonly CC BY 4.0 | Check the licence line on each individual impulse response's page — contributors can reserve all rights instead. The site returned an "account suspended" error on one fetch during this research even though individual pages were reachable via search cache; re-verify it is live before depending on it. |
| [EchoThief](http://www.echothief.com/) | No explicit licence text on-site, only a copyright line (Dr. Chris Warren, 2013-2026) | Free direct zip download; email the author for explicit written commercial/redistribution clearance before bundling in a public repo |
| [Voxengo](https://www.voxengo.com/impulses/) (IM Reverbs Pack) | Royalty-free for any use, including commercial, of *processed audio*; redistributing the pack itself is only allowed unaltered, uncharged, with the copyright notice intact | Fine to use inside your convolution pipeline; don't re-package the IR files as your own downloadable asset |
| [Samplicity](https://samplicity.com/downloads/) (Bricasti M7) | Free ("donationware") but explicitly excludes inclusion in commercial products, per Bricasti's own licensing request | Not safe for an MIT-licensed app that others may reuse commercially |

### 3.3 Research soundscape datasets

| Dataset | Licence | Fit for this app |
|---|---|---|
| [FSD50K](https://arxiv.org/pdf/2010.00475) | Collection is CC-BY overall; every clip keeps its original Freesound licence (CC0/CC-BY/CC-BY-NC/Sampling+) | Same per-clip caveats as Freesound itself — built for sound-event research, not distribution, but an individual CC0 clip could be traced back to its Freesound page and reused |
| [ESC-50](https://github.com/karolpiczak/ESC-50) | CC BY-NC (the smaller ESC-10 subset is CC-BY) | Non-commercial by default — unusable for this MIT-licensed app except the small CC-BY subset |
| [UrbanSound8K](https://zenodo.org/records/1203745) | CC BY-NC 3.0, research use only; clips sourced from Freesound with a credits file | Not usable for a commercially-reusable OSS app |

## Part 4: Practical guidance

### 4.1 Top 8 shortlist, ordered by licence safety for this app

1. **Freesound, filtered to CC0 only** — largest selection, zero obligations once filtered; the only cost is a one-time developer API signup.
2. **Wikimedia Commons** — every accepted file is already free-culture and commercial-safe by site policy; just note CC-BY-SA share-alike if you pick a non-CC0 file.
3. **OpenGameArt, CC0/CC-BY items** — clearly marked per submission, audio-specific tags make filtering easy.
4. **VCSL / VSCO2 Community Edition** — CC0 instrument samples, lives on GitHub, trivial to vendor as a git submodule or direct copy.
5. **NPS Sound Gallery** — US-government public domain, on-topic nature ambience (water, wind, wildlife).
6. **NASA audio** — public domain, strong fit for space/deep ambience; skip anything carrying the NASA insignia.
7. **University of Iowa Musical Instrument Samples** — practically unrestricted, only wrinkle is the lack of formal licence text (email for confirmation and keep the reply on file).
8. **Internet Archive, CC0/public-domain items only** — huge breadth, but verify the rights field per item; don't trust the site-wide reputation.

Everything else in Part 1 (BBC, Zapsplat Standard, Mixkit, Uppbeat, Sonniss GDC, Philharmonia, Pianobook, Pixabay) is usable only under narrower conditions — non-commercial only, attribution-in-app required, or "no standalone redistribution." Fine for a compiled build's audio, risky to commit as raw files in a public MIT-licensed repo.

### 4.2 Checklist for adding a sound legally

1. Read the licence text on the source's own page, not just a badge or a third party's summary of it — badges lag and get miscopied.
2. Confirm the licence permits both commercial use and, specifically, redistribution of the raw file (not just "use in a finished work") if you plan to commit it to the repo.
3. Save a copy of the licence text or a dated screenshot, and note the exact page URL — licences on user-upload sites can change if the uploader relicenses or removes the item.
4. Check compatibility with this repo's MIT licence: reject anything CC-BY-NC/NC-SA or otherwise non-commercial, since downstream users of an MIT repo may use it commercially.
5. Normalize, loop, and encode the file using the pipeline in 4.4 below.
6. Add one entry to the attribution manifest (format in 4.3) before or in the same commit as the audio file — never after.
7. Commit the audio file and its attribution entry together in one PR so history stays traceable.
8. For CC0 sources, attribution is optional but recording provenance (source + URL + date) is still good practice — it is your only record if a dispute ever comes up.
9. Re-check licence text again at release time for any sound whose licence you are unsure has stayed stable since you downloaded it.

### 4.3 Attribution file format

Keep one machine-readable manifest per asset folder, e.g. `public/sounds/ATTRIBUTION.json`, with one entry per file:

```json
{
  "file": "rain-loop.mp3",
  "title": "Heavy Rain on Roof",
  "author": "username123",
  "source_url": "https://freesound.org/s/123456/",
  "license": "CC0-1.0",
  "license_url": "https://creativecommons.org/publicdomain/zero/1.0/",
  "downloaded": "2026-09-15",
  "modifications": "Trimmed to 12s, crossfade-looped, normalized to -18 LUFS, encoded to mp3 (q2) and opus (64k)"
}
```

For CC-BY/CC-BY-SA sources, add an `"attribution_text"` field with the exact credit string the licence requires, and surface that text in the app's in-app credits screen, not only in the repo.

### 4.4 ffmpeg commands (tested locally against ffmpeg 9.0.1 on synthetic audio, 2026-09-15)

**Seamless loop via crossfade.** Blends the last `FADE` seconds into the first `FADE` seconds so the loop point disappears; verified end-to-end (a 6s test source produced a clean 5s loop, `DUR - FADE`, with no ffmpeg errors):

```bash
IN=source.wav
OUT=loop.wav
DUR=6      # input duration in seconds (ffprobe -show_entries format=duration)
FADE=1     # crossfade length in seconds
MID_END=$(echo "$DUR-$FADE" | bc)

ffmpeg -y -i "$IN" -filter_complex \
"[0:a]asplit=2[a][b]; \
 [a]atrim=0:${FADE},asetpts=PTS-STARTPTS[head]; \
 [b]atrim=${MID_END}:${DUR},asetpts=PTS-STARTPTS[tail]; \
 [tail][head]acrossfade=d=${FADE}:c1=tri:c2=tri[xf]; \
 [0:a]atrim=${FADE}:${MID_END},asetpts=PTS-STARTPTS[mid]; \
 [xf][mid]concat=n=2:v=0:a=1[loopout]" \
-map "[loopout]" "$OUT"
```

**Two-pass loudness normalization to -18 LUFS.** Pass 1 measures, pass 2 applies the measured values (verified: a test file measured at -21.0 LUFS came out at exactly -18.0 LUFS integrated / -4.9 dBTP after pass 2):

```bash
# Pass 1: measure
ffmpeg -i loop.wav -af loudnorm=I=-18:TP=-1.5:LRA=11:print_format=json -f null - 2> pass1.log
# read measured_I / measured_TP / measured_LRA / measured_thresh from the JSON block in pass1.log

# Pass 2: apply (substitute the four measured_* values from pass 1)
ffmpeg -i loop.wav -af loudnorm=I=-18:TP=-1.5:LRA=11:measured_I=-20.96:measured_TP=-7.87:measured_LRA=0.50:measured_thresh=-30.96:linear=true:print_format=summary -ar 44100 normalized.wav
```

**Encode to mp3** (VBR quality 2, roughly 170-210 kbps for typical stereo ambience; confirmed to decode and probe correctly):

```bash
ffmpeg -i normalized.wav -c:a libmp3lame -q:a 2 -ar 44100 out.mp3
```

**Encode to opus** (64 kbps VBR, good size/quality trade-off for looped ambience; confirmed output at 48 kHz, ~61 kbps actual):

```bash
ffmpeg -i normalized.wav -c:a libopus -b:a 64k -vbr on -compression_level 10 -application audio out.opus
```

### 4.5 Freesound API: querying for CC0 results

Apply for a free API key at [freesound.org/apiv2/apply](https://freesound.org/apiv2/apply); it authenticates as a `token` query parameter ([auth docs](https://freesound.org/docs/api/authentication.html)). This exact request was run during this research — without a valid token it correctly returns HTTP 401 (confirming the endpoint and query shape are live, not just remembered from documentation):

```bash
curl "https://freesound.org/apiv2/search/text/?query=rain&filter=license:%22Creative+Commons+0%22&fields=id,name,license,previews,download&token=YOUR_API_KEY"
```

`filter=license:"Creative Commons 0"` restricts results to CC0 sounds only (other values are `"Attribution"` and `"Attribution NonCommercial"`). Downloading the original (uncompressed) file requires OAuth2; the `previews` field in the response gives a directly downloadable, no-OAuth mp3/ogg preview that is often good enough for a web app. Standard rate limits are 60 requests/minute and 2,000/day for search, and 30/minute and 500/day for file downloads.

## Sources

Part 1:
- [Freesound FAQ](https://freesound.org/help/faq/)
- [Freesound APIv2 overview](https://freesound.org/docs/api/overview.html)
- [Freesound APIv2 resources](https://freesound.org/docs/api/resources_apiv2.html)
- [Freesound API authentication](https://freesound.org/docs/api/authentication.html)
- [BBC Sound Effects RemArc — Hacker News discussion](https://news.ycombinator.com/item?id=24587143)
- [BBC Sound Effects RemArc — Renoise forum](https://forum.renoise.com/t/16-000-bbc-sound-effects-are-made-available-by-the-bbc-in-wav-format-to-download-for-use-under-the-terms-of-the-remarc-licence/58952)
- [BBC Sound Effects RemArc — Gearspace](https://gearspace.com/board/new-product-alert-2-older-threads/1212518-bbc-sound-effects-library-avail-non-commercial-use.html)
- [Pixabay licence summary](https://pixabay.com/service/license-summary/)
- [Mixkit terms](https://mixkit.co/terms/)
- [Zapsplat standard licence](https://www.zapsplat.com/license-type/standard-license/)
- [Zapsplat attribution FAQ](https://www.zapsplat.com/faq/i-cant-attribute-credit-zapsplat-com-in-my-work-as-stated-by-your-standard-license-can-i-still-use-them/)
- [Uppbeat licence](https://uppbeat.io/license)
- [Uppbeat user agreement](https://uppbeat.io/user-agreement)
- [OpenGameArt FAQ](https://opengameart.org/content/faq)
- [Internet Archive rights help](https://help.archive.org/help/rights/)
- [Wikimedia Commons licensing policy](https://commons.wikimedia.org/wiki/Commons:Licensing)
- [xeno-canto API](https://xeno-canto.org/explore/api)
- [xeno-canto — Wikipedia](https://en.wikipedia.org/wiki/Xeno-canto)
- [NPS Sound Gallery](https://www.nps.gov/subjects/sound/gallery.htm)
- [NASA images and media usage guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/)
- [NASA audio and ringtones](https://www.nasa.gov/audio-and-ringtones/)
- [Sonniss GameAudioGDC](https://sonniss.com/gameaudiogdc)
- [Philharmonia sound samples](https://philharmonia.co.uk/resources/sound-samples/)
- [University of Iowa Musical Instrument Samples](https://theremin.music.uiowa.edu/MIS.html)
- [Pianobook terms and conditions](https://www.pianobook.co.uk/terms-conditions/)
- [Pianobook FAQ — commercial use](https://www.pianobook.co.uk/faq/are-pianobook-sample-packs-royalty-free-or-free-for-commercial-use/)
- [VCSL (Versilian Community Sample Library) on GitHub](https://github.com/sgossner/VCSL)
- [VSCO 2 Community Edition](https://versilian-studios.com/vsco-community/)

Part 2:
- [Gnaural](https://gnaural.sourceforge.net/)
- [Gnaural presets](https://sourceforge.net/projects/gnaural/files/Presets/)
- [SBaGen](http://uazu.net/sbagen/)
- [Emotiv EEG frequency bands](https://www.emotiv.com/neuroscience/frequency-bands)
- [Solfeggio frequencies — claims vs. science](https://www.soundmedicineacademy.com/pages/sound-healing-blog/solfeggio-frequencies)
- [528 Hz frequency — claims tested against science](https://musickanheal.com/528-hz-frequency/)
- [Chakra frequencies chart](https://www.miraclefrequencies.org/post/chakra-frequencies-complete-chart-all-7-chakras)
- [The hidden confusion around chakra frequencies](https://www.flowerofsound.com/the-hidden-confusion-around-chakra-frequencies/)
- [Schumann resonances — Wikipedia](https://en.wikipedia.org/wiki/Schumann_resonances)
- [Schumann resonances — Big Think ("amazing physics, sham medicine")](https://bigthink.com/starts-with-a-bang/entire-earth-resonates/)
- [The Oster curve explained](https://www.binauralbeatsmeditation.com/oster-curve/)
- [Parametric investigation of binaural beats — Scientific Reports](https://www.nature.com/articles/s41598-025-88517-z)
- [Resonance frequency breathing impact on HRV, blood pressure, mood — PMC](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5575449/)
- [Integrating breathing techniques into psychotherapy — Frontiers in Psychology](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2021.624254/full)
- [HRV: from brain death to resonance breathing at 6 breaths/min — ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S1388245719313021)
- [Box breathing — MedicineNet](https://www.medicinenet.com/why_do_navy_seals_use_box_breathing/article.htm)
- [4-7-8 breathing — Dr. Andrew Weil](https://www.drweil.com/health-wellness/body-mind-spirit/stress-anxiety/three-breathing-exercises-and-techniques/)
- [4-7-8 breathing method — Cleveland Clinic](https://health.clevelandclinic.org/4-7-8-breathing)

Part 3:
- [SOFA format — sofaconventions.org](https://www.sofaconventions.org/mediawiki/index.php/SOFA_(Spatially_Oriented_Format_for_Acoustics))
- [SADIE II database](https://www.york.ac.uk/sadie-project/database.html)
- [CIPIC HRTF database mirror](https://github.com/amini-allight/cipic-hrtf-database)
- [CIPIC HRTF database paper](https://www.ece.ucdavis.edu/cipic/wp-content/uploads/sites/12/2015/04/cipic_WASSAP_2001_143.pdf)
- [MIT KEMAR HRTF](https://sound.media.mit.edu/resources/KEMAR.html)
- [ARI HRTF database](https://projects.ari.oeaw.ac.at/research/experimental_audiology/hrtf/database/hrtfBtESOFA.html)
- [HUTUBS HRTF database](https://depositonce.tu-berlin.de/bitstreams/8f6e24a2-1c75-4f84-a50f-74a34bb480c7/download)
- [IRCAM LISTEN HRTF database](http://recherche.ircam.fr/equipes/salles/listen/)
- [OpenAIR library](https://www.openair.hosted.york.ac.uk/)
- [OpenAIR project page — University of York](https://www.york.ac.uk/electronic-engineering/research/communication-technologies/projects/open-acoustic-impulse-response-library/)
- [EchoThief](http://www.echothief.com/)
- [Voxengo free impulse responses](https://www.voxengo.com/impulses/)
- [Samplicity downloads](https://samplicity.com/downloads/)
- [FSD50K paper](https://arxiv.org/pdf/2010.00475)
- [ESC-50 on GitHub](https://github.com/karolpiczak/ESC-50)
- [UrbanSound8K on Zenodo](https://zenodo.org/records/1203745)

Part 4:
- ffmpeg commands verified locally with `ffmpeg version 9.0.1` on synthetic pink-noise test audio (no external source needed for verification).
- [Freesound API text search endpoint](https://freesound.org/apiv2/search/text/) — verified live (returns HTTP 401 without a token, confirming the endpoint and query parameters).
