/**
 * ControlPanel
 * Manages the HTML sidebar UI components, events, preset library, details panels, and file uploads.
 */
import { t } from '../i18n.js';
import { initControlPanelEvents } from './ControlPanelEvents.js';

export class ControlPanel {
  /**
   * @param {Object} elements - DOM elements mapping
   * @param {SpatialAudioEngine} audioEngine - The audio engine instance
   * @param {CanvasGrid} canvasGrid - The canvas grid instance
   */
  constructor(elements, audioEngine, canvasGrid) {
    this.elements = elements;
    this.audioEngine = audioEngine;
    this.canvasGrid = canvasGrid;
    
    this._userOverrideShoulder = false;
    this._userOverridePinna = false;
    
    this.audioEngine.onPoseChange = (preset) => {
      if (!this._userOverrideShoulder && this.elements.shoulderStrength) {
        this.elements.shoulderStrength.value = preset.shoulderStrength;
        if (this.elements.shoulderStrengthVal) {
          this.elements.shoulderStrengthVal.textContent = `${Math.round(preset.shoulderStrength * 100)}%`;
        }
      }
      if (!this._userOverridePinna && this.elements.pinnaStrength) {
        this.elements.pinnaStrength.value = preset.pinnaStrength;
        if (this.elements.pinnaStrengthVal) {
          this.elements.pinnaStrengthVal.textContent = `${Math.round(preset.pinnaStrength * 100)}%`;
        }
      }
      if (this.elements.headTilt) {
        this.elements.headTilt.value = preset.headTilt;
        if (this.elements.headTiltVal) {
          this.elements.headTiltVal.textContent = `${preset.headTilt}°`;
        }
      }
    };
    
    // Available sound presets with categories
    this.presets = [
      { type: 'birds', name: () => t('birds'), emoji: '🐦', desc: 'Sweet forest chirping', category: 'nature' },
      { type: 'campfire', name: () => t('campfire'), emoji: '🪵', desc: 'Crackling fire', category: 'nature' },
      { type: 'rain', name: () => t('rain'), emoji: '🌧️', desc: 'Heavy thunderstorm rain', category: 'nature' },
      { type: 'thunder', name: () => t('thunder'), emoji: '⚡', desc: 'Rolling thunder', category: 'nature' },
      { type: 'waves', name: () => t('waves'), emoji: '🌊', desc: 'Gentle ocean waves', category: 'nature' },
      { type: 'crickets', name: () => t('crickets'), emoji: '🦗', desc: 'Summer night crickets', category: 'nature' },
      { type: 'cafe', name: () => t('cafe'), emoji: '☕', desc: 'Coffee house atmosphere', category: 'environment' },
      { type: 'train', name: () => t('train'), emoji: '🚂', desc: 'Passing train', category: 'environment' },
      { type: 'bell', name: () => t('bell'), emoji: '🔔', desc: 'Bright singing bowl tone', category: 'healing' },
      { type: 'gong', name: () => t('gong'), emoji: '🪘', desc: 'Deep gong strike', category: 'healing' },
      { type: 'singing-bowl', name: () => t('singingBowl'), emoji: '🥣', desc: 'Deep singing bowl', category: 'healing' },
      { type: 'wind-chimes', name: () => t('windChimes'), emoji: '🎐', desc: 'Gentle wind chimes', category: 'healing' },
      { type: 'city_traffic', name: () => t('cityTraffic'), emoji: '🚗', desc: 'Busy street ambience', category: 'environment' },
      { type: 'city_park', name: () => t('cityPark'), emoji: '🌳', desc: 'City park atmosphere', category: 'environment' },
      { type: 'subway', name: () => t('subway'), emoji: '🚇', desc: 'Underground station', category: 'environment' },
      { type: 'jungle_night', name: () => t('jungleNight'), emoji: '🌴', desc: 'Tropical jungle at night', category: 'nature' },
      { type: 'monkeys', name: () => t('monkeys'), emoji: '🐒', desc: 'Monkeys in the jungle', category: 'nature' },
      { type: 'elephant', name: () => t('elephant'), emoji: '🐘', desc: 'Elephant trumpeting', category: 'nature' },
      { type: 'leopard', name: () => t('leopard'), emoji: '🐆', desc: 'Leopard in the wild', category: 'nature' },
      { type: 'jungle_river', name: () => t('jungleRiver'), emoji: '🏞️', desc: 'Flowing jungle river', category: 'nature' },
      { type: 'tropical_birds', name: () => t('tropicalBirds'), emoji: '🦜', desc: 'Exotic tropical birds', category: 'nature' },
      { type: 'ocean_deep', name: () => t('oceanDeep'), emoji: '🌊', desc: 'Deep ocean ambience', category: 'nature' },
      { type: 'whales', name: () => t('whales'), emoji: '🐋', desc: 'Whale songs', category: 'nature' },
      { type: 'dolphins', name: () => t('dolphins'), emoji: '🐬', desc: 'Dolphin sounds', category: 'nature' },
      { type: 'underwater_ambient', name: () => t('underwaterAmbient'), emoji: '🫧', desc: 'Underwater atmosphere', category: 'nature' },
    ];

    this.instruments = [
      { type: 'piano', name: () => t('piano'), emoji: '🎹', desc: 'Soft piano tone' },
      { type: 'synth-pad', name: () => t('synthPad'), emoji: '🎛️', desc: 'Ambient synthesizer' },
      { type: 'bass', name: () => t('bass'), emoji: '🎸', desc: 'Deep bass tone' },
      { type: 'strings', name: () => t('strings'), emoji: '🎻', desc: 'String orchestra' },
      { type: 'flute', name: () => t('flute'), emoji: '🪈', desc: 'Gentle flute' },
      { type: 'bell-synth', name: () => t('bellSynth'), emoji: '🔔', desc: 'Synth bells' },
      { type: 'drone', name: () => t('drone'), emoji: '🕉️', desc: 'Meditative drone' },
      { type: 'arpeggio', name: () => t('arpeggio'), emoji: '✨', desc: 'Ascending tone sequence' },
    ];

    this.brainwaves = [
      { type: 'bw_alpha', name: 'Alpha (8-12Hz)', emoji: '🧘', desc: 'Relaxed focus', category: 'brainwaves', freq: 10, color: '#7c3aed' },
      { type: 'bw_beta', name: 'Beta (12-30Hz)', emoji: '⚡', desc: 'Active thinking', category: 'brainwaves', freq: 20, color: '#2563eb' },
      { type: 'bw_theta', name: 'Theta (4-8Hz)', emoji: '😴', desc: 'Deep meditation', category: 'brainwaves', freq: 6, color: '#0891b2' },
      { type: 'bw_delta', name: 'Delta (0.5-4Hz)', emoji: '💤', desc: 'Deep sleep', category: 'brainwaves', freq: 2, color: '#4f46e5' },
      { type: 'bw_gamma', name: 'Gamma (30-50Hz)', emoji: '✨', desc: 'Peak cognition', category: 'brainwaves', freq: 40, color: '#db2777' },
    ];

    this.chakraBowls = [
      { type: 'bowl_c', name: 'Root Chakra (C)', emoji: '🔴', desc: 'Muladhara · 256Hz · Grounding', note: 'C3', freq: 256 },
      { type: 'bowl_d', name: 'Sacral Chakra (D)', emoji: '🟠', desc: 'Svadhisthana · 288Hz · Creativity', note: 'D3', freq: 288 },
      { type: 'bowl_e', name: 'Solar Plexus (E)', emoji: '🟡', desc: 'Manipura · 320Hz · Power', note: 'E3', freq: 320 },
      { type: 'bowl_f', name: 'Heart Chakra (F)', emoji: '🟢', desc: 'Anahata · 341Hz · Love', note: 'F3', freq: 341 },
      { type: 'bowl_g', name: 'Throat Chakra (G)', emoji: '🔵', desc: 'Vishuddha · 384Hz · Truth', note: 'G3', freq: 384 },
      { type: 'bowl_a', name: 'Third Eye (A)', emoji: '🟣', desc: 'Ajna · 426Hz · Intuition', note: 'A3', freq: 426 },
      { type: 'bowl_b', name: 'Crown Chakra (B)', emoji: '⚪', desc: 'Sahasrara · 480Hz · Spirit', note: 'B3', freq: 480 },
    ];

    this.initCategoryLibraries();
    this.initEvents();
    this.showSelectedDetails(null); // start empty
  }

