# AirPods, spatial audio and head tracking on the web

Survey date: 15 September 2026. The question that started this: can the app use
Apple's spatial audio and the head tracking built into AirPods?

The answer is no on both counts, and both noes are structural rather than
missing features. That sounds like a dead end and is not one. Looking for the
door led to a measurement of what the browser's own binaural renderer actually
does, which turned up a real defect in this app and three places in the shipped
content that cannot sound the way they are drawn.

Everything in section 3 was measured here, in Chrome 152 on macOS, with
`OfflineAudioContext`. Everything else is sourced. Where a claim could not be
confirmed it is listed in section 7 rather than softened in place.

---

## 1. AirPods head tracking cannot reach a web page

Not on any browser, on any platform, today.

**The orientation spec is about the host device and says so.** W3C Device
Orientation and Motion (Candidate Recommendation Draft, 12 February 2025) scopes
itself to the orientation and motion of the hosting device, and defines its
coordinate frame relative to that device's own screen. Headphones, earbuds and
accessories appear nowhere in the document. This is the contract, not a gap in
it.

**The W3C considered headphone motion once and the thread went quiet.**
`w3c/orientation-sensor` issue 68, "Head orientation tracking", opened
**2020-10-01** by Anssi Kostiainen, co-chair of the Devices and Sensors Working
Group, citing Apple's `CMHeadphoneMotionManager` and naming spatial audio as the
use case. Verified through the GitHub API on 15 September 2026: **state open, 10
comments, last activity 2021-12-03**. No labels, no linked pull request, no spec
text. Nearly five years dormant.

Two comments from that day are the implementers talking, and both point the same
way:

- `reillyeon` (Reilly Grant, Chromium): his instinct is that spatial audio
  should be handled by Web Audio and the media APIs, so that the browser and
  the operating system integrate the IMU on the page's behalf. That is the
  platform position. The page is not supposed to see the sensor.
- `hoch` (Hongchan Choi, Chrome Web Audio): points at Web Audio's
  `AudioListener` and notes he had hooked VR headsets up to it successfully.
  Which is exactly what this app already does, with a phone instead of a
  headset.

**WebKit is formally opposed to the whole sensor family.** Its
standards-positions record an **oppose** on the Generic Sensor set (Gyroscope,
Accelerometer, Magnetometer, Orientation, Motion), on Web Bluetooth and on
Geolocation Sensor, with device independence and privacy among the stated
concerns. Even if issue 68 revived, Safari is on record against the vehicle that
would carry it.

**Two negatives worth proving rather than assuming.** A WebKit Bugzilla search
for "headphone motion" returns zero bugs. A code search of `WebKit/WebKit` for
`CMHeadphoneMotionManager` returns exactly one hit, and it is
`WebKitLibraries/SDKDBs/iphoneos/CoreMotion.partial.sdkdb`, a generated symbol
database used for availability checking, not a call site. Chromium returns zero.
No engine touches the API.

**What Apple's own API is.** `CMHeadphoneMotionManager` is iOS 14+, iPadOS 14+,
macOS 14+ (Sonoma; before that a Mac could not read AirPods motion at all) and
watchOS 7+. Native only. It delivers a fused attitude quaternion, requires
`NSMotionUsageDescription`, and in practice runs at about **25 Hz, three degrees
of freedom, with yaw drift** that needs a manual calibration gesture. Supported
hardware per Apple's consumer page: AirPods 3, 4 and 5, AirPods Pro, AirPods
Max; the community samples add Beats Fit Pro.

**Bridges exist and none of them is a web app.** Headitude (macOS, MIT) reads
AirPods orientation and forwards it over OSC. `airtracker` pipes it over UDP at
about 25 Hz and states outright that only macOS can read these sensors.
`NativeWebKit.js` exposes a headphone motion manager to a page, but only through
`webkit.messageHandlers`, meaning a companion Swift app plus a Safari extension.
In every case the thing reading the sensor is a native application the user must
install. That is a native app with a web interface, not a web app.

