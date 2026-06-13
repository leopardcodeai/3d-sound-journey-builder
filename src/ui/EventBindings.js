import { t, setLanguage, getLanguage } from '../i18n.js';
import { ACTIVITY_PRESETS, TEMPLATE_SCENES } from '../data/Presets.js';
import { SOUND_URLS } from '../data/SoundUrls.js';
import { SPEAKER_PRESETS } from '../audio/SpeakerConfig.js';

function getPresetName(type) {
  let key = type.replace('instr_', '');
  key = key.replace('bw_', '');
  if (key === 'music_speaker') return 'Music Speaker';
  return t(key) || type;
}

export function renderSceneList(sceneManager, controlPanel, canvasGrid) {
  const container = document.getElementById('scene-list');
  if (!container) return;
  const names = sceneManager.getSceneNames();
  container.innerHTML = names.map(name => `
    <div class="scene-item" data-scene="${name}">
      <span class="scene-name">${name}</span>
      <button class="scene-delete" data-scene="${name}">×</button>
    </div>
  `).join('');

  container.querySelectorAll('.scene-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.classList.contains('scene-delete')) return;
      const name = item.dataset.scene;
      sceneManager.loadScene(name);
      controlPanel.showSelectedDetails(null);
      canvasGrid.selectedNodeId = null;
    });
  });

  container.querySelectorAll('.scene-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      sceneManager.deleteScene(btn.dataset.scene);
      renderSceneList(sceneManager, controlPanel, canvasGrid);
    });
  });
}

export function renderCustomSpeakerList(speakerConfig) {
  const container = document.getElementById('custom-speaker-list');
  if (!container) return;
  container.innerHTML = speakerConfig.customSpeakers.map((sp, i) => `
    <div class="custom-speaker-item">
      <span>🔊 ${sp.label} (${sp.x.toFixed(1)}, ${sp.y.toFixed(1)})</span>
      <button class="speaker-remove-btn" data-index="${i}">×</button>
    </div>
  `).join('');
  container.querySelectorAll('.speaker-remove-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      speakerConfig.removeCustomSpeaker(parseInt(btn.dataset.index));
      renderCustomSpeakerList(speakerConfig);
    });
  });
}

