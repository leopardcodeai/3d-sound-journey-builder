export const SPEAKER_PRESETS = {
  'stereo-headphones': {
    name: 'Stereo Headphones (3D HRTF)',
    icon: '🎧',
    channels: 2,
    description: 'Binaural 3D audio with HRTF — optimal with headphones.',
    speakerPositions: null,
  },
  'stereo-speakers': {
    name: 'Stereo Speakers',
    icon: '🔉',
    channels: 2,
    description: 'Classic stereo panning for two front speakers.',
    speakerPositions: [
      { x: -1, y: 1, z: 0, label: 'L', angle: -30 },
      { x: 1, y: 1, z: 0, label: 'R', angle: 30 },
    ],
  },
  'surround-5.1': {
    name: '5.1 Surround',
    icon: '🔊',
    channels: 6,
    description: '6-channel surround: L, C, R, Ls, Rs, Subwoofer.',
    speakerPositions: [
      { x: -1, y: 0.8, z: 0, label: 'L', angle: -30, channel: 0 },
      { x: 0, y: 1, z: 0, label: 'C', angle: 0, channel: 1 },
      { x: 1, y: 0.8, z: 0, label: 'R', angle: 30, channel: 2 },
      { x: -1, y: -0.8, z: 0, label: 'Ls', angle: -110, channel: 3 },
      { x: 1, y: -0.8, z: 0, label: 'Rs', angle: 110, channel: 4 },
      { x: 0, y: 0, z: 0, label: 'LFE', angle: 0, channel: 5, isSub: true },
    ],
  },
  'custom': {
    name: 'Custom Speakers',
    icon: '🔧',
    channels: 'custom',
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
    this.onConfigChange = null;
  }

  setConfig(presetKey) {
    const preset = SPEAKER_PRESETS[presetKey];
    if (!preset) return false;
    this.currentPreset = presetKey;

    if (presetKey === 'stereo-headphones') {
      this.audioEngine.setOutputMode('hrtf');
    } else {
      const positions = presetKey === 'custom' ? this.customSpeakers : preset.speakerPositions;
      this.audioEngine.setOutputMode('speakers', positions, preset.channels);
    }

    if (this.onConfigChange) this.onConfigChange(presetKey, preset);
    return true;
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