**One genuine loophole, which does not help.** Sony's spatial headphones expose
their IMU through Google's Android Head Tracker HID protocol on usage page
`0x20`. The WICG WebHID blocklist does not block that usage page, so a Chromium
page could in principle read a paired Sony headset through `navigator.hid`.
Nobody appears to have built it, it never applies to AirPods, and WebHID does not
exist in Safari.

**WebXR is not a way in either.** Its pose comes from the headset, inside an
active immersive session. On visionOS that is the Vision Pro's own tracking, not
the AirPods'.

**`navigator.audioSession` is not what the name suggests.** Safari 16.4+ only. It
sets a session type (playback, ambient, transient and so on) and governs ducking
and interruption. The specification mentions neither spatial audio, nor head
tracking, nor channel counts, nor routing.

**A home-screen web app grants nothing extra.** It is the same WebKit with the
browser chrome hidden.

---

## 2. Apple's spatializer cannot be fed from Web Audio, and would fight us if it could

**Two hardware channels is the ceiling, and the destination enforces it.**
Measured here today in Chrome 152 on macOS:

```
maxChannelCount: 2
destination.channelCount = 6  ->  IndexSizeError:
  "The channel count provided (6) is outside the range [1, 2]."
```

That number is not arbitrary. Both engines derive it from the actual output
route: WebKit from `AVAudioSession maximumOutputNumberOfChannels` on iOS and from
the CoreAudio stream configuration on macOS, Chrome through its platform audio
manager. AirPods connect over Bluetooth A2DP as a two-channel device, so two is
the correct answer.

**Apple's spatial audio is a media-pipeline feature.** Its WWDC21 session
"Immerse your app in Spatial Audio" is explicit: an application gets
spatialisation by publishing **multichannel** audio through AVFoundation, with no
code change. For the web it names `AVPlayerItem`, `AVSampleBufferAudioRenderer`
and limited WebKit support for Media Source Extensions, and says the MSE path
offers no interface to steer the spatialisation. Web Audio is not on that list.
The code agrees: WebKit's Web Audio output is `AudioDestinationCocoa`, a raw
AudioUnit render path, structurally the same class of thing as Chromium's
`AUHALStream`, and not the AVFoundation path the spatializer hooks into.

Apple's own documentation for `AVAudioSessionPortDescription.isSpatialAudioEnabled`
describes the case exactly: a port with a small number of hardware channels,
typically two, that nonetheless has enhanced capabilities for multichannel
content. The entry ticket is delivering multichannel through AVFoundation, and a
web page has no way to do that.

**Spatialize Stereo is a risk to this app, not an opportunity.** The Control
Centre toggle up-mixes stereo to a virtual 5.1 and spatialises it. It is held per
application. If a listener turns it on while this app is rendering its own
binaural scene, Apple's spatializer runs **on top of** our mix and anchors the
stage to the phone or Mac instead of to the scene. That is worse than either
alone: two head-related renderings in series, fighting over the same cue. There
is no web API to detect it and none to opt out. The only mitigation available is
saying so in the app's own text.

**Chrome is building the AVFoundation path, and it changes nothing here.**
`media/audio/mac/avfoundation_output_stream.h` exists in Chromium main, gated to
macOS 27, and its comment says plainly that the point is to carry multichannel
input and let AirPods' spatial audio mode apply. It is
`FEATURE_DISABLED_BY_DEFAULT`, it needs multichannel content to be worth
anything, and the listener rather than the page picks off, fixed or head-tracked.
The direction of travel is that browsers will let the operating system spatialise
multichannel **media playback**. It is not that pages will get head-tracking data.

**`setSinkId` is unrelated.** It chooses which device receives audio. It does not
change channel count, does not enable spatialisation, and on an `AudioContext` it
does not exist in Safari at all.

---

## 3. What the browser's binaural renderer actually is, measured

