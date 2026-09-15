/**
 * KeyboardShortcuts
 * Global keys for the field view. Ignored while a text field has focus.
 */
import { t } from '../i18n.js';

/**
 * The shortcuts, in the order they are shown. Kept in this file and directly
 * above the handler that implements them, so the two cannot drift apart
 * unnoticed. Until this list existed the app had fifteen keys and no way at
 * all to find out about them.
 *
 * `keys` is what the sheet prints; `mod` marks the ones that take the platform
 * modifier, so macOS shows the command symbol and everything else Ctrl.
 */
export const SHORTCUTS = [
  { group: 'shortcutsEditing', keys: ['Z'], mod: true, labelKey: 'undo' },
  { group: 'shortcutsEditing', keys: ['\u21e7', 'Z'], mod: true, labelKey: 'redo' },
  { group: 'shortcutsEditing', keys: ['Delete'], labelKey: 'removeSound' },
  { group: 'shortcutsEditing', keys: ['K'], labelKey: 'addKeyframe' },
  { group: 'shortcutsEditing', keys: ['\u2190', '\u2192', '\u2191', '\u2193'], labelKey: 'shortcutNudge' },

  { group: 'shortcutsPlayback', keys: ['Space'], labelKey: 'shortcutPlay' },

  { group: 'shortcutsView', keys: ['2'], labelKey: 'shortcut2d' },
  { group: 'shortcutsView', keys: ['3'], labelKey: 'shortcut3d' },
  { group: 'shortcutsView', keys: ['0'], labelKey: 'reset' },
  { group: 'shortcutsView', keys: ['+', '\u2212'], labelKey: 'shortcutZoom' },
  { group: 'shortcutsView', keys: ['V'], labelKey: 'shortcutSwitchView' },
  { group: 'shortcutsView', keys: ['Esc'], labelKey: 'shortcutEscape' },
  { group: 'shortcutsView', keys: ['?'], labelKey: 'shortcutSheet' },
];

/** Groups in display order. */
export const SHORTCUT_GROUPS = ['shortcutsEditing', 'shortcutsPlayback', 'shortcutsView'];

export function initKeyboardShortcuts({ canvasGrid, audioEngine, undoManager, timeline, inspector, onToggleView, onToast, onShowShortcuts }) {
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
        // Route through the inspector so the deletion lands on the undo stack
        // with the source's parameters, rather than vanishing outright.
        if (inspector && inspector.nodeId === id) inspector._remove();
        else {
          audioEngine.removeSource(id);
          canvasGrid.automations.delete(id);
          canvasGrid.selectedNodeId = null;
        }
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
      case 'Escape': {
        const sheet = document.getElementById('shortcuts-overlay');
        if (sheet && !sheet.hidden) { sheet.hidden = true; sheet.classList.remove('is-visible'); return; }
        canvasGrid.selectedNodeId = null;
        if (inspector) inspector.show(null);
        document.querySelectorAll('.drawer.is-open').forEach(d => { d.hidden = true; d.classList.remove('is-open'); });
        return;
      }
      // Not Tab. Tab is how a keyboard reaches the next control, and taking it
      // meant focus never moved once anything was focused: isTyping() only
      // exempts text fields, and in this app a button holds focus nearly all
      // the time. Every named button and labelled slider in here was useless
      // to someone not using a mouse.
      case 'v':
      case 'V':
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
      case '?':
        if (onShowShortcuts) { e.preventDefault(); onShowShortcuts(); }
        return;
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
