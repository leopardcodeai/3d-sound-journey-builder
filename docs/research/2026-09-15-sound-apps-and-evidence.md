# Sound apps and evidence: competitor research and technique review

Date: 2026-09-15. Scope: product research on adjacent soundscape/meditation apps and a
literature check on the audio techniques used in this app's frequency-tool set (binaural,
isochronic, monaural, pure tone, noise colors, breath pacer, Schumann-style modulation).
Every claim below is sourced; see the Sources section for URLs. Where a claim could not be
verified from a primary source, it is marked as such.

## Part 1: Competitor apps

### Overview: positioning, pricing, generative vs. curated, adaptive inputs

| App | Positioning & pricing | Content model | Adaptive inputs |
|---|---|---|---|
| **Endel** | AI "personalized soundscapes" for focus, relax, sleep, activity. ~$6.99/mo, $49.99/yr (promo $39.99/yr), ~$90 lifetime. | Fully generative, on-device, endless | Time of day, weather, motion/cadence, heart rate (Apple Watch), circadian rhythm |
| **Brain.fm** | "Functional music" for focus/relax/sleep via patented rapid amplitude modulation. $14.99/mo or $99.99/yr (~$8.33/mo effective), 3-day trial. | Curated catalog of algorithmically generated tracks, not real-time adaptive | None beyond session-type selection (focus/relax/sleep, energy level) |
| **FlowTunes** | Free web + iPhone app, "music for focus," AI + human-curated channels. No paid tier found. | Curated music channels + a separate background-sound layer | None; user picks channel and background sound manually |
| **myNoise** | Web free/donation-supported; mobile apps a one-time unlock (~$10–20) for life, 14-day trial. | 300+ hand-built generators, each with a multi-slider "Creation Mode" | "Animate Mode" randomly moves sliders for slow variation — self-generative, not context-aware |
| **Noisli** | Free tier capped near 1.5 h/day; premium ~$10–12/mo, separate business plan. | Curated sound library (~28 sounds), manual mixing | None; manual mixing, timer, distraction-free writing tool |
| **Portal** | "Immersive spatial audio for focus, sleep, escape." $9.99/mo, $49.99/yr, $249.99 lifetime (revised June 2026). | Curated ambisonic recordings, some head-tracked | Head orientation (AirPods Pro/Max) for dynamic spatial audio; smart-lighting sync — not context/biometric adaptive |
| **Calm** | Market-leading meditation app; soundscapes/Sleep Stories are one feature among many. $16.99/mo, $69.99/yr, $99.99/yr family, $399.99 lifetime. | ~90 fixed curated ambient tracks; celebrity-narrated Sleep Stories | None |
| **Headspace** | Meditation app; "Soundscapes for Work" (3D-recorded field audio) and Focus Music as sub-features. $12.99/mo, $69.99/yr, $9.99/yr student. | Curated fixed recordings and playlists, artist collaborations (Hans Zimmer, John Legend, Arcade Fire) | None |
| **Anima: Binaural Beats** | Closest match for "Anima" in this space (MWM/Mega E Limited). Binaural beats for sleep/focus/anxiety/tinnitus. Freemium with Pro subscription; exact price unpublished, reviewers call it pricier than expected. | Curated binaural-beat tracks by brainwave band, plus Solfeggio tones | None; user selects a target state |

No app plausibly named "Portal" other than the spatial-audio app above (portal.app) surfaced in this space; it is included as the closest match. No second "Anima" candidate appeared.

### UI patterns worth copying

- **FlowTunes' single-screen player**: one channel list, one big transport control, a separate background-sound layer with its own gain and fade-transition-time control, and a "no music" option that turns it into a pure ambience player. No onboarding friction, no session concept — just play.
- **Endel's mode + Scenario split**: open-ended "Soundscapes" (Focus/Relax/Sleep/Activity) run forever, while "Scenarios" (Power Nap, Meditation, Yoga, Focus Timer) are fixed-length sessions with a pre-generated **initial → middle → end phase structure** tied to the timer duration — the end phase is where wind-down/fade-out lives.
- **Session timers tied to sound behavior**: Endel and Noisli both stop or fade audio automatically on timer completion rather than cutting it abruptly; Noisli's timer also offers a completion chime.
- **Onboarding that teaches the mental model before paywalling**: Endel explains "flow state" and the Pomodoro technique before showing modes, then applies a soft paywall after a 7-day trial — it sells the concept, not just the feature list.
- **Portal's head-tracked spatial demo**: moving your head measurably moves the sound field — an immediate, visceral first-run demonstration that a screenshot can't convey.
- **myNoise's Creation Mode + Animate Mode**: expose raw per-band sliders for tuners, but default to a "just animate it slowly" mode for everyone else.