  /**
   * Render the preset cards in the library sidebar
   */
  initCategoryLibraries() {
    const categories = {
      instruments: [...this.instruments.map(p => ({...p, type: 'instr_' + p.type}))],
      healing: [
        ...this.presets.filter(p => p.category === 'healing'),
        ...this.chakraBowls,
      ],
      nature: this.presets.filter(p => p.category === 'nature'),
      environment: this.presets.filter(p => p.category === 'environment'),
      brainwaves: this.brainwaves,
      music: [],
    };

    for (const [cat, items] of Object.entries(categories)) {
      const container = document.getElementById('preset-list-' + cat);
      if (!container) continue;
      container.innerHTML = '';

      if (cat === 'music') {
        container.innerHTML = `<p class="section-help">Upload custom audio or use the file picker below.</p>`;
        continue;
      }

      items.forEach(p => {
        const card = document.createElement('div');
        card.className = 'preset-card';
        card.draggable = true;
        card.dataset.type = p.type;
        const name = typeof p.name === 'function' ? p.name() : p.name;
        card.innerHTML = `<div class="preset-icon">${p.emoji}</div><div class="preset-info"><div class="preset-name">${name}</div><div class="preset-desc">${p.desc}</div></div><button class="add-preset-btn">+</button>`;

        card.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', p.type); card.classList.add('dragging'); });
        card.addEventListener('dragend', () => card.classList.remove('dragging'));
        card.addEventListener('click', (e) => { if (e.target.closest('.add-preset-btn')) return; this.addPresetToRandomPosition(p.type); });
        card.querySelector('.add-preset-btn').addEventListener('click', (e) => { e.stopPropagation(); this.addPresetToRandomPosition(p.type); });
        container.appendChild(card);
      });
    }
  }

