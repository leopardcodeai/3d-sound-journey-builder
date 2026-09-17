export const SPEAKER_PRESETS = {
  'stereo-headphones': {
    name: 'Stereo Headphones (3D HRTF)',
    channels: 2,
    description: 'Binaural 3D audio with HRTF — optimal with headphones.',
    speakerPositions: null,
  },
  'stereo-speakers': {
    name: 'Stereo Speakers',
    channels: 2,
    description: 'Classic stereo panning for two front speakers.',
    // Coordinates are what the renderer uses, so they are what has to be right.
    // They said 45 degrees while the angle beside them said 30, and the angle
    // was never read. Both now agree on the standard pair, at equal distance.
    speakerPositions: [
      { x: -0.5, y: 0.866, z: 0, label: 'L', angle: -30 },
      { x: 0.5, y: 0.866, z: 0, label: 'R', angle: 30 },
    ],
  },
  'surround-5.1': {
    name: '5.1 Surround',
    channels: 6,
    description: '6-channel surround: L, C, R, Ls, Rs, Subwoofer.',
    // ITU-R BS.775: front pair at 30 degrees, surrounds at 110, all on one
    // circle. The old coordinates put them at 51 and 129.
    speakerPositions: [
      { x: -0.5, y: 0.866, z: 0, label: 'L', angle: -30, channel: 0 },
      { x: 0, y: 1, z: 0, label: 'C', angle: 0, channel: 1 },
      { x: 0.5, y: 0.866, z: 0, label: 'R', angle: 30, channel: 2 },
      { x: -0.94, y: -0.342, z: 0, label: 'Ls', angle: -110, channel: 3 },
      { x: 0.94, y: -0.342, z: 0, label: 'Rs', angle: 110, channel: 4 },
      { x: 0, y: 0, z: 0, label: 'LFE', angle: 0, channel: 5, isSub: true },
    ],
  },
  'custom': {
    name: 'Custom Speakers',
    // No fixed channel count: it is however many speakers have been placed.
    // This field used to hold the string 'custom', which travelled all the way
    // into createChannelMerger and threw, leaving every source disconnected.
    channels: null,
    description: 'Place speakers freely in the room for multi-room setups.',
    speakerPositions: [],
  }
};

export class SpeakerConfig {
  constructor(audioEngine, canvasGrid) {
    this.audioEngine = audioEngine;
    this.canvasGrid = canvasGrid;
    this.currentPreset = 'stereo-headphones';
    this.customSpeakers = [];
    // Working copies of the preset layouts, made on first use. Dragging a
    // speaker used to write straight into SPEAKER_PRESETS, so one drag of the
    // Ls badge and the ITU layout was gone for the rest of the session, in the
    // settings list too. The constants stay what they ship as.
    this.layouts = {};
    this.onConfigChange = null;
  }

  /** The positions feeding the engine: the custom list, or a copy of the preset. */
  activePositions() {
    const key = this.currentPreset;
    if (key === 'stereo-headphones' || !SPEAKER_PRESETS[key]) return [];
    if (key === 'custom') return this.customSpeakers;
    if (!this.layouts[key]) this.layouts[key] = (SPEAKER_PRESETS[key].speakerPositions || []).map(p => ({ ...p }));
    return this.layouts[key];
  }

  setConfig(presetKey) {
    const preset = SPEAKER_PRESETS[presetKey];
    if (!preset) return false;
    this.currentPreset = presetKey;

    if (presetKey === 'stereo-headphones') {
      this.audioEngine.setOutputMode('hrtf');
    } else {
      const positions = this.activePositions();
      this.audioEngine.setOutputMode('speakers', positions, preset.channels || positions.length);
    }

    if (this.onConfigChange) this.onConfigChange(presetKey, preset);
    return true;
  }

  /**
   * Moves one speaker of the active layout and re-pans every source against
   * it. In place: the engine holds the same array, so nothing is rebuilt. The
   * old path called setOutputMode on every pointer move, which tore down and
   * rebuilt a merger and a gain per source per frame.
   */
  moveSpeaker(index, x, y) {
    const sp = this.activePositions()[index];
    if (!sp || sp.isSub) return false;
    sp.x = x;
    sp.y = y;
    if (this.audioEngine.refreshSpeakerPanning) this.audioEngine.refreshSpeakerPanning();
    return true;
  }

  /** Puts a preset back the way it ships. */
  resetLayout(presetKey = this.currentPreset) {
    delete this.layouts[presetKey];
    if (presetKey === this.currentPreset) this.setConfig(presetKey);
  }

  addCustomSpeaker(x, y, z, label) {
    const speaker = { x, y, z, label: label || `S${this.customSpeakers.length + 1}` };
    this.customSpeakers.push(speaker);
    if (this.currentPreset === 'custom') {
      this.audioEngine.setOutputMode('speakers', this.customSpeakers, this.customSpeakers.length);
    }
    return speaker;
  }

  removeCustomSpeaker(index) {
    this.customSpeakers.splice(index, 1);
    if (this.currentPreset === 'custom') {
      this.audioEngine.setOutputMode('speakers', this.customSpeakers, this.customSpeakers.length);
    }
  }

  getConfig() {
    return {
      preset: this.currentPreset,
      presetData: SPEAKER_PRESETS[this.currentPreset],
      customSpeakers: this.customSpeakers,
    };
  }
}
