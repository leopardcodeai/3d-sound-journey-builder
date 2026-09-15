/**
 * main
 * Wires the app together: audio engine, the two views (field and focus), the
 * library, the inspector, the timeline, and the settings drawer.
 */
import './style.css';
import { SpatialAudioEngine } from './audio/AudioEngine.js';
import { HeadTracker } from './audio/HeadTracker.js';
import { SpeakerConfig, SPEAKER_PRESETS } from './audio/SpeakerConfig.js';
import { SceneManager } from './audio/SceneManager.js';
import { InstrumentSynth } from './audio/InstrumentSynth.js';
import { CanvasGrid } from './ui/CanvasGrid.js';
import { Timeline } from './ui/Timeline.js';
import { Library } from './ui/Library.js';
import { Inspector } from './ui/Inspector.js';
import { FocusView } from './ui/FocusView.js';
import { SoundscapeTimer } from './ui/Timer.js';
import { initKeyboardShortcuts } from './ui/KeyboardShortcuts.js';
import { hydrateIcons, icon } from './ui/Icons.js';
import { watchRangeFills, syncRangeFills, setRangeFill } from './ui/sliders.js';
import { getSound, soundName, SOUND_URLS } from './data/SoundLibrary.js';
import { JOURNEYS, JOURNEY_ORDER, MODES } from './data/Presets.js';
import { UndoManager, createMoveCommand, createAddCommand } from './core/UndoManager.js';
import { t, setLanguage, getLanguage, applyTranslations } from './i18n.js';

const $ = (sel) => document.querySelector(sel);

// ---------------------------------------------------------------------------
// Core objects
// ---------------------------------------------------------------------------

const audioEngine = new SpatialAudioEngine();
const undoManager = new UndoManager(40);
let inspector = null;
let library = null;
let focusView = null;

const canvasGrid = new CanvasGrid($('#field-canvas'), audioEngine, {
  onNodeSelected: (node) => {
    if (inspector) inspector.show(node);
    if (node) openMobilePanel('inspector');
    if (timeline && timeline.visible) timeline._render();
  },
  onNodeMoved: (node) => { if (inspector) inspector.update(node); },
  onNodeDragEnd: (id, ox, oy, oz, nx, ny, nz) => {
    undoManager.execute(createMoveCommand(audioEngine, canvasGrid, id, ox, oy, oz, nx, ny, nz, timeline));
  },
  onNodeDropped: (type, x, y) => addSound(type, { x, y }),
  onNodeActivated: (node) => { if (node) audioEngine.toggleSource(node.id); },
});

const timeline = new Timeline($('#timeline-dock'), audioEngine, canvasGrid);
timeline.undoManager = undoManager;
canvasGrid.timeline = timeline;
timeline.onSelect = (id) => {
  canvasGrid.selectedNodeId = id;
  if (inspector) inspector.show(audioEngine.sources.get(id));
};

const speakerConfig = new SpeakerConfig(audioEngine, canvasGrid);
audioEngine._speakerConfig = speakerConfig;
const sceneManager = new SceneManager(audioEngine, canvasGrid, timeline);

const soundscapeTimer = new SoundscapeTimer(audioEngine, {
  onTick: (remaining) => {
    const el = $('#timer-display');
    if (!el) return;
    const h = Math.floor(remaining / 3600);
    const m = Math.floor((remaining % 3600) / 60);
    const s = remaining % 60;
    el.textContent = h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  },
  onStop: () => { $('#timer-display').textContent = '--:--'; $('#timer-cancel').hidden = true; },
});

const headTracker = new HeadTracker(audioEngine, {
  onStart: () => setHeadTrackerUI(true),
  onStop: () => { setHeadTrackerUI(false); audioEngine.updateListenerPose(audioEngine.posture, audioEngine.headTilt); },
});
audioEngine.headTracker = headTracker;

// ---------------------------------------------------------------------------
// Panels
// ---------------------------------------------------------------------------

library = new Library($('#panel-library'), audioEngine, {
  onAdd: (type) => addSound(type),
  onUpload: (file) => importAudioFile(file),
});

inspector = new Inspector($('#panel-inspector'), audioEngine, canvasGrid, timeline, undoManager);

focusView = new FocusView($('#view-focus'), audioEngine, {
  onOpenField: () => setView('field'),
  onSourcesChanged: () => { timeline._render(); refreshPanels(); },
});

// ---------------------------------------------------------------------------
// Adding sounds
// ---------------------------------------------------------------------------