Both engines ship the same data, which corrects a claim that gets repeated a lot.
WebKit builds its database from the subject named "Composite" and names its
resources `IRC_Composite_C_R0195_T<azimuth>_P<elevation>`; Chromium uses the same
constants. All three major engines now ship the same IRCAM LISTEN derived set, so
"other browsers sound different" is out of date.

What the constants say it is: one averaged, diffuse-field equalised subject, 240
responses on a 15 degree grid in both axes, elevation limited to **-45 to +90**,
256-sample impulse responses at 44.1 kHz, measured at a radius of **1.95 m**.

Four things follow from that. All four were measured here rather than inferred,
with a fixed mono noise source, constant radius, `OfflineAudioContext` at 44.1
kHz, comparing rendered buffers sample by sample.

| Measurement | Result |
|---|---|
| Azimuth 7.5 degrees against 0 and against 15 | differs from both (max sample difference 0.382 and 0.388). **Azimuth is interpolated.** |
| Elevation 7.5 degrees against 0 | **bit-identical**, max sample difference exactly 0; against 15 degrees it differs. **Elevation is not interpolated, it snaps to the 15 degree grid.** |
| Elevation -50, -60, -75, -90 against -45 | **all four bit-identical to -45**, max sample difference exactly 0. **There is no HRTF below -45 degrees.** |
| Interaural level difference at 3 m, 1 m and 0.2 m, same direction | **11.193 dB at all three**, identical to three decimals. Level rises 10.63 dB at 0.2 m. **Distance is a gain law only.** |

Read plainly: moving a sound sideways is smooth, moving it up and down is a
staircase, moving it below the listener stops working entirely past 45 degrees,
and bringing it to your ear only makes it louder, not closer.

### What that means for this app right now

The field lets a source sit anywhere from -10 to +10 in height, so the floor is
easy to cross. Three places in the shipped content already do:

| Where | Geometry | Elevation |
|---|---|---|
| `jo_under`, Underwater in the deep ocean journey | radius 3.5, height -1 falling to -4 | -15.9 to **-48.8 degrees** |
| `jo_whales`, Whales in the same journey | radius 9 to 5, height -2 to -5 | -12.5 to **-45.0 degrees** |
| `set_deep_ambient`, Underwater in the Deep sound set | directly beneath the listener at (0, 0, -1) | **-90 degrees** |

The Underwater layer of the deep ocean journey descends past the floor partway
through and the last part of that descent is inaudible as movement. The Deep set
places a sound directly under the listener, which the browser renders as if it
were 45 degrees below and in front.

Both were moved rather than left to mislead: the Underwater arc was widened from
3.5 m to 4.5 m, which keeps the same depth and the same descent at -41.6 degrees,
and the Deep set's Underwater bed was given a horizontal offset. Keyframes are not
the whole story, since positions are interpolated linearly in Cartesian
coordinates between them and a chord can cut inside the arc, so every intermediate
point was swept too: the steepest across all nine journeys is now **-44.9
degrees**, on the whale arc, just inside the floor. Three tests in
`src/data/Presets.test.js` keep it there.

This is not fatal, because the app adds its own continuous elevation cue: the
shoulder and pinna filters in `_buildSpatialChain` move with `sin(elevation)`
across the full range, so -90 degrees is still filtered differently from -45.
Only the HRTF component is clamped. But the drawing promises more than the
rendering delivers, and that gap should be closed by moving the content, not by
pretending.

### The defect this found

The same reading turned up something worse, and it is fixed as of commit
`4024b0d`. IRCAM's Carpentier notes that a `PannerNode` in HRTF mode handles a
stereo input by applying the left response to the left input and the right
response to the right, and calls the interpretation of that doubtful. Measured
here: a stereo buffer placed 3 m to the right rendered at **-0.9 dB** right minus
left, meaning slightly left of centre, which is to say not placed at all. Summed
to mono first, the same source renders at **+11.2 dB**. Three bundled buffers are
stereo: `gong`, `wind-chimes` and `singing-bowl`, the load-bearing sounds of the
sound bath and meditation journeys. The panner now takes one channel explicitly.

