import { t } from '../i18n.js';
import { createDeleteCommand, createVolumeCommand } from '../core/UndoManager.js';

export function initControlPanelEvents(cp) {
  document.querySelectorAll('.section-title').forEach(title => {
    title.addEventListener('click', () => {
      const section = title.closest('.sidebar-section');
      if (section) {
        section.classList.toggle('collapsed');
        title.classList.toggle('collapsed');
      }
    });
  });

  const toggle3dBtn = document.getElementById('toggle-3d-btn');
  if (toggle3dBtn) {
    toggle3dBtn.addEventListener('click', () => {
      cp.canvasGrid.viewMode = cp.canvasGrid.viewMode === '2d' ? '3d' : '2d';
      toggle3dBtn.textContent = cp.canvasGrid.viewMode === '3d' ? '3D' : '2D';
      toggle3dBtn.classList.toggle('active', cp.canvasGrid.viewMode === '3d');
      cp.canvasGrid.resetView();
    });
  }

  const resetViewBtn = document.getElementById('reset-view-btn');
  if (resetViewBtn) {
    resetViewBtn.addEventListener('click', () => {
      cp.canvasGrid.resetView();
    });
  }

  const orientNorthBtn = document.getElementById('orient-north-btn');
  if (orientNorthBtn) {
    orientNorthBtn.addEventListener('click', () => {
      cp.canvasGrid.flyTo(cp.canvasGrid._targetPitch, 0, cp.canvasGrid._targetZoom, 0, 0, 300);
    });
  }

  const editSpeakersBtn = document.getElementById('edit-speakers-btn');
  if (editSpeakersBtn) {
    editSpeakersBtn.addEventListener('click', () => {
      const isSpeakerLayer = cp.canvasGrid.editLayer === 'speakers';
      cp.canvasGrid.editLayer = isSpeakerLayer ? 'sources' : 'speakers';
      editSpeakersBtn.classList.toggle('active', !isSpeakerLayer);
      editSpeakersBtn.textContent = isSpeakerLayer ? '✋ Edit Speakers' : '✋ Editing Speakers...';
      cp.canvasGrid.selectedNodeId = null;
      cp.showSelectedDetails(null);
    });
  }

  const presetSearch = document.getElementById('preset-search');
  if (presetSearch) {
    presetSearch.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      document.querySelectorAll('#preset-list .preset-card').forEach(card => {
        const name = card.querySelector('.preset-name')?.textContent.toLowerCase() || '';
        const desc = card.querySelector('.preset-desc')?.textContent.toLowerCase() || '';
        card.style.display = (name.includes(query) || desc.includes(query)) ? '' : 'none';
      });
    });
  }

  if (cp.elements.masterVolume) {
    cp.elements.masterVolume.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      cp.audioEngine.setMasterVolume(val);
      if (cp.elements.masterVolumeVal) {
        cp.elements.masterVolumeVal.textContent = `${Math.round(val * 100)}%`;
      }
    });
  }

  if (cp.elements.clearAllBtn) {
    cp.elements.clearAllBtn.addEventListener('click', () => {
      for (const id of Array.from(cp.audioEngine.sources.keys())) {
        cp.audioEngine.removeSource(id);
      }
      cp.canvasGrid.selectedNodeId = null;
      cp.canvasGrid.automations.clear();
      cp.showSelectedDetails(null);
    });
  }

  if (cp.elements.masterMuteBtn) {
    cp.elements.masterMuteBtn.addEventListener('click', () => {
      const muted = cp.audioEngine.toggleMasterMute();
      if (muted) {
        cp.elements.masterMuteBtn.innerHTML = '🔊 ' + t('unmute');
        cp.elements.masterMuteBtn.classList.add('muted');
      } else {
        cp.elements.masterMuteBtn.innerHTML = '🔇 ' + t('mute');
        cp.elements.masterMuteBtn.classList.remove('muted');
      }
    });
  }

  if (cp.elements.fileInput) {
    let pendingBuffer = null;
    let pendingFileName = '';
    let selectedEmoji = '🎵';

    cp.elements.fileInput.addEventListener('change', (e) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const file = files[0];
      const type = 'custom_' + Date.now();
      const reader = new FileReader();

      const uploadLabel = document.querySelector('.file-upload-label');
      if (uploadLabel) uploadLabel.textContent = t('decoding');

      reader.onload = async (event) => {
        const arrayBuffer = event.target.result;

        try {
          if (!cp.audioEngine.isInitialized) {
            cp.audioEngine.init();
          }

          const decodedBuffer = await cp.audioEngine.ctx.decodeAudioData(arrayBuffer);
          cp.audioEngine.addAudioBuffer(type, decodedBuffer);

          cp.canvasGrid.themeColors[type] = '#f43f5e';

          pendingBuffer = decodedBuffer;
          pendingFileName = file.name.replace(/\.[^/.]+$/, '').substring(0, 18);
          selectedEmoji = '🎵';
          document.querySelectorAll('.emoji-option').forEach(b => b.classList.remove('selected'));
          const defaultEmojiBtn = document.querySelector('.emoji-option');
          if (defaultEmojiBtn) defaultEmojiBtn.classList.add('selected');
          const nameInput = document.getElementById('custom-name-input');
          if (nameInput) nameInput.value = pendingFileName;
          const form = document.getElementById('custom-upload-form');
          if (form) { form.style.display = 'flex'; form.dataset.pendingType = type; }

          if (uploadLabel) uploadLabel.innerHTML = '📂 ' + t('ownFile');
        } catch (err) {
          console.error('Error decoding custom audio file:', err);
          alert(t('decodeError'));
          if (uploadLabel) uploadLabel.innerHTML = '📂 ' + t('ownFile');
        }
      };

      reader.readAsArrayBuffer(file);
    });

    document.getElementById('custom-upload-confirm')?.addEventListener('click', () => {
      const type = document.getElementById('custom-upload-form')?.dataset.pendingType;
      if (!type || !pendingBuffer) return;
      const name = document.getElementById('custom-name-input')?.value || pendingFileName;

      cp.audioEngine.addAudioBuffer(type, pendingBuffer);
      cp.canvasGrid.themeColors[type] = '#f43f5e';

      const angle = Math.random() * Math.PI * 2;
      const x = parseFloat((3 * Math.cos(angle)).toFixed(1));
      const y = parseFloat((3 * Math.sin(angle)).toFixed(1));
      const id = 'source_' + Date.now();
      const source = cp.audioEngine.addSource(id, type, name, x, y, 0, 0.6);

      if (source) {
        cp.canvasGrid.selectedNodeId = id;
        cp.showSelectedDetails(source);
      }

      document.getElementById('custom-upload-form').style.display = 'none';
      pendingBuffer = null;
    });

    document.getElementById('custom-upload-cancel')?.addEventListener('click', () => {
      document.getElementById('custom-upload-form').style.display = 'none';
      pendingBuffer = null;
    });

    document.querySelectorAll('.emoji-option').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.emoji-option').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedEmoji = btn.textContent;
      });
    });
  }

  if (cp.elements.nodeVolume) {
    cp.elements.nodeVolume.addEventListener('input', (e) => {
      const id = cp.canvasGrid.selectedNodeId;
      if (!id) return;
      const val = parseFloat(e.target.value);
      cp.audioEngine.updateSourceVolume(id, val);
      if (cp.elements.nodeVolumeVal) {
        cp.elements.nodeVolumeVal.textContent = `${Math.round(val * 100)}%`;
      }
    });

    cp.elements.nodeVolume.addEventListener('change', (e) => {
      const id = cp.canvasGrid.selectedNodeId;
      if (!id) return;
      const newVolume = parseFloat(e.target.value);
      const node = cp.audioEngine.sources.get(id);
      if (!node) return;

      if (cp.undoManager) {
        cp.undoManager.execute(createVolumeCommand(cp.audioEngine, id, node.volume, newVolume));
      }
    });
  }

  if (cp.elements.nodeHeight) {
    cp.elements.nodeHeight.addEventListener('input', (e) => {
      const id = cp.canvasGrid.selectedNodeId;
      if (!id) return;
      const val = parseFloat(e.target.value);
      const node = cp.audioEngine.sources.get(id);
      if (node) {
        cp.audioEngine.updateSourcePosition(id, node.x, node.y, val);
        if (cp.elements.nodeHeightVal) {
          cp.elements.nodeHeightVal.textContent = `${val > 0 ? '+' : ''}${val.toFixed(1)}m`;
        }
      }
    });
  }

  if (cp.elements.nodeRampup) {
    cp.elements.nodeRampup.addEventListener('input', (e) => {
      const id = cp.canvasGrid.selectedNodeId;
      if (!id) return;
      const val = parseFloat(e.target.value);
      if (cp.elements.nodeRampupVal) cp.elements.nodeRampupVal.textContent = val > 0 ? `${val}s` : '0s';
      const node = cp.audioEngine.sources.get(id);
      if (node) {
        cp.audioEngine.setSourceRamp(id, val, node.rampDown || 0, node.repeatInterval || 0);
      }
    });
  }

  if (cp.elements.nodeRampdown) {
    cp.elements.nodeRampdown.addEventListener('input', (e) => {
      const id = cp.canvasGrid.selectedNodeId;
      if (!id) return;
      const val = parseFloat(e.target.value);
      if (cp.elements.nodeRampdownVal) cp.elements.nodeRampdownVal.textContent = val > 0 ? `${val}s` : '0s';
      const node = cp.audioEngine.sources.get(id);
      if (node) {
        cp.audioEngine.setSourceRamp(id, node.rampUp || 0, val, node.repeatInterval || 0);
      }
    });
  }

  if (cp.elements.nodeRepeat) {
    cp.elements.nodeRepeat.addEventListener('input', (e) => {
      const id = cp.canvasGrid.selectedNodeId;
      if (!id) return;
      const val = parseFloat(e.target.value);
      if (cp.elements.nodeRepeatVal) cp.elements.nodeRepeatVal.textContent = val > 0 ? `${val}s` : 'off';
      const node = cp.audioEngine.sources.get(id);
      if (node) {
        cp.audioEngine.setSourceRamp(id, node.rampUp || 0, node.rampDown || 0, val);
      }
    });
  }

  if (cp.elements.nodePlayToggle) {
    cp.elements.nodePlayToggle.addEventListener('click', () => {
      const id = cp.canvasGrid.selectedNodeId;
      if (!id) return;

      const isPlaying = cp.audioEngine.toggleSource(id);
      cp.updatePlayPauseButton(isPlaying);
    });
  }

  if (cp.elements.nodeDelete) {
    cp.elements.nodeDelete.addEventListener('click', () => {
      const id = cp.canvasGrid.selectedNodeId;
      if (!id) return;

      const node = cp.audioEngine.sources.get(id);
      if (!node) return;

      const sourceData = {
        id: node.id,
        type: node.type,
        name: node.name,
        x: node.x,
        y: node.y,
        z: node.z,
        volume: node.volume
      };

      if (cp.undoManager) {
        cp.undoManager.execute(createDeleteCommand(cp.audioEngine, cp.canvasGrid, sourceData, cp.timeline));
      } else {
        cp.audioEngine.removeSource(id);
        cp.canvasGrid.automations.delete(id);
        cp.canvasGrid.selectedNodeId = null;
        cp.showSelectedDetails(null);

        // Sync Timeline
        if (cp.timeline) {
          cp.timeline.sourceTimings.delete(id);
          cp.timeline.keyframes.delete(id);
          if (cp.timeline.visible) {
            cp.timeline._render();
          }
        }
      }
    });
  }

  if (cp.elements.autoOrbitBtn) {
    cp.elements.autoOrbitBtn.addEventListener('click', () => {
      const id = cp.canvasGrid.selectedNodeId;
      if (!id) return;

      const active = cp.canvasGrid.automations.has(id) && cp.canvasGrid.automations.get(id).type === 'orbit';
      if (active) {
        cp.canvasGrid.setAutomation(id, 'orbit', false);
        cp.elements.autoOrbitBtn.classList.remove('active');
      } else {
        cp.canvasGrid.setAutomation(id, 'orbit', true);
        cp.canvasGrid.setAutomation(id, 'pingpong', false);
        cp.canvasGrid.setAutomation(id, 'drift', false);
        cp.canvasGrid.setAutomation(id, 'breathe', false);
        cp.elements.autoOrbitBtn.classList.add('active');
        if (cp.elements.autoPingpongBtn) cp.elements.autoPingpongBtn.classList.remove('active');
        if (cp.elements.autoDriftBtn) cp.elements.autoDriftBtn.classList.remove('active');
        if (cp.elements.autoBreatheBtn) cp.elements.autoBreatheBtn.classList.remove('active');
      }
    });
  }

  if (cp.elements.autoPingpongBtn) {
    cp.elements.autoPingpongBtn.addEventListener('click', () => {
      const id = cp.canvasGrid.selectedNodeId;
      if (!id) return;

      const active = cp.canvasGrid.automations.has(id) && cp.canvasGrid.automations.get(id).type === 'pingpong';
      if (active) {
        cp.canvasGrid.setAutomation(id, 'pingpong', false);
        cp.elements.autoPingpongBtn.classList.remove('active');
      } else {
        cp.canvasGrid.setAutomation(id, 'pingpong', true);
        cp.canvasGrid.setAutomation(id, 'orbit', false);
        cp.canvasGrid.setAutomation(id, 'drift', false);
        cp.canvasGrid.setAutomation(id, 'breathe', false);
        cp.elements.autoPingpongBtn.classList.add('active');
        if (cp.elements.autoOrbitBtn) cp.elements.autoOrbitBtn.classList.remove('active');
        if (cp.elements.autoDriftBtn) cp.elements.autoDriftBtn.classList.remove('active');
        if (cp.elements.autoBreatheBtn) cp.elements.autoBreatheBtn.classList.remove('active');
      }
    });
  }

  if (cp.elements.autoDriftBtn) {
    cp.elements.autoDriftBtn.addEventListener('click', () => {
      const id = cp.canvasGrid.selectedNodeId;
      if (!id) return;
      const active = cp.canvasGrid.automations.has(id) && cp.canvasGrid.automations.get(id).type === 'drift';
      if (active) {
        cp.canvasGrid.setAutomation(id, 'drift', false);
        cp.elements.autoDriftBtn.classList.remove('active');
      } else {
        cp.canvasGrid.setAutomation(id, 'drift', true);
        ['orbit','pingpong','breathe'].forEach(t => cp.canvasGrid.setAutomation(id, t, false));
        cp.elements.autoDriftBtn.classList.add('active');
        ['autoOrbitBtn','autoPingpongBtn','autoBreatheBtn'].forEach(k => {
          if (cp.elements[k]) cp.elements[k].classList.remove('active');
        });
      }
    });
  }

  if (cp.elements.autoBreatheBtn) {
    cp.elements.autoBreatheBtn.addEventListener('click', () => {
      const id = cp.canvasGrid.selectedNodeId;
      if (!id) return;
      const active = cp.canvasGrid.automations.has(id) && cp.canvasGrid.automations.get(id).type === 'breathe';
      if (active) {
        cp.canvasGrid.setAutomation(id, 'breathe', false);
        cp.elements.autoBreatheBtn.classList.remove('active');
      } else {
        cp.canvasGrid.setAutomation(id, 'breathe', true);
        ['orbit','pingpong','drift'].forEach(t => cp.canvasGrid.setAutomation(id, t, false));
        cp.elements.autoBreatheBtn.classList.add('active');
        ['autoOrbitBtn','autoPingpongBtn','autoDriftBtn'].forEach(k => {
          if (cp.elements[k]) cp.elements[k].classList.remove('active');
        });
      }
    });
  }

  if (cp.elements.listenerPosture) {
    cp.elements.listenerPosture.addEventListener('change', (e) => {
      const posture = e.target.value;
      cp.audioEngine.applyPosturePreset(posture);
      cp._userOverrideShoulder = false;
      cp._userOverridePinna = false;
    });
  }

  if (cp.elements.headTilt) {
    cp.elements.headTilt.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      const posture = cp.elements.listenerPosture?.value || 'standing';
      cp.audioEngine.updateListenerPose(posture, val);
      if (cp.elements.headTiltVal) {
        cp.elements.headTiltVal.textContent = `${val}°`;
      }
    });
  }

  if (cp.elements.shoulderStrength) {
    cp.elements.shoulderStrength.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      cp.audioEngine.updateShoulderStrength(val);
      cp._userOverrideShoulder = true;
      if (cp.elements.shoulderStrengthVal) {
        cp.elements.shoulderStrengthVal.textContent = `${Math.round(val * 100)}%`;
      }
    });
  }

  if (cp.elements.pinnaStrength) {
    cp.elements.pinnaStrength.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      cp.audioEngine.updatePinnaStrength(val);
      cp._userOverridePinna = true;
      if (cp.elements.pinnaStrengthVal) {
        cp.elements.pinnaStrengthVal.textContent = `${Math.round(val * 100)}%`;
      }
    });
  }

  if (cp.elements.listenerX) {
    cp.elements.listenerX.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (cp.elements.listenerXVal) cp.elements.listenerXVal.textContent = val.toFixed(1);
      cp.audioEngine.listenerX = val;
    });
  }
  if (cp.elements.listenerY) {
    cp.elements.listenerY.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (cp.elements.listenerYVal) cp.elements.listenerYVal.textContent = val.toFixed(1);
      cp.audioEngine.listenerY = val;
    });
  }

  const presetButtons = document.querySelectorAll('.timer-preset-btn');
  const cancelBtn = document.getElementById('timer-cancel-btn');
  const timerDisplay = document.getElementById('timer-display');

  presetButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!cp.timer) return;
      const minutes = parseInt(btn.dataset.minutes, 10);

      presetButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      if (cancelBtn) cancelBtn.style.display = 'block';
      if (timerDisplay) timerDisplay.textContent = `${minutes}:00`;

      cp.timer.start(minutes);
    });
  });

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      if (!cp.timer) return;

      cp.timer.stop();

      presetButtons.forEach((b) => b.classList.remove('active'));
      if (cancelBtn) cancelBtn.style.display = 'none';
      if (timerDisplay) timerDisplay.textContent = '--:--';
    });
  }
}