/**
 * Add a sound to the field. Samples are preloaded on demand; generators start
 * immediately. Head-locked sounds ignore the position.
 */
async function addSound(type, opts = {}) {
  if (!audioEngine.isInitialized) audioEngine.init();
  await audioEngine.resume();

  const def = getSound(type);
  if (def.kind === 'sample' && !audioEngine.hasBuffer(type)) {
    setHint(t('loadingAudio'));
    const ok = await audioEngine.preloadSound(type, def.url || SOUND_URLS[type]);
    setHint('');
    if (!ok) { showToast(t('decodeError')); return null; }
  }

  const id = `src_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e4).toString(36)}`;
  const angle = opts.x !== undefined ? null : Math.random() * Math.PI * 2;
  const dist = 3 + Math.random() * 3;
  const x = opts.x !== undefined ? opts.x : Math.cos(angle) * dist;
  const y = opts.y !== undefined ? opts.y : Math.sin(angle) * dist;
  const volume = opts.volume !== undefined ? opts.volume : 0.55;

  const source = audioEngine.addSource(id, type, soundName(type), round(x), round(y), opts.z || 0, volume, { params: opts.params });
  if (!source) return null;

  canvasGrid.selectedNodeId = id;
  inspector.show(source);
  undoManager.execute(createAddCommand(audioEngine, canvasGrid, {
    id, type, name: source.name, x: source.x, y: source.y, z: source.z, volume, gen: source.gen, params: { ...source.params },
  }, timeline));

  if (!timeline.visible && audioEngine.sources.size > 0) showTimeline(true);
  timeline._render();
  return source;
}

function round(v) { return Math.round(v * 100) / 100; }

async function importAudioFile(file) {
  if (!audioEngine.isInitialized) audioEngine.init();
  setHint(t('decoding'));
  try {
    const arrayBuffer = await file.arrayBuffer();
    const decoded = await audioEngine.ctx.decodeAudioData(arrayBuffer);
    const type = `custom_${Date.now().toString(36)}`;
    const name = file.name.replace(/\.[^/.]+$/, '').slice(0, 28);
    audioEngine.addAudioBuffer(type, decoded);
    canvasGrid.themeColors[type] = '#ff7b7b';
    library.addCustomSound({ type, kind: 'sample', category: 'custom', glyph: 'file', color: '#ff7b7b', spatial: true, name, desc: `${Math.round(decoded.duration)} s` });
    setHint('');
    await addSound(type);
  } catch (err) {
    console.error(err);
    setHint('');
    showToast(t('decodeError'));
  }
}

// ---------------------------------------------------------------------------
// Journeys
// ---------------------------------------------------------------------------

let journeyLoad = 0;