### Frequency features and how they are presented

- **Endel** exposes no binaural/isochronic/solfeggio controls; everything is framed as "personalized soundscapes," DSP stays invisible, and credibility leans on a separate "science" page rather than in-player readouts.
- **Brain.fm** is built around one technique — patented rapid amplitude modulation of functional music — and explicitly differentiates itself from binaural/monaural/isochronic beats in its own content, arguing this avoids the headphone requirement and inconsistent effect sizes of beat-based methods.
- **myNoise and Noisli** expose white/pink/brown noise as named, selectable generators alongside natural sounds, with no framing beyond the color name.
- **Anima** is the most frequency-forward: tracks are labeled by brainwave band with Hz range shown (Delta/Theta for sleep, Alpha/Theta for anxiety, Beta/Gamma for focus), plus a Solfeggio set (396–963 Hz) described with esoteric claims ("releasing fear," "inspiring love and repair") rather than mechanism — a presentation style to avoid, even though the band/Hz transparency itself is worth keeping.
- **Calm/Headspace** expose no frequency tools; "3D audio" in Headspace's Soundscapes for Work means fixed binaural-style location recordings, not real-time spatialization or beat generation.

### Studies and white papers cited by competitors

| App | Study | Authors | Year | Venue | Sample size | Peer-reviewed |
|---|---|---|---|---|---|---|
| Endel | Personalized soundscapes vs. productivity playlists/silence, focus consistency ("7x" claim) | Haruvi, Kopito, Brande-Eilat, Kalev, Kay, Furman (Arctop) | 2022 | Not published in an independent peer-reviewed journal; released as a company/Arctop report | Not disclosed | No — company-sponsored, methodology and raw data not public |
| Endel | White noise and attentional performance in preschoolers with ADHD (cited on endel.io/science as supporting evidence) | Lin, Curcio, Tchounwou | 2022 | Cited without full venue detail on Endel's page | Not disclosed on the page | Described as peer-reviewed on Endel's site; not independently verified here |
| Brain.fm | "Rapid modulation in music supports attention in listeners with attentional difficulties" | Woods, Sampaio, James, Przysinda, Spencer, Hewett, Morillon, Loui | 2024 | Communications Biology (Nature portfolio), DOI 10.1038/s42003-024-07026-3 | Not disclosed | Yes — funded in part by the US National Science Foundation, with Northeastern University's MIND Lab. Brain.fm's marketing figure ("119% increase in beta brainwaves") does not appear verbatim in the paper; treat it as marketing framing, not a published statistic |
| FlowTunes, Noisli, myNoise, Calm, Headspace | No specific studies cited in product marketing | — | — | — | — | Curation/UX products; none claim a research citation for their core sound library |
| Anima | No studies cited; Solfeggio and brainwave-band claims stated as fact, no references | — | — | — | — | No |

## Part 2: Evidence review

Grades: **strong** (multiple independent RCTs or meta-analyses with consistent, sizeable effects), **moderate** (a meta-analysis or multiple studies with real but modest/inconsistent effects, or strong mechanistic evidence with limited applied trials), **weak** (a few small or contradictory studies, plausible mechanism, no consensus), **none** (no credible physiological evidence; effects, if any, are attributable to expectation or the music itself).

