import './style.css';
import { SpatialAudioEngine } from './audio/AudioEngine.js';
import { HeadTracker } from './audio/HeadTracker.js';
import { CanvasGrid } from './ui/CanvasGrid.js';
import { Timeline } from './ui/Timeline.js';
import { ControlPanel } from './ui/ControlPanel.js';
import { SceneManager } from './audio/SceneManager.js';
import { SoundscapeTimer } from './ui/Timer.js';
import { SpeakerConfig } from './audio/SpeakerConfig.js';
import { SOUND_URLS } from './data/SoundUrls.js';
import { InstrumentSynth } from './audio/InstrumentSynth.js';
import { bindEvents } from './ui/EventBindings.js';
import { UndoManager, createMoveCommand, createAddCommand, createDeleteCommand, createVolumeCommand } from './core/UndoManager.js';
import { initKeyboardShortcuts } from './ui/KeyboardShortcuts.js';

// DOM Element references
const elements = {
  startBtn: document.getElementById('start-btn'),
  welcomeModal: document.getElementById('welcome-modal'),
  audioStatus: document.getElementById('audio-status'),
  presetList: document.getElementById('preset-list'),
  masterVolume: document.getElementById('master-volume'),
  masterVolumeVal: document.getElementById('master-volume-val'),
  headerMasterVolume: document.getElementById('header-master-volume'),
  headerMasterVolumeVal: document.getElementById('header-master-vol-val'),
  masterMuteBtn: document.getElementById('master-mute-btn'),
  clearAllBtn: document.getElementById('clear-all-btn'),
  fileInput: document.getElementById('file-upload'),
  soundscapeCanvas: document.getElementById('soundscape-canvas'),
  panelRight: document.getElementById('panel-right'),
  detailsEmptyState: document.getElementById('details-empty-state'),
  selectedDetailsPanel: document.getElementById('selected-details-panel'),
  nodeName: document.getElementById('node-name'),
  nodeTypeLabel: document.getElementById('node-type-label'),
  nodeVolume: document.getElementById('node-volume'),
  nodeVolumeVal: document.getElementById('node-volume-val'),
  nodeHeight: document.getElementById('node-height'),
  nodeHeightVal: document.getElementById('node-height-val'),
  nodeCoords: document.getElementById('node-coords'),
  nodePlayToggle: document.getElementById('node-play-toggle'),
  nodeDelete: document.getElementById('node-delete'),
  autoOrbitBtn: document.getElementById('auto-orbit-btn'),
  autoPingpongBtn: document.getElementById('auto-pingpong-btn'),
  autoDriftBtn: document.getElementById('auto-drift-btn'),
  autoBreatheBtn: document.getElementById('auto-breathe-btn'),
  listenerPosture: document.getElementById('listener-posture'),
  headTilt: document.getElementById('head-tilt'),
  headTiltVal: document.getElementById('head-tilt-val'),
  shoulderStrength: document.getElementById('shoulder-strength'),
  shoulderStrengthVal: document.getElementById('shoulder-strength-val'),
  pinnaStrength: document.getElementById('pinna-strength'),
  pinnaStrengthVal: document.getElementById('pinna-strength-val'),
  postureHeadTilt: document.getElementById('posture-head-tilt'),
  postureHeadTiltVal: document.getElementById('posture-head-tilt-val'),
  postureShoulderWidth: document.getElementById('posture-shoulder-width'),
  postureShoulderWidthVal: document.getElementById('posture-shoulder-width-val'),
  posturePinnaSize: document.getElementById('posture-pinna-size'),
  posturePinnaSizeVal: document.getElementById('posture-pinna-size-val'),
  postureListenerX: document.getElementById('posture-listener-x'),
  postureListenerXVal: document.getElementById('posture-listener-x-val'),
  postureListenerY: document.getElementById('posture-listener-y'),
  postureListenerYVal: document.getElementById('posture-listener-y-val'),
  nodeRampup: document.getElementById('node-rampup'),
  nodeRampupVal: document.getElementById('node-rampup-val'),
  nodeRampdown: document.getElementById('node-rampdown'),
  nodeRampdownVal: document.getElementById('node-rampdown-val'),
  nodeRepeat: document.getElementById('node-repeat'),
  nodeRepeatVal: document.getElementById('node-repeat-val'),
};