---

## 4. What everyone else on the web actually does

The short version: almost everyone uses the plain HRTF `PannerNode`, the
ambisonic libraries are dead or frozen, and nobody sources head tracking from
headphones.

**Plain `PannerNode`, `panningModel = 'HRTF'`** is the most deployed spatial
audio path on the web. three.js `PositionalAudio` sets it explicitly, overriding
the Web Audio default of equal power, at 12.2 million downloads a week.
A-Frame's `<a-sound>` is a thin wrapper over it. `geospatial-audio-js` (MIT,
pushed 2026-09-13) is the closest architectural peer to this app: HRTF panners
plus listener orientation synced to map rotation, with reverb, Doppler and
distance culling.

**Ambisonics in the browser is a graveyard with two survivors.**

| Library | Last real code | Status |
|---|---|---|
| Omnitone (Google) | 2019-01-16 | Frozen seven years. Every recent "push" is an unmerged Dependabot branch. Still the dependency inside Bitmovin, videojs-vr and Brightcove. |
| Resonance Audio Web SDK (Google) | 2018-04-26 | Archived. |
| JSAmbisonics (`ambisonics`) | 2022-05-03 | Dormant, but see below: it is what Vimeo ships. |
| binauralFIR (IRCAM) | 2017-03-06 | Dead. Still the canonical custom-HRIR pattern. |
| serveSofaHrir (IRCAM) | 2022-06-21 | Abandoned. Its README still promises a public HRTF server for 2016. |

There is **no maintained JavaScript library in 2026 that loads SOFA format HRTF
files**. No `sofa-hrtf`, no `@ircam/binaural`, nothing in the active `ircam-ismm`
scope.

**The two alive ones are worth knowing.** HOAST360 (IEM Graz, commits
2026-09-02) decodes up to fourth-order ambisonics to binaural in the browser with
acoustic zoom, using its own filter set rather than Omnitone.
`three-steam-audio` (Apache-2.0, pushed 2026-08-10) is Valve's Steam Audio
compiled to WebAssembly, with binaural mode, HRTF normalisation and raycast
occlusion. It is the one credible turnkey alternative to `PannerNode`.

**The big players, checked at source:**

- **Vimeo does binauralise ambisonics in the browser**, and with JSAmbisonics
  rather than Omnitone: its player bundle constructs `sceneMirror`,
  `sceneRotator` and `binDecoder`, lazily loaded, driven by the player's own
  camera yaw, pitch and roll. On Chromium it discards any Opus track above first
  order.
- **YouTube's web player has no Web Audio binaural decoder.** It still serves
  four-channel and six-channel ambisonic Opus (itag 338, confirmed today on two
  test uploads), and has IAMF wiring behind experiment flags, but the 2.6 MB
  player bundle contains zero occurrences of `hrtf`, `binaural`, `Convolver`,
  `PannerNode` or `omnitone`. That matches independent testing from August 2026
  reporting that desktop head tracking fails outright.
- **Meta's Audio360**, which did ship an asm.js binaural engine as a Web Audio
  node, **ended support on 16 May 2022**.
- **Streaming services do not do this in a browser at all.** Apple Music,
  Tidal and Amazon Music all restrict spatial formats to their native apps.
  Tidal removed 360 Reality Audio from every app on 24 July 2024.

**Head tracking sources actually in use**: WebXR headset pose, phone
`DeviceOrientation`, webcam face tracking, or the player's own viewport. Not one
uses headphones without a native helper. The live webcam route is MediaPipe
FaceLandmarker with `outputFacialTransformationMatrixes`, as Mach1's player does,
with a 1 Euro filter on top.

### The commercial products, checked at code level

Worth knowing who actually does binaural work, because the answer is almost
nobody, and the two that did it properly are both gone as services.

