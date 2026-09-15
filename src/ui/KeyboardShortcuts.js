/**
 * KeyboardShortcuts
 * Global keys for the field view. Ignored while a text field has focus.
 */
import { t } from '../i18n.js';

export function initKeyboardShortcuts({ canvasGrid, audioEngine, undoManager, timeline, inspector, onToggleView, onToast }) {
  const toast = (msg) => { if (onToast) onToast(msg); };

  function isTyping() {
    const el = document.activeElement;
    return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
  }

  function refresh() {
    if (timeline) timeline._render();
    if (inspector) inspector.show(canvasGrid.selectedNodeId ? audioEngine.sources.get(canvasGrid.selectedNodeId) : null);
  }

  document.addEventListener('keydown', (e) => {
    if (isTyping()) return;
    const cmd = e.metaKey || e.ctrlKey;

    if (cmd && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault();
      if (undoManager && undoManager.canUndo) { undoManager.undo(); refresh(); toast(t('undo')); }
      return;
    }
    if (cmd && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
      e.preventDefault();
      if (undoManager && undoManager.canRedo) { undoManager.redo(); refresh(); toast(t('redo')); }
      return;
    }

    switch (e.key) {
      case 'Delete':
      case 'Backspace': {
        e.preventDefault();
        const id = canvasGrid.selectedNodeId;
        if (!id) return;
        audioEngine.removeSource(id);
        canvasGrid.automations.delete(id);
        canvasGrid.selectedNodeId = null;
        refresh();
        toast(t('removeSound'));
        return;
      }
      case ' ': {
        e.preventDefault();
        if (timeline && timeline.visible) { timeline.togglePlay(); toast(timeline.isPlaying ? t('play') : t('pause')); return; }
        const id = canvasGrid.selectedNodeId;
        if (id) toast(audioEngine.toggleSource(id) ? t('play') : t('pause'));
        return;
      }
      case 'Escape':
        canvasGrid.selectedNodeId = null;
        if (inspector) inspector.show(null);
        document.querySelectorAll('.drawer.is-open').forEach(d => { d.hidden = true; d.classList.remove('is-open'); });
        return;
      case 'Tab':
        if (onToggleView) { e.preventDefault(); onToggleView(); }
        return;
      case '2': canvasGrid.setViewMode('2d'); toast('2D'); return;
      case '3': canvasGrid.setViewMode('3d'); toast('3D'); return;
      case '0': canvasGrid.resetView(); toast(t('reset')); return;
      case '+': case '=': canvasGrid._targetZoom = Math.min(3.2, canvasGrid._targetZoom * 1.2); return;
      case '-': canvasGrid._targetZoom = Math.max(0.35, canvasGrid._targetZoom / 1.2); return;
      case 'ArrowLeft': e.preventDefault(); nudge(canvasGrid, audioEngine, -0.25, 0); return;
      case 'ArrowRight': e.preventDefault(); nudge(canvasGrid, audioEngine, 0.25, 0); return;
      case 'ArrowUp': e.preventDefault(); nudge(canvasGrid, audioEngine, 0, 0.25); return;
      case 'ArrowDown': e.preventDefault(); nudge(canvasGrid, audioEngine, 0, -0.25); return;
      default:
        if (e.key.toLowerCase() === 'k' && timeline && canvasGrid.selectedNodeId) {
          timeline.addKeyframeAt(canvasGrid.selectedNodeId, timeline.playheadTime);
          toast(t('addKeyframe'));
        }
    }
  });
}

/** Arrow keys move the selected sound, or pan the camera when nothing is selected. */
function nudge(canvasGrid, audioEngine, dx, dy) {
  const id = canvasGrid.selectedNodeId;
  const node = id ? audioEngine.sources.get(id) : null;
  if (!node || node.spatial === false) {
    canvasGrid._targetPanX -= dx * 120;
    canvasGrid._targetPanY += dy * 120;
    return;
  }
  audioEngine.updateSourcePosition(id, clamp(node.x + dx), clamp(node.y + dy), node.z);
  if (canvasGrid.callbacks.onNodeMoved) canvasGrid.callbacks.onNodeMoved(node);
}

function clamp(v) { return Math.max(-10, Math.min(10, Math.round(v * 100) / 100)); }