  /**
   * Helper to place a preset on the grid at a default coordinates
   */
  async addPresetToRandomPosition(type) {
    const angle = Math.random() * Math.PI * 2;
    const distance = 3 + Math.random() * 4;
    const x = parseFloat((distance * Math.cos(angle)).toFixed(1));
    const y = parseFloat((distance * Math.sin(angle)).toFixed(1));
    
    if (this.canvasGrid.callbacks.onNodeDropped) {
      await this.canvasGrid.callbacks.onNodeDropped(type, x, y);
    }
    
    if (this.canvasGrid.selectedNodeId) {
      const src = this.audioEngine.sources.get(this.canvasGrid.selectedNodeId);
      if (src) {
        this.showSelectedDetails(src);
      }
    }
  }

  initEvents() {
    initControlPanelEvents(this);
  }

  /**
   * Helper to set Play/Pause icon text
   */
  updatePlayPauseButton(isPlaying) {
    if (!this.elements.nodePlayToggle) return;
    if (isPlaying) {
      this.elements.nodePlayToggle.innerHTML = '<span>⏸</span> Pause';
      this.elements.nodePlayToggle.classList.remove('paused');
    } else {
      this.elements.nodePlayToggle.innerHTML = '<span>▶</span> Play';
      this.elements.nodePlayToggle.classList.add('paused');
    }
  }