// 1. Instantiate the spatial audio engine
const audioEngine = new SpatialAudioEngine();

// 1.5. Instantiate UndoManager
const undoManager = new UndoManager(20);

// 2. Define canvas interaction callbacks
let controlPanel = null;

const canvasCallbacks = {
  onNodeSelected: (node) => {
    if (controlPanel) {
      controlPanel.showSelectedDetails(node);
    }
  },

  onNodeMoved: (node) => {
    if (controlPanel) {
      controlPanel.updateCoordLabels(node.x, node.y);
    }
  },

  onNodeDragEnd: (nodeId, oldX, oldY, oldZ, newX, newY, newZ) => {
    const tl = canvasCallbacks.getTimeline?.();
    undoManager.execute(
      createMoveCommand(audioEngine, canvasGrid, nodeId, oldX, oldY, oldZ, newX, newY, newZ, tl)
    );
  },

  onNodeDropped: async (type, x, y) => {
    if (!audioEngine.isInitialized) {
      audioEngine.init();
    }
    const id = 'source_' + Date.now();
    const name = type;
    const volume = 0.6;

    let newSource = audioEngine.addSource(id, type, name, x, y, 0, volume);

    if (!newSource) {
      const url = SOUND_URLS[type];
      if (url) {
        const instr = document.getElementById('canvas-instructions');
        const originalText = instr ? instr.textContent : '';
        if (instr) {
          instr.classList.remove('faded');
          instr.textContent = 'Loading sound...';
        }

        await audioEngine.preloadSound(type, url);

        if (instr) {
          instr.textContent = originalText;
          setTimeout(() => instr.classList.add('faded'), 3000);
        }

        newSource = audioEngine.addSource(id, type, name, x, y, 0, volume);
      } else {
        await new Promise(resolve => setTimeout(resolve, 200));
        newSource = audioEngine.addSource(id, type, name, x, y, 0, volume);
      }
    }

    if (newSource) {
      canvasGrid.selectedNodeId = id;
      if (controlPanel) {
        controlPanel.showSelectedDetails(newSource);
      }
      const sourceData = { id, type, name, x, y, z: 0, volume };
      const tl = canvasCallbacks.getTimeline?.();
      undoManager.execute(createAddCommand(audioEngine, canvasGrid, sourceData, tl));

      // Auto-show timeline when first source is added
      if (tl && !tl.visible) {
        tl.show();
        document.getElementById('timeline-toggle-btn')?.classList.add('active');
      }
    }
  }
};

// 3. Instantiate canvas grid renderer
const canvasGrid = new CanvasGrid(elements.soundscapeCanvas, audioEngine, canvasCallbacks);

// 4. Instantiate sidebar control panel
controlPanel = new ControlPanel(elements, audioEngine, canvasGrid);
controlPanel.undoManager = undoManager;

const speakerConfig = new SpeakerConfig(audioEngine, canvasGrid);
controlPanel.speakerConfig = speakerConfig;
audioEngine._speakerConfig = speakerConfig;

// Timeline
const timeline = new Timeline(document.getElementById('timeline-panel'), audioEngine, canvasGrid);
controlPanel.timeline = timeline;

// Inject timeline reference into callbacks (created after canvasCallbacks)
canvasCallbacks.getTimeline = () => controlPanel?.timeline;

// 5. Initialize Scene Manager
const sceneManager = new SceneManager(audioEngine, canvasGrid, timeline);

// Check for shared scene in URL
sceneManager.importFromURL();

// 5. Instantiate Timer
const soundscapeTimer = new SoundscapeTimer(audioEngine, {
  onComplete: () => {},
  onTick: (remaining) => {
    const display = document.getElementById('timer-display');
    if (display) {
      const h = Math.floor(remaining / 3600);
      const m = Math.floor((remaining % 3600) / 60);
      const s = remaining % 60;
      display.textContent = h > 0
        ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
        : `${m}:${String(s).padStart(2, '0')}`;
    }
  }
});
controlPanel.timer = soundscapeTimer;