export function bindEvents(elements, audioEngine, canvasGrid, controlPanel, timeline, sceneManager, soundscapeTimer, headTracker, speakerConfig, initAudioEngine) {
  function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      if (!key) return;
      if (el.tagName === 'INPUT' && (el.type === 'text' || el.type === 'search')) {
        el.placeholder = t(key);
      } else {
        const current = el.textContent || '';
        const match = current.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)\s*/u);
        const emoji = match ? match[0] : '';
        el.textContent = (emoji || '') + t(key);
      }
    });
    document.documentElement.lang = getLanguage();
  }

  // Timeline toggle
  document.getElementById('timeline-toggle-btn')?.addEventListener('click', () => {
    timeline.toggle();
    document.getElementById('timeline-toggle-btn')?.classList.toggle('active', timeline.visible);
  });

  // Activity preset buttons
  document.querySelectorAll('.activity-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.style.opacity = '0.5';
      try {
        const preset = ACTIVITY_PRESETS[btn.dataset.preset];
        if (!preset) { btn.disabled = false; btn.style.opacity = ''; return; }

        if (!audioEngine.isInitialized) {
          await initAudioEngine(false);
        }

        const prevName = t('customizedScene') + ' ' + btn.dataset.preset;
        sceneManager.saveScene(prevName);
        renderSceneList(sceneManager, controlPanel, canvasGrid);

        for (const id of Array.from(audioEngine.sources.keys())) {
          audioEngine.removeSource(id);
        }
        canvasGrid.automations.clear();
        canvasGrid.selectedNodeId = null;

        // Clear the previous journey before applying the preset's
        timeline.pause();
        timeline.playheadTime = 0;
        timeline.keyframes.clear();
        timeline.sourceTimings.clear();

        audioEngine.setMasterVolume(preset.masterVolume);
        if (preset.posture) {
          audioEngine.applyPosturePreset(preset.posture);
          if (elements.listenerPosture) {
            elements.listenerPosture.value = preset.posture;
          }
          document.querySelectorAll('.posture-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.posture === preset.posture);
          });
        }

        if (preset.totalDuration) {
          timeline.setTotalDuration(preset.totalDuration);
        }

        const neededTypes = [...new Set(preset.sources.map(s => s.type).filter(type => SOUND_URLS[type] && !audioEngine.buffers.has(type)))];
        if (neededTypes.length > 0) {
          await Promise.all(neededTypes.map(type => audioEngine.preloadSound(type, SOUND_URLS[type])));
        }

        preset.sources.forEach(s => {
          const src = audioEngine.addSource(s.id, s.type, s.name, s.x, s.y, s.z, s.volume);
          if (!src) {
            console.warn('Failed to add source:', s.id, s.type);
            return;
          }
          if (s.startTime !== undefined && s.duration !== undefined) {
            timeline.ensureTiming(s.id);
            const t = timeline.sourceTimings.get(s.id);
            if (t) {
              t.startTime = s.startTime;
              t.duration = s.duration;
            }
          }
        });

        if (preset.keyframes) {
          for (const [id, kfs] of Object.entries(preset.keyframes)) {
            timeline.setKeyframes(id, kfs);
          }
        }

        if (!timeline.visible && preset.sources.length > 1) {
          timeline.toggle();
          document.getElementById('timeline-toggle-btn')?.classList.add('active');
        } else if (timeline.visible) {
          timeline._render();
        }

        // Gate the sources to the journey at t=0 so what you hear matches the
        // playhead — without this every source plays at full volume immediately.
        timeline.playheadTime = 0;
        timeline._applyKeyframes();
        timeline._updatePlayhead();

        // A keyframed preset is a journey — start the transport so the playhead
        // moves with the sound instead of sitting paused while audio plays.
        if (preset.keyframes && Object.keys(preset.keyframes).length > 0) {
          timeline.play();
        }

        controlPanel.showSelectedDetails(null);
      } catch(e) {
        console.error('Preset load error:', e);
      }
      btn.disabled = false;
      btn.style.opacity = '';
    });
  });

  // Template scene buttons
  document.querySelectorAll('.scene-template-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const template = TEMPLATE_SCENES[btn.dataset.template];
      if (!template) return;

      const prevName = t('customizedScene') + ' ' + template.name;
      sceneManager.saveScene(prevName);
      renderSceneList(sceneManager, controlPanel, canvasGrid);

      for (const id of Array.from(audioEngine.sources.keys())) {
        audioEngine.removeSource(id);
      }
      canvasGrid.automations.clear();
      canvasGrid.selectedNodeId = null;

      // Clear timeline state
      timeline.pause();
      timeline.playheadTime = 0;
      timeline.keyframes.clear();
      timeline.sourceTimings.clear();

      const neededTypes = [...new Set(template.sources.map(s => s.type).filter(type => SOUND_URLS[type] && !audioEngine.buffers.has(type)))];
      if (neededTypes.length > 0) {
        await Promise.all(neededTypes.map(type => audioEngine.preloadSound(type, SOUND_URLS[type])));
      }

      audioEngine.setMasterVolume(template.masterVolume);
      template.sources.forEach(s => {
        audioEngine.addSource(s.id, s.type, s.name, s.x, s.y, s.z, s.volume);
        
        // Sync Timeline
        if (s.startTime !== undefined && s.duration !== undefined) {
          timeline.ensureTiming(s.id);
          const t = timeline.sourceTimings.get(s.id);
          if (t) {
            t.startTime = s.startTime;
            t.duration = s.duration;
          }
          timeline.addKeyframe(s.id, s.startTime || 0, { x: s.x, y: s.y, z: s.z, volume: s.volume });
        }
      });

      if (template.keyframes) {
        for (const [id, kfs] of Object.entries(template.keyframes)) {
          timeline.setKeyframes(id, kfs);
        }
      }

      if (template.totalDuration) {
        timeline.setTotalDuration(template.totalDuration);
      }

      if (!timeline.visible && template.sources.length > 1) {
        timeline.toggle();
        document.getElementById('timeline-toggle-btn')?.classList.add('active');
      } else if (timeline.visible) {
        timeline._render();
      }

      // Gate the sources to the journey at t=0 so what you hear matches the playhead
      timeline.playheadTime = 0;
      timeline._applyKeyframes();
      timeline._updatePlayhead();

      controlPanel.showSelectedDetails(null);
    });
  });

  // Head tracker button
  const headTrackerBtn = document.getElementById('head-tracker-btn');
  const headTrackerStatus = document.getElementById('head-tracker-status');
  if (headTrackerBtn && headTrackerStatus) {
    if (headTracker.isAvailable()) {
      headTrackerStatus.textContent = 'Available — on iOS: Safari, allow once';
      headTrackerBtn.addEventListener('click', async () => {
        if (!headTracker.active) {
          const granted = await headTracker.requestPermission();
          if (granted) {
            headTracker.start();
            headTracker.calibrate();
          } else {
            headTrackerStatus.textContent = 'Permission denied. Allow motion data in Safari settings.';
          }
        } else {
          headTracker.stop();
        }
      });
    } else {
      headTrackerStatus.textContent = 'Not available (only on mobile devices with sensors)';
    }
  }

  // Speaker config dropdown
  const speakerSelect = document.getElementById('speaker-config');
  const speakerDesc = document.getElementById('speaker-config-desc');
  const customControls = document.getElementById('custom-speaker-controls');
  if (speakerSelect) {
    speakerSelect.addEventListener('change', () => {
      const key = speakerSelect.value;
      speakerConfig.setConfig(key);
      const preset = SPEAKER_PRESETS[key];
      if (speakerDesc) speakerDesc.textContent = preset.description;
      if (customControls) customControls.style.display = key === 'custom' ? 'block' : 'none';
    });
  }

  // Add speaker button
  document.getElementById('add-speaker-btn')?.addEventListener('click', () => {
    const x = (Math.random() - 0.5) * 8;
    const y = (Math.random() - 0.5) * 8;
    const label = `S${speakerConfig.customSpeakers.length + 1}`;
    speakerConfig.addCustomSpeaker(x, y, 0, label);
    renderCustomSpeakerList(speakerConfig);
  });

  // Start button
  if (elements.startBtn) {
    elements.startBtn.addEventListener('click', async () => {
      elements.startBtn.disabled = true;
      elements.startBtn.textContent = t('loadingAudio');
      try {
        await initAudioEngine(true);
      } catch (err) {
        console.error('Error starting audio context:', err);
        elements.startBtn.disabled = false;
        elements.startBtn.textContent = t('retry');
      }
    });
  }

  // Start fresh button
  const startFreshBtn = document.getElementById('start-fresh-btn');
  if (startFreshBtn) {
    startFreshBtn.addEventListener('click', async () => {
      elements.startBtn.disabled = true;
      startFreshBtn.disabled = true;
      startFreshBtn.textContent = t('loadingAudio');
      try {
        await initAudioEngine(false);
      } catch (err) {
        console.error('Error starting audio context:', err);
        elements.startBtn.disabled = false;
        startFreshBtn.disabled = false;
        startFreshBtn.textContent = t('startFresh');
      }
    });
  }

  // New session button
  const newSessionBtn = document.getElementById('new-session-btn');
  if (newSessionBtn) {
    newSessionBtn.addEventListener('click', () => {
      for (const id of Array.from(audioEngine.sources.keys())) {
        audioEngine.removeSource(id);
      }
      canvasGrid.automations.clear();
      canvasGrid.selectedNodeId = null;
      controlPanel.showSelectedDetails(null);
    });
  }

  // Save scene button
  document.getElementById('save-scene-btn')?.addEventListener('click', () => {
    const name = prompt('Scene name:');
    if (name) {
      sceneManager.saveScene(name);
      renderSceneList(sceneManager, controlPanel, canvasGrid);
    }
  });

  // Share scene button
  document.getElementById('share-scene-btn')?.addEventListener('click', () => {
    const url = sceneManager.exportToURL();
    navigator.clipboard.writeText(url).then(() => {
      alert('Link copied to clipboard!');
    }).catch(() => {
      prompt('Copy this link:', url);
    });
  });

  // Header master volume
  if (elements.headerMasterVolume) {
    elements.headerMasterVolume.addEventListener('input', () => {
      const val = parseFloat(elements.headerMasterVolume.value);
      audioEngine.setMasterVolume(val);
      if (elements.headerMasterVolumeVal) {
        elements.headerMasterVolumeVal.textContent = Math.round(val * 100) + '%';
      }
      if (elements.masterVolume) elements.masterVolume.value = val;
      if (elements.masterVolumeVal) elements.masterVolumeVal.textContent = Math.round(val * 100) + '%';
    });
  }

  // Flyout master volume sync
  document.getElementById('master-volume')?.addEventListener('input', () => {
    const val = parseFloat(document.getElementById('master-volume').value);
    if (elements.headerMasterVolume) elements.headerMasterVolume.value = val;
    if (elements.headerMasterVolumeVal) elements.headerMasterVolumeVal.textContent = Math.round(val * 100) + '%';
  });

  // Canvas drag-and-drop
  const canvas = document.getElementById('soundscape-canvas');
  if (canvas) {
    canvas.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      canvas.style.cursor = 'copy';
    });
    canvas.addEventListener('dragleave', () => {
      canvas.style.cursor = '';
    });
    canvas.addEventListener('drop', (e) => {
      e.preventDefault();
      canvas.style.cursor = '';
      const type = e.dataTransfer.getData('text/plain');
      if (!type) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvasGrid.w / rect.width;
      const scaleY = canvasGrid.h / rect.height;
      const canvasX = (e.clientX - rect.left) * scaleX;
      const canvasY = (e.clientY - rect.top) * scaleY;
      const coords = canvasGrid.canvasToAudioCoords(canvasX, canvasY);
      canvasGrid.callbacks.onNodeDropped(type, coords.x, coords.y);
    });
  }

  // Toolbar flyouts (need openFlyout/closeAllFlyouts defined before use)
  const toolbarBtns = document.querySelectorAll('.toolbar-primary .toolbar-btn, .toolbar-secondary .toolbar-btn');
  const flyouts = document.querySelectorAll('.flyout');

  function openFlyout(name) {
    flyouts.forEach(f => f.classList.remove('open'));
    toolbarBtns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-expanded', 'false'); });
    const flyout = document.getElementById('flyout-' + name);
    const btn = document.querySelector(`[data-flyout="${name}"]`);
    if (flyout) flyout.classList.add('open');
    if (btn) { btn.classList.add('active'); btn.setAttribute('aria-expanded', 'true'); }
  }

  function closeAllFlyouts() {
    flyouts.forEach(f => f.classList.remove('open'));
    toolbarBtns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-expanded', 'false'); });
  }

  // Settings toggle
  document.getElementById('settings-btn')?.addEventListener('click', () => {
    const dropdown = document.getElementById('settings-dropdown');
    if (dropdown) {
      dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    }
  });

  // Settings close on outside click
  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('settings-dropdown');
    const btn = document.getElementById('settings-btn');
    if (dropdown && btn && !dropdown.contains(e.target) && !btn.contains(e.target)) {
      dropdown.style.display = 'none';
    }
  });

  // Canvas click dismiss
  document.getElementById('soundscape-canvas')?.addEventListener('click', (e) => {
    closeAllFlyouts();
    const dropdown = document.getElementById('settings-dropdown');
    if (dropdown) dropdown.style.display = 'none';
  });

  // Posture & head tilt controls
  if (elements.listenerPosture) {
    elements.listenerPosture.addEventListener('change', () => {
      const posture = elements.listenerPosture.value;
      audioEngine.applyPosturePreset(posture);
      document.querySelectorAll('.posture-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.posture === posture);
      });
      if (elements.postureHeadTilt) elements.postureHeadTilt.value = audioEngine.headTilt;
      if (elements.postureHeadTiltVal) elements.postureHeadTiltVal.textContent = audioEngine.headTilt + '°';
      if (elements.postureShoulderWidth) elements.postureShoulderWidth.value = audioEngine.shoulderStrength;
      if (elements.postureShoulderWidthVal) elements.postureShoulderWidthVal.textContent = audioEngine.shoulderStrength.toFixed(2);
      if (elements.posturePinnaSize) elements.posturePinnaSize.value = audioEngine.pinnaStrength;
      if (elements.posturePinnaSizeVal) elements.posturePinnaSizeVal.textContent = audioEngine.pinnaStrength.toFixed(2);
    });
  }

  if (elements.headTilt) {
    elements.headTilt.addEventListener('input', () => {
      const tilt = parseInt(elements.headTilt.value);
      if (elements.headTiltVal) elements.headTiltVal.textContent = tilt + '°';
      const posture = elements.listenerPosture ? elements.listenerPosture.value : 'standing';
      audioEngine.updateListenerPose(posture, tilt);
      const pTilt = document.getElementById('posture-head-tilt');
      const pTiltVal = document.getElementById('posture-head-tilt-val');
      if (pTilt) { pTilt.value = tilt; }
      if (pTiltVal) { pTiltVal.textContent = tilt + '°'; }
    });
  }

  // Posture flyout controls
  if (elements.postureHeadTilt) {
    elements.postureHeadTilt.addEventListener('input', () => {
      const tilt = parseInt(elements.postureHeadTilt.value);
      if (elements.postureHeadTiltVal) elements.postureHeadTiltVal.textContent = tilt + '°';
      const posture = elements.listenerPosture ? elements.listenerPosture.value : 'standing';
      audioEngine.updateListenerPose(posture, tilt);
      if (elements.headTilt) { elements.headTilt.value = tilt; }
      if (elements.headTiltVal) { elements.headTiltVal.textContent = tilt + '°'; }
    });
  }

  if (elements.postureShoulderWidth) {
    elements.postureShoulderWidth.addEventListener('input', () => {
      const v = parseFloat(elements.postureShoulderWidth.value).toFixed(2);
      if (elements.postureShoulderWidthVal) elements.postureShoulderWidthVal.textContent = v;
      canvasGrid.shoulderWidth = parseFloat(v);
    });
  }

  if (elements.posturePinnaSize) {
    elements.posturePinnaSize.addEventListener('input', () => {
      const v = parseFloat(elements.posturePinnaSize.value).toFixed(2);
      if (elements.posturePinnaSizeVal) elements.posturePinnaSizeVal.textContent = v;
      canvasGrid.pinnaSize = parseFloat(v);
    });
  }

  if (elements.postureListenerX) {
    elements.postureListenerX.addEventListener('input', () => {
      const v = parseFloat(elements.postureListenerX.value);
      if (elements.postureListenerXVal) elements.postureListenerXVal.textContent = v.toFixed(1);
      audioEngine.listenerX = v;
    });
  }

  if (elements.postureListenerY) {
    elements.postureListenerY.addEventListener('input', () => {
      const v = parseFloat(elements.postureListenerY.value);
      if (elements.postureListenerYVal) elements.postureListenerYVal.textContent = v.toFixed(1);
      audioEngine.listenerY = v;
    });
  }

  // Posture buttons
  document.querySelectorAll('.posture-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      try {
        document.querySelectorAll('.posture-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const posture = btn.dataset.posture;
        audioEngine.applyPosturePreset(posture);
        if (elements.listenerPosture) {
          elements.listenerPosture.value = posture;
        }
        if (elements.postureHeadTilt) elements.postureHeadTilt.value = audioEngine.headTilt;
        if (elements.postureHeadTiltVal) elements.postureHeadTiltVal.textContent = audioEngine.headTilt + '°';
        if (elements.postureShoulderWidth) elements.postureShoulderWidth.value = audioEngine.shoulderStrength;
        if (elements.postureShoulderWidthVal) elements.postureShoulderWidthVal.textContent = audioEngine.shoulderStrength.toFixed(2);
        if (elements.posturePinnaSize) elements.posturePinnaSize.value = audioEngine.pinnaStrength;
        if (elements.posturePinnaSizeVal) elements.posturePinnaSizeVal.textContent = audioEngine.pinnaStrength.toFixed(2);
      } catch(e) {
        console.error('Posture change error:', e);
      }
    });
  });

  // Toolbar flyout buttons
  toolbarBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.flyout;
      const flyout = document.getElementById('flyout-' + name);
      if (flyout && flyout.classList.contains('open')) {
        closeAllFlyouts();
      } else {
        openFlyout(name);
      }
    });
  });

  document.querySelectorAll('.flyout-close').forEach(btn => {
    btn.addEventListener('click', () => closeAllFlyouts());
  });

  // Default: open instruments flyout
  openFlyout('instruments');

  // Panel close button
  document.getElementById('panel-right-close')?.addEventListener('click', () => {
    const panelRight = document.getElementById('panel-right');
    panelRight?.classList.add('panel-hidden');
    if (controlPanel) {
      controlPanel.canvasGrid.selectedNodeId = null;
      controlPanel.showSelectedDetails(null);
    }
  });

  // Language select
  const langSelect = document.getElementById('lang-select');
  if (langSelect) {
    langSelect.value = getLanguage();
    langSelect.addEventListener('change', () => {
      setLanguage(langSelect.value);
      applyTranslations();
      if (controlPanel) {
        controlPanel.renderAllPresets('all');
      }
    });
  }

  // Apply i18n on load
  applyTranslations();

  // Initial render of scene list
  renderSceneList(sceneManager, controlPanel, canvasGrid);

  // Mobile tab bar
  const mobileTabs = document.querySelectorAll('.mobile-tab');
  const panelRight = document.getElementById('panel-right');
  mobileTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      mobileTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const panel = tab.dataset.panel;
      closeAllFlyouts();
      if (panel === 'sounds') openFlyout('instruments');
      if (panel === 'details') {
        if (panelRight && controlPanel) {
          if (panelRight.classList.contains('panel-hidden') && canvasGrid.selectedNodeId) {
            panelRight.classList.remove('panel-hidden');
          }
        }
      }
    });
  });

  // Swipe-to-dismiss for mobile floating panels
  let touchStartY = 0;
  document.querySelectorAll('.floating-panel').forEach(panel => {
    panel.addEventListener('touchstart', (e) => {
      touchStartY = e.touches[0].clientY;
    }, { passive: true });
    panel.addEventListener('touchmove', (e) => {
      const delta = e.touches[0].clientY - touchStartY;
      if (delta > 30 && panel.scrollTop <= 0) {
        panel.style.transform = `translateY(${delta}px)`;
      }
    }, { passive: true });
    panel.addEventListener('touchend', (e) => {
      const delta = e.changedTouches[0].clientY - touchStartY;
      if (delta > 80) {
        if (panel.classList.contains('panel-right')) {
          panel.classList.add('panel-hidden');
          if (controlPanel) {
            controlPanel.canvasGrid.selectedNodeId = null;
            controlPanel.showSelectedDetails(null);
          }
        }
      }
      panel.style.transform = '';
    });
  });

  // Slider fill track
  function updateSliderFill(slider) {
    const min = parseFloat(slider.min) || 0;
    const max = parseFloat(slider.max) || 100;
    const val = parseFloat(slider.value) || 0;
    const pct = ((val - min) / (max - min)) * 100;
    slider.style.setProperty('--fill', pct + '%');
  }
  document.querySelectorAll('input[type="range"]').forEach(s => {
    updateSliderFill(s);
    s.addEventListener('input', () => updateSliderFill(s));
  });
}
