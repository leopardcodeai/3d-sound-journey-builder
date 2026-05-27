export function initKeyboardShortcuts({ canvasGrid, audioEngine, controlPanel, undoManager }) {
  function showToast(message) {
    let toast = document.getElementById('kb-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'kb-toast';
      toast.className = 'kb-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => { toast.classList.remove('visible'); }, 1500);
  }

  function isInputFocused() {
    const el = document.activeElement;
    return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
  }

  document.addEventListener('keydown', (e) => {
    if (isInputFocused()) return;

    const cmd = e.metaKey || e.ctrlKey;

    if (cmd && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      if (undoManager?.canUndo) { undoManager.undo(); showToast('↩ Undo'); }
      return;
    }
    if (cmd && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault();
      if (undoManager?.canRedo) { undoManager.redo(); showToast('↪ Redo'); }
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      const id = canvasGrid?.selectedNodeId;
      if (id) {
        audioEngine?.removeSource(id);
        canvasGrid?.automations.delete(id);
        canvasGrid.selectedNodeId = null;
        controlPanel?.showSelectedDetails(null);
        showToast('🗑️ Node deleted');
      }
      return;
    }
    if (e.key === ' ') {
      e.preventDefault();
      const id = canvasGrid?.selectedNodeId;
      if (id) {
        const playing = audioEngine?.toggleSource(id);
        showToast(playing ? '▶ Playing' : '⏸ Paused');
      }
      return;
    }
    if (e.key === 'Escape') {
      canvasGrid.selectedNodeId = null;
      controlPanel?.showSelectedDetails(null);
      document.querySelectorAll('.flyout').forEach(f => f.classList.remove('open'));
      document.querySelectorAll('.toolbar-btn').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-expanded', 'false'); });
      const dd = document.getElementById('settings-dropdown');
      if (dd) dd.style.display = 'none';
      showToast('✕ Cleared');
      return;
    }
    if (e.key === 'ArrowLeft') { e.preventDefault(); canvasGrid._targetPanX += 40; showToast('← Pan'); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); canvasGrid._targetPanX -= 40; showToast('→ Pan'); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); canvasGrid._targetPanY += 40; showToast('↑ Pan'); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); canvasGrid._targetPanY -= 40; showToast('↓ Pan'); return; }
    if (e.key === '=' || e.key === '+') { e.preventDefault(); canvasGrid._targetZoom = Math.min(3, canvasGrid._targetZoom * 1.2); showToast('🔍+ Zoom'); return; }
    if (e.key === '-') { e.preventDefault(); canvasGrid._targetZoom = Math.max(0.3, canvasGrid._targetZoom / 1.2); showToast('🔍- Zoom'); return; }
    if (e.key === '0') { e.preventDefault(); canvasGrid?.resetView(); showToast('🏠 Reset view'); return; }
    if (e.key === 'n' || e.key === 'N') { e.preventDefault(); canvasGrid?.flyTo(canvasGrid._targetPitch, 0, canvasGrid._targetZoom, 0, 0, 300); showToast('🧭 North'); return; }
    if (e.key === '2') { e.preventDefault(); canvasGrid.viewMode = '2d'; canvasGrid.resetView(); showToast('2D View'); return; }
    if (e.key === '3') { e.preventDefault(); canvasGrid.viewMode = '3d'; canvasGrid.resetView(); showToast('3D View'); return; }
  });
}
