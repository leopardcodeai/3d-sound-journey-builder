import { describe, it, expect, vi } from 'vitest';
import { SpatialAudioEngine } from './AudioEngine.js';

/**
 * Where the listener faces, per posture, expressed in the app's own world
 * terms: x to the right of the map, y towards the top of the map, z up.
 * Web Audio takes (x, z, -y), so everything read back has to come home again.
 */
function poseOf(posture, tilt = 0, turn = 0) {
  const set = [];
  const param = () => ({ value: 0, setValueAtTime(v) { this.value = v; } });
  const listener = {
    forwardX: param(), forwardY: param(), forwardZ: param(),
    upX: param(), upY: param(), upZ: param(),
  };
  const engine = new SpatialAudioEngine();
  engine.isInitialized = true;
  engine.ctx = { currentTime: 0, listener };
  engine.updateListenerPose(posture, tilt, turn);

  const web = (a, b, c) => [a.value, b.value, c.value];
  const toWorld = ([x, y, z]) => [x, -z, y];
  const f = toWorld(web(listener.forwardX, listener.forwardY, listener.forwardZ));
  const u = toWorld(web(listener.upX, listener.upY, listener.upZ));
  const right = [
    f[1] * u[2] - f[2] * u[1],
    f[2] * u[0] - f[0] * u[2],
    f[0] * u[1] - f[1] * u[0],
  ];
  const dot = f[0] * u[0] + f[1] * u[1] + f[2] * u[2];
  const where = (v) => {
    const [x, y, z] = v.map(n => +n.toFixed(6));
    const m = Math.max(Math.abs(x), Math.abs(y), Math.abs(z));
    if (Math.abs(y) === m) return y > 0 ? 'map-top' : 'map-bottom';
    if (Math.abs(x) === m) return x > 0 ? 'map-right' : 'map-left';
    return z > 0 ? 'sky' : 'ground';
  };
  return { facing: where(f), crown: where(u), rightEar: where(right), perpendicular: Math.abs(dot) < 1e-9, set };
}

describe('listener pose per posture', () => {
  it('stands looking at the top of the map with the crown to the sky', () => {
    const p = poseOf('standing', 0);
    expect(p.facing).toBe('map-top');
    expect(p.crown).toBe('sky');
    expect(p.rightEar).toBe('map-right');
  });

  it('lies on its back looking up, feet towards the top of the map', () => {
    // Decided on the mat with the phone in hand, twice over: first the crown
    // went to the top of the map (mirrored ears, geometrically defensible),
    // and in use that was wrong. Feet up, head down is the orientation in
    // which a sound drawn on the right of the screen is heard on the right.
    const p = poseOf('lying-back', 0);
    expect(p.facing).toBe('sky');
    expect(p.crown).toBe('map-bottom');
  });

  it('keeps left and right the way the phone shows them, standing or lying', () => {
    const standing = poseOf('standing', 0);
    const lying = poseOf('lying-back', 0);
    expect(standing.rightEar).toBe('map-right');
    expect(lying.rightEar).toBe('map-right');
  });

  it('keeps forward and up perpendicular in every posture', () => {
    for (const posture of ['standing', 'lying-back', 'lying-side']) {
      for (const tilt of [-45, 0, 30]) {
        expect(poseOf(posture, tilt).perpendicular, `${posture} @ ${tilt}`).toBe(true);
      }
    }
  });

  it('turns the face without moving the crown', () => {
    const ahead = poseOf('standing', 0, 0);
    const right = poseOf('standing', 0, 90);
    expect(ahead.facing).toBe('map-top');
    expect(right.facing).toBe('map-right');
    expect(right.crown).toBe('sky');
  });

  it('turns about the listener own crown, so lying down the gaze leaves the ceiling', () => {
    // Turn your head while flat on your back and you stop looking at the
    // ceiling and start looking at a wall. The crown is the axis, so it does
    // not move. An earlier version of this test asserted the opposite and was
    // simply wrong about the physics.
    const straight = poseOf('lying-back', 0, 0);
    const turned = poseOf('lying-back', 0, 90);
    expect(straight.facing).toBe('sky');
    expect(turned.facing).not.toBe('sky');
    expect(turned.crown).toBe('map-bottom');
  });

  it('survives a posture it does not know rather than producing a zero vector', () => {
    const p = poseOf('upside-down', 0);
    expect(p.perpendicular).toBe(true);
    expect(['map-top', 'map-bottom', 'map-left', 'map-right', 'sky', 'ground']).toContain(p.facing);
  });
});

describe('the panner input is summed to mono', () => {
  function pannerOf() {
    const made = [];
    const param = (v = 0) => ({ value: v, setValueAtTime(x) { this.value = x; } });
    const node = (extra = {}) => ({ connect() {}, disconnect() {}, start() {}, stop() {}, ...extra });
    const ctx = {
      currentTime: 0, sampleRate: 44100,
      createGain: () => node({ gain: param(1) }),
      createBiquadFilter: () => node({ type: '', Q: param(1), gain: param(0), frequency: param(1000) }),
      createPanner: () => {
        const p = node({
          panningModel: '', distanceModel: '', refDistance: 0, maxDistance: 0, rolloffFactor: 0,
          channelCount: 2, channelCountMode: 'clamped-max', channelInterpretation: 'speakers',
          positionX: param(), positionY: param(), positionZ: param(),
        });
        made.push(p);
        return p;
      },
      createChannelMerger: () => node(),
      createChannelSplitter: () => node(),
    };
    const engine = new SpatialAudioEngine();
    engine.ctx = ctx;
    engine.isInitialized = true;
    const src = { id: 'x', x: 0, y: 0, z: 0, inserts: {} };
    engine._buildSpatialChain(src, node());
    return made[0];
  }

  it('takes one channel explicitly, not whatever arrives', () => {
    // Two channels in, and the panner applies the left response to the left
    // input and the right to the right. Measured on a stereo file three metres
    // to the right: -0.9 dB right-minus-left, so it sounded slightly left of
    // centre and was not placed at all. Summed to mono first: +11.2 dB.
    const p = pannerOf();
    expect(p.channelCount).toBe(1);
    expect(p.channelCountMode).toBe('explicit');
  });

  it('still renders through the HRTF model', () => {
    expect(pannerOf().panningModel).toBe('HRTF');
  });
});