| Technique | Grade | Effect size / findings | Practical parameters | Caveats |
|---|---|---|---|---|
| Binaural beats | Weak–moderate | Meta-analysis (22 studies, 35 effect sizes): overall Hedges' g = 0.45; theta/delta beats for anxiety g = 0.69 (5 effect sizes, N = 159). A 2023 review of 14 studies found only 5 supportive, 8 contradictory, 1 mixed for the underlying entrainment mechanism. | Carrier ~200–240 Hz for alpha/theta targets; expose before and during the task, not only during; masking with white/pink noise is not necessary. Requires stereo headphones. | EEG entrainment at the beat frequency is not consistently observed even where behavioral/mood effects appear; effects may partly reflect relaxation from the tone bed rather than the beat itself. |
| Isochronic and monaural beats | Weak | ~82% of a small pooled set of stimulation studies beat their control, but isochronic tones specifically have very little dedicated research; low-carrier gamma binaural beats showed the most consistent (still modest) attention benefit. | Isochronic: pulsed tone at target beat rate (e.g., 220 Hz pulsed at 10 Hz), ~50% duty cycle; works on loudspeakers, unlike binaural. Monaural: two tones summed acoustically before the ear, also speaker-compatible. | Individual response varies widely (baseline EEG, age, hearing); no consensus dosing; thinner evidence base than binaural beats. |
| Amplitude-modulated "functional music" (Brain.fm) | Moderate | 2024 peer-reviewed fMRI/EEG study found beta-range (12–20 Hz) amplitude modulation increased activation in attention networks and improved sustained-attention performance, including in listeners with attentional difficulties. | Rapid amplitude modulation applied to full musical tracks (not a pure tone) at beta rates for focus; NSF-funded, run with placebo (unmodulated) controls. | Single company/lab research program; independent replication is limited; marketing figures ("119%") are not the numbers reported in the peer-reviewed paper. |
| Pink, white and brown noise (sleep) | Weak–moderate | Closed-loop pink-noise pulses precisely timed to slow-wave EEG improved next-morning memory in a small older-adult sample; passive all-night noise from a speaker is a different, less-studied intervention. A 2021 review of 38 studies rated evidence for continuous noise improving sleep as very low quality. | Pink and white are the best-studied colors; brown has no color-specific sleep trials. Keep volume low and steady; masking low-frequency disruptors is brown noise's plausible, untested advantage. | The most-cited "pink noise helps sleep" result used precision EEG-triggered pulses, not a looped track — do not oversell a looped bed as equivalent. |
| Pink, white and brown noise (focus/ADHD) | Moderate (white/pink), weak (brown) | Meta-analysis of 13 studies (N = 335): white/pink noise gave small but real cognitive gains in youth with ADHD or elevated attention problems, and impaired performance in people without ADHD. No brown-noise studies met inclusion criteria for any meta-analysis despite 100M+ TikTok views. | White/pink noise as a low-cost option specifically for attention difficulties, not a general productivity booster. | Effect is population-specific and small; about a third of ADHD participants did worse with noise, so it is not universal. |
| 40 Hz gamma sensory stimulation | Strong (clinical, Alzheimer's), none/unproven (general wellness) | Preclinical: 40 Hz light/sound entrainment reduced amyloid load in mouse models (Iaccarino et al., 2016/2019, Cell). Clinical: Cognito Therapeutics' Phase II trial (76 mild-moderate AD patients) reported 83% slower decline in cognitive/memory scores and 61% less brain atrophy vs. control; a 670-patient Phase III (HOPE) trial has completed enrollment. | Combined synchronized 40 Hz light and sound, daily, sustained over months, via a dedicated medical device — not a consumer track played occasionally. | Evidence is specific to diagnosed Alzheimer's patients under a validated combined protocol. It says nothing about 40 Hz audio alone improving focus or mood in healthy listeners. |
| Solfeggio frequencies | None | No peer-reviewed studies link specific tones (396/528/639 Hz, etc.) to the claimed effects; the "solfeggio" numerology is not derived from acoustics or physiology. | If included, present as an aesthetic/traditional tuning choice only. | Marketing language (e.g., "528 Hz repairs DNA") is pseudoscientific and should not appear in-app. |
| 432 Hz tuning | Weak | Small studies (a cross-over pilot; a 2020 University of Florence study, N = 60) found 432 Hz vs. 440 Hz modestly lowered heart rate and sometimes blood pressure/anxiety; a cancer-patient RCT (432 vs. 443 Hz) found differential cardiovascular effects. Effects are small, inconsistently replicated. | Treat as one tuning option among several, not a claimed superior "natural" frequency. | Claims that 432 Hz is more "natural" or universally calming are unsupported; benefits, where found, are modest and could reflect the music rather than the reference pitch. |
| Nature sounds for stress/attention recovery | Strong (recovery/mood), moderate (cognition) | Meta-analysis of 18 publications (a 221-site/68-park PNAS synthesis) found consistent decreases in stress/annoyance and improved mood; water sounds were best for positive emotion, birds best against stress/annoyance. Separately, nature sounds beat urban sounds on directed-attention tasks (dual n-back, digit span), consistent with Attention Restoration Theory; degrading audio quality did not remove the benefit. | Prioritize water and bird sounds in "restorative" presets; layering multiple natural sound types compounds the benefit. | The attention-restoration studies found no supporting role for mood change — the pathway is attentional, not just relaxation. |
| Singing bowls / sound baths | Moderate | Single observational study (N = 62, ages 21–77, one 60-minute Tibetan singing-bowl session): significant reductions in tension, anger, fatigue, and depressed mood (all p < .001), and increased spiritual well-being (p < .001); meditation-naive participants improved more than experienced ones. | Session length ~60 minutes; naive users may benefit most — a good "first session" feature. | No control group (pre/post observational only), so part of the effect could be expectation, novelty, or rest itself rather than the sound. |
| Spatial / binaural (HRTF) audio for immersion | Moderate | HRTF rendering over headphones measurably increases self-reported immersion and perceived quality versus non-spatialized audio; personalized HRTFs outperform generic ones for localization accuracy. | Generic (non-personalized) HRTF, as used by the Web Audio PannerNode, is a realistic baseline; head-tracking (planned via HeadTracker.js) adds a further, well-supported immersion cue. | Supports immersion/presence and engagement, not a therapeutic claim; treat spatialization as a UX feature, not a clinical one. |
| Slow-paced (resonance frequency, ~6 breaths/min) breathing | Strong (HRV), moderate (downstream anxiety/mood) | Breathing at each person's resonance frequency (typically 4.5–7.0/min, ~6/min on average) produces the largest HRV increases (SDNN, RMSSD) of any tested rate, via resonance with baroreflex-driven blood-pressure oscillations; it outperforms faster/slower paced and free breathing. | Default to 6 breaths/min (5.5 s inhale, 4.5 s exhale) as a population default; true resonance frequency varies by person and could be an adjustable 4.5–7.0/min range. | Most trials measure HRV/blood pressure directly; downstream anxiety/mood effects are reported but more variable and typically need weeks of practice, not one session. |
| Session structuring for sleep (wind-down + fade-out) and circadian adaptation | Moderate | Consistent with sleep-hygiene and circadian science generally; applied guidance converges on a ~30–45 minute wind-down/fade as the critical pre-sleep window; several commercial apps tie audio intensity to time-of-day or circadian phase rather than flat sessions. | Fade master gain and low-pass over the last 30–45 minutes of a sleep session rather than stopping abruptly; bias content toward delta/theta and away from bright/beta as the session progresses. | A well-supported design principle from general sleep science and industry practice, not a single trial isolating "fade duration" as the sole variable. |

### Evidence-label calibration for this codebase

The frequency tools in `src/data/SoundLibrary.js` already carry an `evidence` field (`moderate` / `weak` / `none`) per the v2 design spec. Checked against the review above:

| Entry in `SoundLibrary.js` | Current | Recommended | Reason |
|---|---|---|---|
| `bw_delta/theta/alpha/beta/gamma` (binaural) | weak | weak, or moderate for a theta/delta-anxiety framing specifically | Overall effect is modest and mechanism-contested (Ingendoh 2023); the strongest sub-finding (anxiety, theta/delta, g = 0.69) could justify a higher grade for that specific use case. |
| `iso_alpha/theta/gamma`, `mono_alpha` | weak | no change | Evidence base is thinner than binaural's. |
| `noise_white`, `noise_pink` | moderate | no change | Matches the ADHD meta-analysis and general noise/sleep literature. |
| `noise_brown` | moderate (grouped with white/pink) | weak | No noise-color meta-analysis includes brown noise; its popularity is TikTok-driven, not trial-backed. The clearest label fix from this review. |
| `tone_pure` (432 Hz default) | none | weak, if explicitly framed as "432 Hz tuning" | Small RCTs show modest, real physiological effects for 432 vs. 440 Hz; if the control stays a generic "any frequency" tone, "none" remains correct. |
| `tone_solfeggio` | none | no change | No mechanistic or clinical evidence for specific solfeggio tones. |
| `schumann` | none | no change | No credible evidence that 7.83 Hz modulation affects human physiology; treat as an aesthetic drone, not a Schumann-resonance effect. |
| `breath` (6 bpm pacer) | moderate | moderate, arguably strong for the HRV outcome specifically | HRV evidence for ~6 breaths/min is the strongest single finding in this review; "moderate" holds if the claim stays general ("supports relaxation") rather than a specific clinical outcome. |

## Part 3: Recommendations — top 15 features

Each feature names its inspiration, the evidence-backed parameters (where applicable), Web Audio implementation notes grounded in this app's existing architecture (`AudioEngine.js`, `Generators.js`, `SoundLibrary.js`, the planned `FocusView.js`/`Presets.js`), and whether it is evidence-backed or a user-expectation (UX parity) feature.

| # | Feature | Inspiration | Evidence-backed parameters | Web Audio implementation notes | Tag |
|---|---|---|---|---|---|
| 1 | Single-screen Focus quick-start view: one play button, one session mode picker, a live Hz/band readout, no map required | FlowTunes' one-screen player | — | Already scoped as `FocusView.js`; read `bandForBeat()`/`BANDS` from `SoundLibrary.js` for the live readout, and a `Presets.js` session-mode list, independent of the `CanvasGrid` scene | User-expectation |
| 2 | Every session mode gets a defined intro → sustain → wind-down phase structure, not a flat loop | Endel's Scenarios (initial/middle/end phases keyed to timer length) | Wind-down phase 30–45 min for sleep-tagged modes | A `Timeline.js` journey section per phase, with per-section targets for master gain and a low-pass cutoff, generated procedurally from the chosen duration rather than hand-authored per length | Evidence-backed (wind-down window) + user-expectation |
| 3 | Lightweight adaptive input: a manual "time of day / intent" picker (morning-energize, midday-focus, evening-wind-down) instead of biometric sensing | Endel's context adaptation, scoped down for a browser app with no sensors | Lower stimulating (beta/gamma, bright noise) and raise calming (delta/theta, pink/brown) content in evening presets | A `Presets.js` lookup that biases default generator `params` (binaural `beat`, noise `color`, pad `brightness`) rather than a new audio primitive | User-expectation |
| 4 | Headphone-vs-speaker awareness: prompt to switch binaural beats to isochronic/monaural when headphones aren't obviously in use | Brain.fm and Anima both require headphones for their core technique and say so explicitly | Binaural beats need true stereo separation; isochronic/monaural work on speakers | Browser APIs can't reliably detect headphone presence, so use a one-time inspector prompt ("Binaural beats need headphones — switch to isochronic?"), not silent auto-switching; toggle swaps `gen: 'binaural'` for `gen: 'isochronic'` at the same target beat | User-expectation |
| 5 | Evidence badge + one-line caveat next to every frequency-tool control, using the grades from Part 2 | This app's own `evidence` field, made visible (no competitor is this transparent; Anima is the opposite — confident claims, no caveats) | Grades and one-liners per the calibration table above | Surface `SOUNDS[i].evidence` plus a new short `note` string in the Library card and Inspector Sound tab; keep copy factual ("modest, mixed evidence," not "proven") | Evidence-backed (transparency) |
| 6 | Binaural-beat preset tuned to the best-supported protocol: ~200 Hz carrier, theta/delta target, exposure starting before the session's main phase | Garcia-Argibay et al. 2019 meta-analysis | Carrier 200–240 Hz; g ≈ 0.45 overall, g ≈ 0.69 for theta/delta-anxiety; masking noise not required | Matches existing `SoundLibrary.js` defaults (`carrier: 200`); add a 60–120 s pre-roll before a session's main phase, since pre-task exposure outperforms during-task-only | Evidence-backed |
| 7 | Noise-color presets split by purpose: pink/white for "focus/attention support," brown relabeled "masking/texture" rather than implying equal evidence | Nigg et al. 2024 ADHD meta-analysis; absence of brown-noise trials | White/pink: modest, ADHD-specific evidence; brown: no direct trials | No DSP change — `Generators.js` already implements standard pink (Paul Kellett filter) and brown (leaky integrator); change is `SoundLibrary.js` evidence labels and card copy per the calibration table | Evidence-backed |
| 8 | 6-breaths/min pacer with a visible breathing shape synced to the audio envelope, plus an optional soft bowl strike at each phase change | Resonance-frequency breathing literature; singing-bowl phase-marking | 6 breaths/min default (5.5 s in / 4.5 s out), adjustable 4.5–7.0/min | `Generators.js` already exposes `createBreathBuffer(ctx, bpm, inhale, hold)`; drive the UI animation from the same control buffer via an `AnalyserNode` or shared clock so visual and audio never drift | Evidence-backed |
| 9 | Nature-sound presets and the audition/recommendation surface prioritize water and bird sounds for "restore/destress" journeys | Buxton et al. 2021 PNAS synthesis (water best for positive emotion, birds best for stress/annoyance) | — | Tag `waves`, `rain`, `jungle_river`, `ocean_deep`, `birds`, `tropical_birds`, `jungle_birds` with a `restorative: true` flag (or reuse `category`) to power a "Restore" preset in `Presets.js` | Evidence-backed |
| 10 | A guided "sound bath" timeline preset: ~60 minutes, bowls and gong entering gradually, aimed explicitly at first-time users | Goldsby et al. 2017 (N = 62, single 60-min session, novices benefited most) | 60-minute session length; novice-friendly framing | A `Presets.js` journey using existing `bowl_c..bowl_b`, `gong`, `gong_old` samples with staggered entry times on the keyframe timeline and a slow reverb-send increase (`ReverbSend -> Convolver -> ReverbReturn`) | Evidence-backed |
| 11 | Onboarding "wow" moment: a short guided demo where one spatial sound orbits the listener, inviting a head-turn or canvas drag | Portal's head-tracked spatial demo as first-run hook | HRTF spatialization measurably raises reported immersion vs. non-spatial playback | Already have the pieces: `Panner(HRTF)` in the graph and `HeadTracker.js` for device orientation; script a one-off auto-orbit for first-run only, not persistent | User-expectation (moderate immersion evidence) |
| 12 | 40 Hz gamma tools kept clearly framed as "unproven for general wellness," never implying Alzheimer's-relevant benefit from an audio-only listen | Iaccarino/Tsai and Cognito Therapeutics trials use combined light+sound, sustained daily, in a diagnosed clinical population | — | No graph change — a copy/labeling constraint on `bw_gamma`/`iso_gamma` cards and marketing text; keep `evidence: 'weak'` and avoid "Alzheimer's" or "clinical" near these controls | Evidence-backed (cautionary) |
| 13 | Live "now playing" frequency/band readout (e.g., "10 Hz · Alpha · relaxed focus") wherever a frequency tool is active | Anima's Hz/band labeling, minus the unsupported claims | Band boundaries per `BANDS` (delta 0.5–4, theta 4–8, alpha 8–13, beta 13–30, gamma 30–100) | Reuse `bandForBeat(hz)`, already implemented; render it in the Focus view (item 1) and Inspector Sound tab consistently | User-expectation (supports item 5) |
| 14 | Session-length presets on attention cycles (25 min Pomodoro-style, 50 min "deep work," 90 min ultradian) with automatic gentle fade instead of a hard stop | Endel's Focus Timer / Noisli's timer-with-fade | — | `Timer.js` (planned): on completion, ramp master `Gain` to 0 over 5–15 s via `setTargetAtTime` rather than stopping nodes abruptly; optionally chain into item 2's wind-down phase if time remains | User-expectation |
| 15 | Optional pre-sleep "brightness taper": a sleep-tagged session automatically shifts generators toward calmer parameters (lower beat frequency, pad `brightness` down, noise toward pink/brown) instead of relying on the user's initial picks | Circadian/sleep-hygiene wind-down principle; Endel's "low period" behavior for Focus content | Taper over the last 30–45 minutes of a sleep-tagged session | Same keyframe/automation system as item 2, but targeting generator `params` through each generator's existing `setParam(key, value)` handle, not just master gain/filter | Evidence-backed (wind-down) + user-expectation |

## Sources

Endel:
- [Endel - Endel Soundscapes](https://endel.io/soundscapes)
- [Endel App Review: Features, Pricing & My Experience](https://www.autonomous.ai/ourblog/endel-app-review)
- [Endel — The science of sound and music](https://endel.io/science)
- [Endel — Find your focus](https://endel.io/focus)
- [The Science behind Focus – Endel](https://endel.io/blog/the-science-behind-focus)
- [App Showcase: Endel](https://screensdesign.com/showcase/endel-focus-sleep-sounds)
- [Endel: Focus, Sleep, Relax - Uibrary](https://uibrary.design/apps/endel-focus-sleep-relax/)
- [Endel - Google Play](https://play.google.com/store/apps/details?id=com.endel.endel&hl=en_US)
- [Endel - Fall sound asleep](https://endel.io/sleep?campaignId=winddown_pr)

Brain.fm:
- [Brain.fm - Music to Focus Better](https://www.brain.fm/)
- [Brain.fm - Our science](https://www.brain.fm/science)
- [Beta Waves & Brain.fm](https://www.brain.fm/blog/beta-waves-brain-fm-engineering-focus)
- [Background Music, Amplitude Modulation Improves Focus for ADHD Brains](https://www.additudemag.com/background-music-amplitude-modulation-adhd-study/)
- [Music Boosts Focus by Syncing With Brain Rhythms](https://www.technologynetworks.com/neuroscience/news/tailored-music-may-be-your-best-tool-for-staying-on-task-395035)
- [Brown Noise for Focus](https://www.brain.fm/blog/brown-noise-for-focus)
- [Brown Noise, White Noise, Pink Noise for ADHD Focus](https://www.brain.fm/blog/brown-noise-adhd-white-noise-pink-noise-focus)
- [Binaural Beats vs. Monaural Beats vs. Isochronic Tones](https://www.brain.fm/blog/binaural-beats-vs-monaural-beats-vs-isochronic-tones)
- [Rapid modulation in music supports attention (Communications Biology, 2024)](https://www.nature.com/articles/s42003-024-07026-3)

FlowTunes:
- [FlowTunes - Music for focus (App Store)](https://apps.apple.com/us/app/flowtunes-music-for-focus/id6502615308)
- [FlowTunes | AppleVis](https://www.applevis.com/apps/ios/productivity/flowtunes)
- [FlowTunes Review - DeClom](https://declom.com/flowtunes)
- [FlowTunes - Toolify](https://www.toolify.ai/tool/flowtunes)

myNoise:
- [About myNoise.net (FAQ)](https://mynoise.net/faq.php)
- [myNoise Pricing, Features, and Reviews](https://www.softwaresuggest.com/mynoise)
- [myNoise - Google Play](https://play.google.com/store/apps/details?id=com.mynoise.mynoise&hl=en_US)
- [myNoise.net Donation Page](https://mynoise.net/donate.php)

Noisli:
- [Noisli](https://www.noisli.com/)
- [How it Works | Noisli](https://www.noisli.com/how-it-works)
- [Plans & Pricing | Noisli](https://www.noisli.com/pricing)
- [How much does Noisli cost? – Noisli Support](https://support.noisli.com/how-much-does-noisli-cost/)
- [Features | Noisli](https://www.noisli.com/features)

Portal:
- [Portal - An Immersive Spatial Audio App](https://portal.app/)
- [Portal is a chilled out spatial audio app - iMore](https://www.imore.com/apps/portal-is-a-chilled-out-spatial-audio-iphone-ipad-and-mac-soundscape-app-to-help-you-focus)
- [Hands-on: Portal - 9to5Mac](https://9to5mac.com/2021/10/23/focus-sleep-escape-spatial-audio-app-portal/)
- [Dynamic Spatial Audio - Portal](https://portal.app/collections/spatial-audio-ready)
- [Slo vs Portal](https://slonoise.com/resources/slo-vs-portal/)

Calm:
- [Calm App Pricing 2026 - CarePaths](https://carepaths.com/calm-app-pricing/)
- [Calm App Review 2026 - peacefullyproven](https://peacefullyproven.com/calm-app-review-sleep-stories-soundscapes-and-serenity/)
- [Calm App Review 2026 - Simply Psychology](https://www.simplypsychology.com/articles/calm-app-review-2026)

Headspace:
- [Headspace Review 2026 - CarePaths](https://carepaths.com/headspace-review/)
- [Focus Audio & Concentration Music Library - Headspace](https://www.headspace.com/content/categories/focus)
- [Headspace Pricing 2026 - Lifestack](https://lifestack.ai/blog/headspace-pricing)

Anima:
- [Anima: Binaural Beats - App Store](https://apps.apple.com/us/app/anima-binaural-beats/id6753141187)
- [Anima: Binaural Beats - MWM](https://mwm.ai/apps/anima-binaural-beats/6753141187)
- [Anima: Binaural Beats - Google Play](https://play.google.com/store/apps/details?id=com.megaelimited.anima&hl=en_US)

Evidence base:
- [Garcia-Argibay, Santed & Reales (2019), Psychological Research 83:357-372](https://link.springer.com/article/10.1007/s00426-018-1066-8)
- [Ingendoh, Posny & Heine (2023), PLOS ONE 18(5):e0286023](https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0286023)
- [Effects of binaural beats and isochronic tones on brain wave modulation: literature review](https://www.scielo.org.mx/scielo.php?script=sci_arttext&pid=S1665-50442021000600238)
- [Isochronic tones - Wikipedia](https://en.wikipedia.org/wiki/Isochronic_tones)
- [The Impact of Monaural Beat Stimulation on Anxiety and Cognition (PMC)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5430051/)
- [Pink Noise for Sleep - Sleep Foundation](https://www.sleepfoundation.org/noise-and-sleep/pink-noise-sleep)
- [Nigg, Bruton, Kozlowski, Johnstone & Karalunas (2024), J. Am. Acad. Child Adolesc. Psychiatry](https://pubmed.ncbi.nlm.nih.gov/38428577/)
- [Brown Noise for ADHD: TikTok Trend - ADDitude](https://www.additudemag.com/brown-noise-adhd-tiktok-trend-improve-focus/)
- [Iaccarino et al., Multi-sensory Gamma Stimulation (Cell, 2019)](https://www.cell.com/cell/fulltext/S0092-8674(19)30163-1)
- [Gamma Frequency Sensory Stimulation clinical trial (medRxiv)](https://www.medrxiv.org/content/10.1101/2021.03.01.21252717v3.full)
- [Cognito Therapeutics completes enrollment in HOPE study](https://www.medicaleconomics.com/view/cognito-therapeutics-completes-enrollment-in-landmark-alzheimer-s-trial)
- [Study suggests 40Hz sensory stimulation may benefit some Alzheimer's patients for years - MIT News](https://news.mit.edu/2025/study-suggests-40hz-sensory-stimulation-may-benefit-some-alzheimers-patients-1114)
- [432 Hz vs 443 Hz cardiovascular parameters RCT (PMC)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11755923/)
- [432 Hz vs 440 Hz: The Tuning Debate - Sonora](https://sonora.com/learn/solfeggio-frequencies/432-hz-vs-440-hz)
- [Buxton et al. (2021), PNAS 118(14):e2013097118](https://www.pnas.org/doi/10.1073/pnas.2013097118)
- [Van Hedger et al. (2019), Cognitive Science](https://onlinelibrary.wiley.com/doi/10.1111/cogs.12734)
- [Nature sounds improve focus more than urban sounds - cogbites](https://cogbites.org/2019/05/06/nature-sounds-improve-focus/)
- [Goldsby, Goldsby, McWalters & Mills (2017), J. Evidence-Based Complementary & Alternative Medicine](https://journals.sagepub.com/doi/full/10.1177/2156587216668109)
- [Goldsby et al. 2017 - PubMed](https://pubmed.ncbi.nlm.nih.gov/27694559/)
- [On the Relative Importance of Visual and Spatial Audio Rendering on VR Immersion - Frontiers](https://www.frontiersin.org/journals/signal-processing/articles/10.3389/frsip.2022.904866/full)
- [Wrapped into sound: Immersive Music Experience Inventory (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC9524455/)
- [The Impact of Resonance Frequency Breathing on HRV, Blood Pressure, and Mood (PMC)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5575449/)
- [Resonance frequency versus fixed 0.1 Hz breathing in HRV biofeedback (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC13381940/)