async function loadJourney(id) {
  const journey = JOURNEYS[id];
  if (!journey) return;
  // Loading awaits a decode, so a second click would clear and configure on
  // top of the first one still in flight. Only the newest call may finish.
  const token = ++journeyLoad;
  if (!audioEngine.isInitialized) audioEngine.init();
  await audioEngine.resume();
  if (token !== journeyLoad) return;

  for (const sid of [...audioEngine.sources.keys()]) audioEngine.removeSource(sid);
  canvasGrid.automations.clear();
  canvasGrid.selectedNodeId = null;
  timeline.pause();
  timeline.playheadTime = 0;
  timeline.keyframes.clear();
  timeline.sourceTimings.clear();
  timeline.trackState.clear();

  audioEngine.setMasterVolume(journey.masterVolume);
  syncMasterUI(journey.masterVolume);
  if (journey.posture) { audioEngine.applyPosturePreset(journey.posture); syncPostureUI(journey.posture); }
  timeline.setTotalDuration(journey.duration);
  timeline.setSections(journey.sections || []);

  setHint(t('loadingAudio'));
  const needed = [...new Set(journey.sources.map(s => s.type))]
    .filter(type => getSound(type).kind === 'sample' && !audioEngine.hasBuffer(type));
  await Promise.all(needed.map(type => audioEngine.preloadSound(type, getSound(type).url)));
  if (token !== journeyLoad) return;
  setHint('');

  for (const s of journey.sources) {
    const source = audioEngine.addSource(s.id, s.type, s.name, s.x, s.y, s.z, s.volume);
    if (!source) continue;
    timeline.ensureTiming(s.id);
    const timing = timeline.sourceTimings.get(s.id);
    timing.startTime = s.startTime;
    timing.duration = s.duration;
    if (s.keyframes) timeline.setKeyframes(s.id, s.keyframes);
  }

  showTimeline(true);
  timeline.fit();
  timeline.playheadTime = 0;
  timeline._applyKeyframes();
  timeline._updatePlayhead();
  timeline.play();
  inspector.show(null);
  refreshPanels();
  showToast(journey.name);
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

let currentView = 'field';

function setView(view) {
  currentView = view;
  const field = $('#view-field');
  const focus = $('#view-focus');
  field.hidden = view !== 'field';
  focus.hidden = view !== 'focus';
  field.classList.toggle('is-visible', view === 'field');
  document.body.classList.toggle('view-focus-active', view === 'focus');
  document.querySelectorAll('.viewswitch-btn').forEach(b => {
    const on = b.dataset.view === view;
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-selected', String(on));
  });
  if (view === 'focus') focusView.show(); else focusView.hide();
  if (view === 'field') { canvasGrid.resize(); timeline._render(); }
}

function showTimeline(show) {
  if (show) timeline.show(); else timeline.hide();
  $('#timeline-toggle').classList.toggle('is-on', timeline.visible);
  syncTabBar();
}

/**
 * On a phone the sheets, the dock and the tab bar are one state. Whichever of
 * them changes, the highlight follows: the open sheet if there is one, the
 * timeline if its dock is up, otherwise the field.
 */
function syncTabBar() {
  if (window.innerWidth > 900) return;
  const panel = document.body.dataset.panel;
  const active = (panel === 'library' || panel === 'inspector')
    ? panel
    : (timeline.visible ? 'timeline' : 'field');
  document.querySelectorAll('.tabbar-btn').forEach(b => b.classList.toggle('is-on', b.dataset.panel === active));
}

function openMobilePanel(panel) {
  if (window.innerWidth > 900) return;
  document.body.dataset.panel = panel;
  syncTabBar();
}

/** The tab bar toggles: tapping the open panel again returns to the field. */
function toggleMobilePanel(panel) {
  if (panel === 'timeline') {
    // Opening the dock closes any sheet over it, so they never stack.
    document.body.dataset.panel = 'field';
    showTimeline(!timeline.visible);
    return;
  }
  openMobilePanel(document.body.dataset.panel === panel ? 'field' : panel);
}

function refreshPanels() {
  if (library) library.refresh();
  if (focusView && focusView.visible) { focusView.renderLayers(); focusView.renderReadout(); }
  renderSceneList();
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

function setHint(text) {
  const el = $('#field-hint');
  if (!el) return;
  if (text) { el.textContent = text; el.classList.add('is-loud'); }
  else { el.textContent = t('dragHint'); el.classList.remove('is-loud'); }
}

let toastTimer = null;
function showToast(message) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
  el.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.remove('is-visible'); setTimeout(() => { el.hidden = true; }, 250); }, 1800);
}

function syncMasterUI(value) {
  const slider = $('#master-volume');
  if (slider) { slider.value = value; setRangeFill(slider); }
  const out = $('#master-volume-val');
  if (out) out.textContent = `${Math.round(value * 100)}%`;
}

function syncPostureUI(posture) {
  document.querySelectorAll('#posture-seg .seg-btn').forEach(b => b.classList.toggle('is-on', b.dataset.posture === posture));
  const tilt = $('#head-tilt');
  if (tilt) { tilt.value = audioEngine.headTilt; tilt.nextElementSibling.textContent = `${audioEngine.headTilt}°`; }
  const sh = $('#shoulder-strength');
  if (sh) { sh.value = audioEngine.shoulderStrength; sh.nextElementSibling.textContent = `${Math.round(audioEngine.shoulderStrength * 100)}%`; }
  const pi = $('#pinna-strength');
  if (pi) { pi.value = audioEngine.pinnaStrength; pi.nextElementSibling.textContent = `${Math.round(audioEngine.pinnaStrength * 100)}%`; }
  updateSliderFills();
}

function setHeadTrackerUI(active) {
  const btn = $('#head-tracker-btn');
  const status = $('#head-tracker-status');
  if (btn) {
    btn.classList.toggle('is-on', active);
    btn.querySelector('span:last-child').textContent = active ? t('headTrackerActive') : t('enableHeadTracking');
  }
  if (status) status.textContent = active ? t('headTrackerMove') : t('headTrackerReady');
}

function updateSliderFills(root) { syncRangeFills(root); }