/**
 * The field draws its figure from poseVectors, and the panner is fed from the
 * same call, so these assertions are the contract between the picture and the
 * sound. They exist because the two had drifted apart: lying on your back the
 * drawn ears were mirrored against the audio, so a sound on the right of the
 * map was heard on the left while the right-hand marker lit up, and lying on
 * your side the drawn nose pointed along the body while the audio faced across
 * it. Both were drawn by hand, per posture, next to the code that had the
 * answer already.
 */
describe('poseVectors, the one place that decides where the listener faces', () => {
  const axis = ([x, y, z]) => {
    const r = (n) => +n.toFixed(6);
    const [a, b, c] = [r(x), r(y), r(z)];
    const m = Math.max(Math.abs(a), Math.abs(b), Math.abs(c));
    if (Math.abs(c) === m) return c > 0 ? 'sky' : 'ground';
    if (Math.abs(b) === m) return b > 0 ? 'map-top' : 'map-bottom';
    return a > 0 ? 'map-right' : 'map-left';
  };
  const named = (posture, tilt = 0, turn = 0) => {
    const v = SpatialAudioEngine.poseVectors(posture, tilt, turn);
    return { nose: axis(v.forward), crown: axis(v.up), rightEar: axis(v.right), v };
  };

  it('stands facing the top of the map, crown up, right ear to the right', () => {
    expect(named('standing')).toMatchObject({ nose: 'map-top', crown: 'sky', rightEar: 'map-right' });
  });

  it('lies on its back facing the sky, feet to the top, right ear to the right', () => {
    // Not mirrored. The crown points at the bottom of the map, so the map's
    // right is the listener's right, which is what the hand on the phone
    // expects. The earlier mirrored version was correct for a map seen from
    // underneath and wrong for a person holding a phone.
    expect(named('lying-back')).toMatchObject({ nose: 'sky', crown: 'map-bottom', rightEar: 'map-right' });
  });

  it('lies on its side with one ear up and one ear down', () => {
    // The whole point of the posture. The preset used to stop at 45 degrees,
    // which put the crown into the ground and neither ear anywhere useful.
    const p = named('lying-side');
    expect(p).toMatchObject({ nose: 'map-top', crown: 'map-right' });
    expect(['sky', 'ground']).toContain(p.rightEar);
    expect(Math.abs(p.v.right[2])).toBeCloseTo(1, 6);
  });

  it('keeps the three axes a right-handed orthonormal frame in every posture', () => {
    for (const posture of ['standing', 'lying-back', 'lying-side']) {
      for (const tilt of [-90, -30, 0, 30, 90]) {
        for (const turn of [-180, -40, 0, 40, 180]) {
          const { forward, up, right } = SpatialAudioEngine.poseVectors(posture, tilt, turn);
          const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
          const label = `${posture} tilt ${tilt} turn ${turn}`;
          expect(Math.hypot(...forward), label).toBeCloseTo(1, 6);
          expect(Math.hypot(...up), label).toBeCloseTo(1, 6);
          expect(Math.hypot(...right), label).toBeCloseTo(1, 6);
          expect(dot(forward, up), label).toBeCloseTo(0, 6);
          expect(dot(forward, right), label).toBeCloseTo(0, 6);
          expect(dot(up, right), label).toBeCloseTo(0, 6);
        }
      }
    }
  });

  it('turns the face to the right for a positive turn, in every posture', () => {
    for (const posture of ['standing', 'lying-back', 'lying-side']) {
      const { forward, right } = SpatialAudioEngine.poseVectors(posture, 0, 0);
      const turned = SpatialAudioEngine.poseVectors(posture, 0, 40).forward;
      const towardsRight = turned[0] * right[0] + turned[1] * right[1] + turned[2] * right[2];
      const stillForward = turned[0] * forward[0] + turned[1] * forward[1] + turned[2] * forward[2];
      expect(towardsRight, `${posture} turns right`).toBeGreaterThan(0.5);
      expect(stillForward, `${posture} keeps most of its facing`).toBeGreaterThan(0.5);
    }
  });

  it('tilts the crown towards the listener own right ear, in every posture', () => {
    // The rule a single slider can actually teach: it is always the same
    // movement of the head, whatever the body is doing. Lying on your side
    // used to lean the other way, so the control meant two different things
    // depending on which posture happened to be selected.
    for (const posture of ['standing', 'lying-back', 'lying-side']) {
      const rest = SpatialAudioEngine.poseVectors(posture, 0, 0);
      const tilted = SpatialAudioEngine.poseVectors(posture, 25, 0).up;
      const moved = [
        tilted[0] - rest.up[0], tilted[1] - rest.up[1], tilted[2] - rest.up[2],
      ];
      const towardsRightEar = moved[0] * rest.right[0] + moved[1] * rest.right[1] + moved[2] * rest.right[2];
      expect(towardsRightEar, posture).toBeGreaterThan(0);
    }
  });
});