  /**
   * Update sidebar panel with selected sound emitter parameters
   * @param {Object} node - Sound source data object
   */
  showSelectedDetails(node) {
    const detailsContainer = this.elements.selectedDetailsPanel;
    const emptyPlaceholder = this.elements.detailsEmptyState;
    const panelRight = this.elements.panelRight;
    
    if (!node) {
      if (detailsContainer) detailsContainer.style.display = 'none';
      if (emptyPlaceholder) emptyPlaceholder.style.display = 'flex';
      if (panelRight) panelRight.classList.add('panel-hidden');
      return;
    }
    
    if (emptyPlaceholder) emptyPlaceholder.style.display = 'none';
    if (detailsContainer) detailsContainer.style.display = 'block';
    if (panelRight) panelRight.classList.remove('panel-hidden');
    
    // Set text labels
    if (this.elements.nodeName) this.elements.nodeName.textContent = node.name;
    if (this.elements.nodeTypeLabel) {
      const typeText = node.type.startsWith('custom') ? t('customFile') : node.type.toUpperCase();
      this.elements.nodeTypeLabel.textContent = typeText;
    }
    
    // Update volume slider and text
    if (this.elements.nodeVolume) this.elements.nodeVolume.value = node.volume;
    if (this.elements.nodeVolumeVal) this.elements.nodeVolumeVal.textContent = `${Math.round(node.volume * 100)}%`;
    
    // Update height slider and text
    if (this.elements.nodeHeight) this.elements.nodeHeight.value = node.z;
    if (this.elements.nodeHeightVal) {
      this.elements.nodeHeightVal.textContent = `${node.z > 0 ? '+' : ''}${node.z.toFixed(1)}m`;
    }
    
    // Update ramp sliders
    if (this.elements.nodeRampup) this.elements.nodeRampup.value = node.rampUp || 0;
    if (this.elements.nodeRampupVal) this.elements.nodeRampupVal.textContent = (node.rampUp || 0) > 0 ? `${node.rampUp || 0}s` : '0s';
    if (this.elements.nodeRampdown) this.elements.nodeRampdown.value = node.rampDown || 0;
    if (this.elements.nodeRampdownVal) this.elements.nodeRampdownVal.textContent = (node.rampDown || 0) > 0 ? `${node.rampDown || 0}s` : '0s';
    if (this.elements.nodeRepeat) this.elements.nodeRepeat.value = node.repeatInterval || 0;
    if (this.elements.nodeRepeatVal) this.elements.nodeRepeatVal.textContent = (node.repeatInterval || 0) > 0 ? `${node.repeatInterval || 0}s` : 'off';

    // Update Play/Pause button visual
    this.updatePlayPauseButton(node.isPlaying);
    
    // Update position labels
    this.updateCoordLabels(node.x, node.y);
    
    // Update automation button active states
    const auto = this.canvasGrid.automations.get(node.id);
    if (this.elements.autoOrbitBtn) {
      if (auto && auto.type === 'orbit') {
        this.elements.autoOrbitBtn.classList.add('active');
      } else {
        this.elements.autoOrbitBtn.classList.remove('active');
      }
    }
    
    if (this.elements.autoPingpongBtn) {
      if (auto && auto.type === 'pingpong') {
        this.elements.autoPingpongBtn.classList.add('active');
      } else {
        this.elements.autoPingpongBtn.classList.remove('active');
      }
    }

    if (this.elements.autoDriftBtn) {
      if (auto && auto.type === 'drift') {
        this.elements.autoDriftBtn.classList.add('active');
      } else {
        this.elements.autoDriftBtn.classList.remove('active');
      }
    }

    if (this.elements.autoBreatheBtn) {
      if (auto && auto.type === 'breathe') {
        this.elements.autoBreatheBtn.classList.add('active');
      } else {
        this.elements.autoBreatheBtn.classList.remove('active');
      }
    }
  }

  /**
   * Update coordinate labels on panel
   */
  updateCoordLabels(x, y) {
    if (this.elements.nodeCoords) {
      const dirX = x > 0 ? t('east') : (x < 0 ? t('west') : t('center'));
      const dirY = y > 0 ? t('north') : (y < 0 ? t('south') : t('center'));
      
      this.elements.nodeCoords.innerHTML = `
        <div>X: <strong>${x > 0 ? '+' : ''}${x.toFixed(1)}m</strong> (${dirX})</div>
        <div>Y: <strong>${y > 0 ? '+' : ''}${y.toFixed(1)}m</strong> (${dirY})</div>
      `;
    }
  }
}