function renderSceneList() {
  const container = $('#scene-list');
  if (!container) return;
  const names = sceneManager.getSceneNames();
  if (!names.length) { container.innerHTML = `<p class="note">${t('scenes')}: 0</p>`; return; }
  container.innerHTML = names.map(name => `
    <div class="scene-item" data-scene="${escapeAttr(name)}">
      <span>${escapeHtml(name)}</span>
      <button class="icon-btn scene-del" data-scene="${escapeAttr(name)}">${icon('trash', { size: 12 })}</button>
    </div>`).join('');
}

function renderSpeakerList() {
  const container = $('#speaker-list');
  if (!container) return;
  container.innerHTML = speakerConfig.customSpeakers.map((sp, i) => `
    <div class="scene-item">
      <span class="mono">${escapeHtml(sp.label)} · ${sp.x.toFixed(1)}, ${sp.y.toFixed(1)}</span>
      <button class="icon-btn speaker-del" data-index="${i}">${icon('close', { size: 12 })}</button>
    </div>`).join('');
}

function renderJourneyList() {
  const container = $('#journey-list');
  if (!container) return;
  container.innerHTML = JOURNEY_ORDER.map(id => {
    const j = JOURNEYS[id];
    return `<button class="journey-btn" data-journey="${id}">
      <span class="journey-icon">${icon(j.icon, { size: 16 })}</span>
      <span class="journey-text"><strong>${escapeHtml(j.name)}</strong><span>${escapeHtml(j.summary)}</span></span>
      <span class="journey-len mono">${Math.round(j.duration / 60)} ${t('minutesShort')}</span>
    </button>`;
  }).join('');
}

function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function escapeAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }

// ---------------------------------------------------------------------------
// Event wiring
// ---------------------------------------------------------------------------