| Product | What it really does | Status |
|---|---|---|
| **Mozilla Hubs** | `PannerNode` with `panningModel: 'HRTF'` as the default, inverse distance, directional cones, per-zone overrides | Service shut down **2024-05-31**. Alive as self-hosted open source under the Hubs Foundation, last push 2026-08-23 |
| **High Fidelity** | Server-side mixer, proprietary HRTF claimed under 5 ms, one spatialised stereo stream returned over WebRTC | The self-serve API backend is **gone**: `api.highfidelity.com` is NXDOMAIN. The company is not; it licenses a native C++ spatializer |
| **Gather** | Distance to volume. **Zero occurrences of `HRTF` in the entire web client.** The only `createPanner` code is Phaser 3's, for map sound effects | Live |
| **Kumospace** | Sets `HTMLMediaElement.volume` on one `<audio>` element per participant. A mono scalar that cannot pan | Live |
| **SpatialChat** | The inverse distance law computed by hand in JavaScript and applied as a scalar gain. No panner of any kind in the voice path | Live |
| **Mach1** | Amplitude-only vector panning over a virtual speaker cube, deliberately no HRTF convolution and no filters. WebAssembly build, four head-tracking inputs | Live and actively developed, `libmach1spatial` v4.0 |
| **Dolby.io Communications** | Server-side mixer, positions sent from the client | Wound down around **August 2024**; about 30 SDK repos archived on 2024-08-30 |

So every live commercial proximity-audio product that could be inspected does
distance-to-gain attenuation on a mono stream. Where `HRTF` appears in their
bundles at all, it traces to Phaser or Howler defaults for map sound effects.
This app is doing more than they are, not less.

**One idea worth taking from Hubs.** Its audio settings were a user preference,
not a constant: `audioPanningQuality` chose between `HRTF` and `equalpower` for
listeners on weak hardware, and a separate `disableLeftRightPanning` switched to
plain gain entirely. The second is an accessibility setting, for listeners with
single-sided hearing or a processing sensitivity, for whom a moving stereo image
is not a feature. Both are missing here and both are cheap. Recorded as a
follow-up, not done.

**A number worth keeping.** BBC R&D (Pike, Taylour and Melchior, Web Audio
Conference 2015) cite Lindau's threshold of **under 53 ms** end-to-end
head-tracking latency, below which experienced listeners stop noticing the delay.
AirPods' 25 Hz update rate spends 40 ms of that budget before anything else
happens. The phone sensor this app already uses runs at about 60 Hz. AirPods
track the head and the phone tracks the phone, and that, not accuracy, is the
whole of the difference.

---

## 5. The distinction that keeps getting conflated

**Apple Spatial Audio** is an operating system renderer. An application hands the
system a multichannel programme through AVFoundation; macOS or iOS folds it to
two channels with Apple's HRTF and optionally rotates the field against the
AirPods IMU. The application does not compute the mix and cannot inspect or steer
it. The listener picks off, fixed or head-tracked. On the web this reaches only
`<video>`, `<audio>` and MSE playback of multichannel content.

**This app doing its own binaural rendering** means computing the two-channel
mix in Web Audio, with its own scene, its own listener pose and its own tracking.
The operating system sees ordinary stereo, and leaves it alone as long as the
listener has not switched Spatialize Stereo on for that application. That switch
is the one thing that breaks the arrangement, and it belongs to the listener,
not to the page.

**They do not compose.** Run both and Apple's head-tracked spatializer sits on
top of an already binaural mix, anchored to the device rather than to the scene.
For an app like this one, Apple's spatial audio is something to avoid
triggering, not something to acquire.

The recurring forum question of why spatial audio appears for Safari but not for
Chrome is entirely about which output path each browser uses for media playback.
It has never had anything to do with Web Audio or with pages reading head
orientation.

---

## 6. Options, ranked

**1. Keep the `PannerNode` and fix what is cheap.** Guarantee mono into every
panner (done, `4024b0d`). Move the three below-floor sources in section 3 above
-45 degrees, or accept and document that the last part of that descent is carried
by the shoulder and pinna filters alone. Add near-field compensation below about
1 m, since the measurement above shows the renderer contributes nothing there but
level. Keep source motion smooth so the renderer's 45 ms kernel crossfade does
not become an audible zipper. Cost: no new dependencies, no licence questions,
and the best CPU profile of any binaural option.