// Head tracker for AirPods spatial audio
const headTracker = new HeadTracker(audioEngine, {
  onStart: () => {
    const btn = document.getElementById('head-tracker-btn');
    const status = document.getElementById('head-tracker-status');
    if (btn) { btn.textContent = '🎧 Head Tracking active'; btn.classList.add('active'); }
    if (status) status.textContent = 'Move your head — the sound follows!';
  },
  onStop: () => {
    const btn = document.getElementById('head-tracker-btn');
    const status = document.getElementById('head-tracker-status');
    if (btn) { btn.textContent = '🎧 Enable Head Tracking'; btn.classList.remove('active'); }
    if (status) status.textContent = 'Ready';
    audioEngine.updateListenerPose(audioEngine.posture, audioEngine.headTilt);
  },
  onUpdate: () => {}
});

audioEngine.headTracker = headTracker;
controlPanel.headTracker = headTracker;

// 6. Onboarding / Initialization
async function initAudioEngine(loadDefaults = true) {
  audioEngine.init();

  const statusDot = elements.audioStatus.querySelector('.status-dot');
  const statusText = elements.audioStatus.querySelector('.status-text');
  if (statusDot) { statusDot.classList.remove('offline'); statusDot.classList.add('online'); }
  if (statusText) { statusText.textContent = 'Audio active'; }

  const instrumentSynth = new InstrumentSynth(audioEngine);
  instrumentSynth.preloadAll('C4');
  instrumentSynth.preloadChakraBowls();

  if (loadDefaults) await loadDefaultSoundscape();

  if (elements.welcomeModal) elements.welcomeModal.classList.add('hidden');

  const instr = document.getElementById('canvas-instructions');
  if (instr) {
    setTimeout(() => instr.classList.add('faded'), 8000);
    const fadeOnInteract = () => {
      instr.classList.add('faded');
      document.removeEventListener('pointerdown', fadeOnInteract);
    };
    document.addEventListener('pointerdown', fadeOnInteract, { once: true });
  }
}

/**
 * Creates the initial tutorial soundscape setup
 */
async function loadDefaultSoundscape() {
  const defaultTypes = ['birds', 'campfire', 'singing-bowl', 'gong'];
  await Promise.all(
    defaultTypes.map(type => audioEngine.preloadSound(type, SOUND_URLS[type]))
  );

  const birdId = 'source_default_birds';
  audioEngine.addSource(birdId, 'birds', 'Birdsong', 3.0, 2.0, 1.0, 0.45);
  canvasGrid.setAutomation(birdId, 'orbit', true, { speed: 0.0003, radius: 3.0 });

  const fireId = 'source_default_campfire';
  const fireNode = audioEngine.addSource(fireId, 'campfire', 'Campfire', -2.5, 2.5, 0, 0.55);
  canvasGrid.setAutomation(fireId, 'breathe', true, { speed: 0.0005, radius: 0.5 });

  const bowlId = 'source_default_singingbowl';
  const bowlNode = audioEngine.addSource(bowlId, 'singing-bowl', 'Singing Bowl (Deep)', -1.5, -3.0, 2.5, 0.35);
  canvasGrid.setAutomation(bowlId, 'drift', true, { speed: 0.001, radius: 2.0 });

  const gongId = 'source_default_gong';
  const gongNode = audioEngine.addSource(gongId, 'gong', 'Gong', -3.5, 3.5, 3.0, 0.25);
  canvasGrid.setAutomation(gongId, 'drift', true, { speed: 0.001, radius: 2.5 });

  canvasGrid.selectedNodeId = fireId;
  controlPanel.showSelectedDetails(fireNode || bowlNode || gongNode);
}

// Bind all UI events
bindEvents(elements, audioEngine, canvasGrid, controlPanel, timeline, sceneManager, soundscapeTimer, headTracker, speakerConfig, initAudioEngine);

initKeyboardShortcuts({ canvasGrid, audioEngine, controlPanel, undoManager });