function bindUI() {
  // View switch
  document.querySelectorAll('.viewswitch-btn').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));

  // Master
  const master = $('#master-volume');
  master.addEventListener('input', () => {
    const v = parseFloat(master.value);
    audioEngine.setMasterVolume(v);
    syncMasterUI(v);
  });
  $('#mute-btn').addEventListener('click', () => {
    const muted = audioEngine.toggleMasterMute();
    $('#mute-btn').classList.toggle('is-on', muted);
    $('#mute-btn').innerHTML = icon(muted ? 'mute' : 'volume', { size: 15 });
  });
  $('#undo-btn').addEventListener('click', () => { undoManager.undo(); afterUndo(); });
  $('#redo-btn').addEventListener('click', () => { undoManager.redo(); afterUndo(); });

  // Settings drawer
  const drawer = $('#settings-drawer');
  $('#settings-btn').addEventListener('click', () => {
    drawer.hidden = !drawer.hidden;
    drawer.classList.toggle('is-open', !drawer.hidden);
  });
  $('#settings-close').addEventListener('click', () => { drawer.hidden = true; drawer.classList.remove('is-open'); });

  // Field tools
  $('#view-2d-btn').addEventListener('click', () => setFieldMode('2d'));
  $('#view-3d-btn').addEventListener('click', () => setFieldMode('3d'));
  $('#reset-view-btn').addEventListener('click', () => canvasGrid.resetView());
  $('#north-btn').addEventListener('click', () => canvasGrid.flyTo(canvasGrid._targetPitch, 0, canvasGrid._targetZoom, 0, 0, 350));
  $('#labels-btn').addEventListener('click', (e) => {
    canvasGrid.showLabels = !canvasGrid.showLabels;
    e.currentTarget.classList.toggle('is-on', canvasGrid.showLabels);
  });
  $('#grid-btn').addEventListener('click', (e) => {
    canvasGrid.showGrid = !canvasGrid.showGrid;
    e.currentTarget.classList.toggle('is-on', canvasGrid.showGrid);
  });

  // Timeline dock
  $('#timeline-toggle').addEventListener('click', () => showTimeline(!timeline.visible));

  // Mobile tab bar
  document.querySelectorAll('.tabbar-btn').forEach(b => b.addEventListener('click', () => toggleMobilePanel(b.dataset.panel)));

  // Output
  const speakerSelect = $('#speaker-config');
  speakerSelect.addEventListener('change', () => {
    const key = speakerSelect.value;
    speakerConfig.setConfig(key);
    $('#custom-speakers').hidden = key !== 'custom';
    showToast(SPEAKER_PRESETS[key].name);
  });
  $('#add-speaker-btn').addEventListener('click', () => {
    speakerConfig.addCustomSpeaker((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, 0, `S${speakerConfig.customSpeakers.length + 1}`);
    renderSpeakerList();
  });
  $('#edit-speakers-btn').addEventListener('click', (e) => {
    const editing = canvasGrid.editLayer === 'speakers';
    canvasGrid.editLayer = editing ? 'sources' : 'speakers';
    e.currentTarget.classList.toggle('is-on', !editing);
  });
  $('#speaker-list').addEventListener('click', (e) => {
    const btn = e.target.closest('.speaker-del');
    if (!btn) return;
    speakerConfig.removeCustomSpeaker(parseInt(btn.dataset.index, 10));
    renderSpeakerList();
  });
  const reverb = $('#reverb-level');
  reverb.addEventListener('input', () => {
    const v = parseFloat(reverb.value);
    audioEngine.setReverbLevel(v);
    reverb.nextElementSibling.textContent = `${Math.round(v * 100)}%`;
  });

  // Listener
  $('#posture-seg').addEventListener('click', (e) => {
    const btn = e.target.closest('.seg-btn');
    if (!btn) return;
    audioEngine.applyPosturePreset(btn.dataset.posture);
    syncPostureUI(btn.dataset.posture);
  });
  bindRange('#head-tilt', (v) => { audioEngine.updateListenerPose(audioEngine.posture, v); return `${v}°`; });
  bindRange('#shoulder-strength', (v) => { audioEngine.updateShoulderStrength(v); return `${Math.round(v * 100)}%`; });
  bindRange('#pinna-strength', (v) => { audioEngine.updatePinnaStrength(v); return `${Math.round(v * 100)}%`; });

  $('#head-tracker-btn').addEventListener('click', async () => {
    if (!headTracker.isAvailable()) { showToast(t('headTrackerNotAvailable')); return; }
    if (headTracker.active) { headTracker.stop(); return; }
    const granted = await headTracker.requestPermission();
    if (granted) { headTracker.start(); headTracker.calibrate(); }
    else $('#head-tracker-status').textContent = t('headTrackerPermission');
  });

  // Journeys
  $('#journey-list').addEventListener('click', (e) => {
    const btn = e.target.closest('.journey-btn');
    if (btn) loadJourney(btn.dataset.journey);
  });

  // Scenes
  $('#save-scene-btn').addEventListener('click', () => {
    const name = prompt(t('sceneName'));
    if (!name) return;
    sceneManager.saveScene(name);
    renderSceneList();
    showToast(`${t('savedAs')}: ${name}`);
  });
  $('#share-scene-btn').addEventListener('click', async () => {
    const url = sceneManager.exportToURL();
    try { await navigator.clipboard.writeText(url); showToast(t('linkCopied')); }
    catch (e) { prompt(t('copyLink'), url); }
  });
  $('#scene-list').addEventListener('click', async (e) => {
    const del = e.target.closest('.scene-del');
    if (del) { sceneManager.deleteScene(del.dataset.scene); renderSceneList(); return; }
    const item = e.target.closest('.scene-item');
    if (!item) return;
    if (!audioEngine.isInitialized) audioEngine.init();
    await audioEngine.resume();
    setHint(t('loadingAudio'));
    // Loading decodes any sample the scene needs, so it has to be awaited.
    await sceneManager.loadScene(item.dataset.scene);
    setHint('');
    canvasGrid.selectedNodeId = null;
    inspector.show(null);
    showTimeline(timeline.keyframes.size > 0 || audioEngine.sources.size > 0);
    timeline._render();
    refreshPanels();
  });

  // Timer
  $('#timer-chips').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    document.querySelectorAll('#timer-chips .chip').forEach(c => c.classList.toggle('is-on', c === chip));
    soundscapeTimer.start(parseInt(chip.dataset.minutes, 10));
    $('#timer-cancel').hidden = false;
  });
  $('#timer-cancel').addEventListener('click', () => {
    soundscapeTimer.stop();
    document.querySelectorAll('#timer-chips .chip').forEach(c => c.classList.remove('is-on'));
  });

  // Session
  $('#new-session-btn').addEventListener('click', () => {
    for (const id of [...audioEngine.sources.keys()]) audioEngine.removeSource(id);
    canvasGrid.automations.clear();
    canvasGrid.selectedNodeId = null;
    timeline.keyframes.clear();
    timeline.sourceTimings.clear();
    timeline.trackState.clear();
    timeline.stop();
    inspector.show(null);
    timeline._render();
  });
  $('#clear-all-btn').addEventListener('click', () => {
    for (const id of [...audioEngine.sources.keys()]) audioEngine.removeSource(id);
    canvasGrid.automations.clear();
    canvasGrid.selectedNodeId = null;
    inspector.show(null);
    timeline._render();
  });

  // Language
  const lang = $('#lang-select');
  lang.value = getLanguage();
  lang.addEventListener('change', () => {
    setLanguage(lang.value);
    applyTranslations(document);
    renderJourneyList();
    refreshPanels();
    inspector.show(canvasGrid.selectedNodeId ? audioEngine.sources.get(canvasGrid.selectedNodeId) : null);
  });

  // Welcome
  $('#start-journey').addEventListener('click', () => startApp('journey'));
  $('#start-focus').addEventListener('click', () => startApp('focus'));
  $('#start-empty').addEventListener('click', () => startApp('empty'));
}