**2. Custom HRTF through `ConvolverNode` with a measured set.** This is the real
quality ceiling lift, and the licensing is better than expected: **SADIE II
(University of York) is Apache 2.0**, latest release v2-2 of 18 June 2024, 20
subjects including the KU100 and KEMAR dummy heads, shipped as both WAV and AES69
SOFA. ARI is CC BY-SA 3.0. CIPIC is academic use only and should be avoided in a
product. The honest cost: there is no maintained library to do this, so it means
rebuilding the binauralFIR pattern by hand, two convolvers per source crossfaded
on movement, a delay line for interaural time difference, and an AES69 parser
written from scratch. Real engineering work, and a meaningfully higher CPU cost
that scales with source count.

**3. Improve the phone tracking instead of replacing it.** On several axes it is
already better than AirPods: 60 Hz against 25 Hz, same three degrees of freedom,
same yaw drift. Worth adding: a 1 Euro filter, an explicit "face forward, tap to
centre" recalibration, a dead zone, and a latency budget held under 53 ms.
Highest value per hour of the five.

**4. Higher-order ambisonics.** Only if the scene shape demands it. It buys one
rotatable sound field, so head rotation becomes a single matrix operation instead
of re-panning every source, with a CPU cost independent of source count. That
wins above roughly 20 to 30 simultaneous sources. This app has nothing like that
many. Omnitone and Resonance are not viable dependencies in 2026; Steam Audio is
the stronger engine if this is ever wanted.

**5. A native app or wrapper.** The only thing that unlocks AirPods tracking, and
what it unlocks is 25 Hz head-locked tracking in place of 60 Hz phone-locked
tracking. It costs App Store distribution and review, two codebases or a wrapper,
per-user install friction, and the "just open a link" property that is the point
of a web app. Not worth it unless head-versus-phone independence becomes central
to the product.

---

## 7. What could not be confirmed

Stated rather than guessed:

1. Whether Safari's **Web Audio** output specifically, as opposed to its media
   elements, is caught by the Spatialize Stereo toggle. The WWDC21 text and
   WebKit's AudioUnit-based Web Audio path both suggest not, but no authoritative
   statement was found either way. This is the one open question that would
   change section 2's advice.
2. Whether Blink maps `new AudioContext({latencyHint:'playback'})` all the way to
   `AudioLatency::Type::kPlayback`, the gate on Chrome's new AVFoundation path.
   Moot while the feature is disabled by default.
3. Whether `maxChannelCount` would rise above 2 with that flag enabled on
   macOS 27.
4. Whether WebKit's Media Capabilities implementation performs a meaningful
   `spatialRendering` check or merely accepts the member. Chrome demonstrably
   ignores it: a query with `spatialRendering: true` returned supported on a
   machine that does not spatialise.
5. Whether YouTube's web player ever used Omnitone. Omnitone's announcement names
   the Android app, never the web player.
6. Whether Google's Eclipsa Audio covers 360 video at all.
7. Whether Gather's desktop application, whose audio pipeline is native C++
   inside a custom Electron build, does something other than distance-to-gain.
   Only the web client could be inspected, and that one has no HRTF at all.
8. Which HRTF dataset High Fidelity's and Dolby's server-side mixers used. Both
   are described only as in-house.
9. Whether an official shutdown notice for High Fidelity's spatial audio API
   exists. None was found; the service appears to have been discontinued
   quietly.

Neither of the two central answers rests on an unconfirmed item. No web API
exposes headphone head orientation on any browser or platform, and no web page
can hand Apple a spatialisable stream from Web Audio. Both are confirmed from
specification text, browser engine source and Apple's own documentation.

---

## Sources

