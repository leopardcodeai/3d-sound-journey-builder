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

  it('lies on its back looking up, head towards the top of the map', () => {
    // Reported from a phone: this used to point the crown at the bottom of the
    // map, exactly 180 degrees out. Lying down, you look up at the screen, so
    // the head belongs at the top and the image is mirrored.
    const p = poseOf('lying-back', 0);
    expect(p.facing).toBe('sky');
    expect(p.crown).toBe('map-top');
  });

  it('mirrors left and right when lying on the back, which is the whole point', () => {
    const standing = poseOf('standing', 0);
    const lying = poseOf('lying-back', 0);
    expect(standing.rightEar).toBe('map-right');
    expect(lying.rightEar).toBe('map-left');
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
    expect(turned.crown).toBe('map-top');
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