function bindRange(selector, handler) {
  const el = $(selector);
  if (!el) return;
  el.addEventListener('input', () => {
    const v = parseFloat(el.value);
    const text = handler(v);
    const out = el.nextElementSibling;
    if (out && text !== undefined) out.textContent = text;
  });
}

function setFieldMode(mode) {
  canvasGrid.setViewMode(mode);
  $('#view-2d-btn').classList.toggle('is-on', mode === '2d');
  $('#view-3d-btn').classList.toggle('is-on', mode === '3d');
}

function afterUndo() {
  timeline._render();
  const sel = canvasGrid.selectedNodeId;
  inspector.show(sel ? audioEngine.sources.get(sel) : null);
}

// ---------------------------------------------------------------------------
// Start-up
// ---------------------------------------------------------------------------

async function startApp(mode) {
  audioEngine.init();
  await audioEngine.resume();

  const dot = $('#audio-status');
  dot.classList.add('is-on');
  dot.querySelector('.status-text').textContent = t('audioActive');

  const synth = new InstrumentSynth(audioEngine);
  synth.preloadAll('C4');
  synth.preloadHealing();

  document.body.classList.remove('pre-start');
  $('#welcome').classList.add('is-hidden');
  setTimeout(() => { $('#welcome').style.display = 'none'; }, 400);

  if (mode === 'journey') {
    await loadJourney('meditate');
  } else if (mode === 'focus') {
    setView('focus');
    await focusView.applyMode('focus');
  } else {
    showTimeline(false);
  }
  canvasGrid.resize();
}

function boot() {
  hydrateIcons(document);
  applyTranslations(document);
  renderJourneyList();
  renderSceneList();
  renderSpeakerList();
  syncMasterUI(0.8);
  watchRangeFills(document);
  bindUI();
  setFieldMode('2d');
  setHint('');
  document.body.dataset.panel = 'field';

  initKeyboardShortcuts({
    canvasGrid, audioEngine, undoManager, timeline,
    inspector,
    onToggleView: () => setView(currentView === 'field' ? 'focus' : 'field'),
    onToast: showToast,
  });

  // Head tracker availability text
  $('#head-tracker-status').textContent = headTracker.isAvailable() ? t('headTrackerAvailable') : t('headTrackerNotAvailable');

  // A shared scene in the URL skips the welcome screen. The audio context
  // still needs a gesture, so the first click anywhere resumes it.
  if (window.location.hash.startsWith('#scene=')) {
    audioEngine.init();
    const name = sceneManager.importFromURL();
    if (name) {
      document.body.classList.remove('pre-start');
      $('#welcome').style.display = 'none';
      showTimeline(true);
      setHint(t('loadingAudio'));
      // importFromURL kicks off the load; wait for the samples before drawing.
      sceneManager.loadScene(name).then(() => {
        setHint('');
        timeline._render();
        refreshPanels();
      });
      const resumeOnce = () => { audioEngine.resume(); document.removeEventListener('pointerdown', resumeOnce); };
      document.addEventListener('pointerdown', resumeOnce, { once: true });
    }
  }

  // Focus view visuals ride the animation loop
  const tick = () => { focusView.update(); updateMeter(); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);

  window.addEventListener('languagechange', () => applyTranslations(document));
}

function updateMeter() {
  const meter = $('#master-meter');
  if (!meter || !audioEngine.isInitialized) return;
  const { left, right } = audioEngine.getLeftRightLevels();
  meter.firstElementChild.style.height = `${Math.min(100, left * 130)}%`;
  meter.lastElementChild.style.height = `${Math.min(100, right * 130)}%`;
}

boot();

if (import.meta.env && import.meta.env.DEV) {
  window.__app = { audioEngine, canvasGrid, timeline, sceneManager, library, inspector, focusView, undoManager, speakerConfig, soundscapeTimer, loadJourney, addSound, setView, showTimeline, MODES };
}