**Specifications**
[W3C Device Orientation and Motion, CR Draft 2025-02-12](https://www.w3.org/TR/orientation-event/) ·
[W3C Audio Session API](https://w3c.github.io/audio-session/) ·
[W3C Media Capabilities](https://w3c.github.io/media-capabilities/) ·
[w3c/orientation-sensor issue 68](https://github.com/w3c/orientation-sensor/issues/68) ·
[WICG WebHID blocklist](https://github.com/WICG/webhid/blob/main/blocklist.txt)

**Browser engines**
[WebKit standards-positions 347, Generic Sensor, oppose](https://github.com/WebKit/standards-positions/issues/347) ·
[WebKit standards-positions 53, AudioContext.setSinkId](https://github.com/WebKit/standards-positions/issues/53) ·
WebKit source: `platform/audio/HRTFDatabase.cpp`, `HRTFElevation.cpp`,
`cocoa/AudioDestinationCocoa.cpp`, `ios/AudioSessionIOS.mm`, `mac/AudioSessionMac.mm` ·
Chromium source: `media/audio/mac/avfoundation_output_stream.h`,
`media/audio/mac/audio_manager_mac.cc`, `media/audio/audio_features.cc`,
`third_party/blink/renderer/platform/audio/hrtf_database.cc`

**Apple**
[CMHeadphoneMotionManager](https://developer.apple.com/documentation/coremotion/cmheadphonemotionmanager) ·
[AVAudioSessionPortDescription.isSpatialAudioEnabled](https://developer.apple.com/documentation/avfaudio/avaudiosessionportdescription/isspatialaudioenabled) ·
[WWDC21, Immerse your app in Spatial Audio](https://developer.apple.com/videos/play/wwdc2021/10265/) ·
[Control Spatial Audio and head tracking on AirPods](https://support.apple.com/en-us/HT211775)

**Academic**
Carpentier, [Binaural Synthesis with the Web Audio API, WAC 2015](https://wac.ircam.fr/pdf/demo/wac15_submission_16.pdf) ·
Weitnauer, [Overview and Status of Binaural Rendering in Browsers, DAGA 2018](https://pub.dega-akustik.de/DAGA_2018/data/articles/000024.pdf) ·
Pike, Taylour and Melchior, [WAC 2015, head-tracking latency](https://wac.ircam.fr/pdf/wac15_submission_24.pdf) ·
[SADIE II database, Apache 2.0](https://www.york.ac.uk/sadie-project/database.html) ·
[ARI HRTF database](https://projects.ari.oeaw.ac.at/research/experimental_audiology/hrtf/database/hrtfBtEARI.html)

**Projects**
[three.js PositionalAudio](https://github.com/mrdoob/three.js/blob/dev/src/audio/PositionalAudio.js) ·
[geospatial-audio-js](https://github.com/hshntmk/geospatial-audio-js) ·
[three-steam-audio](https://github.com/kwaa/three-steam-audio) ·
[HOAST360](https://github.com/thomasdeppisch/hoast360) ·
[JSAmbisonics](https://github.com/polarch/JSAmbisonics) ·
[Omnitone](https://github.com/GoogleChrome/omnitone) ·
[Mach1 web player](https://github.com/Mach1Studios/m1-web-spatialaudioplayer) ·
[Headitude, AirPods to OSC](https://github.com/DanielRudrich/Headitude) ·
[facebookarchive/facebook-360-spatial-workstation](https://github.com/facebookarchive/facebook-360-spatial-workstation) ·
[Hubs, audio-params.ts](https://github.com/Hubs-Foundation/hubs/blob/master/src/components/audio-params.ts) ·
[Mozilla support, end of support for Mozilla Hubs](https://support.mozilla.org/en-US/kb/end-support-mozilla-hubs) ·
[hifi-spatial-audio-js](https://github.com/highfidelity/hifi-spatial-audio-js) ·
[Gather, Behind the fix: audio, 2026-06-10](https://www.gather.town/blog/behind-the-fix-audio-2026)
