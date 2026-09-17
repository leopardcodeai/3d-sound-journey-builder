import { describe, it, expect, vi } from 'vitest';
import { initKeyboardShortcuts, SHORTCUTS } from './KeyboardShortcuts.js';

/**
 * Tab used to switch the view, unconditionally. The guard beside it only
 * exempts text fields, and in this app a button holds focus nearly all of the
 * time, so focus never moved: every named button and labelled slider added for
 * keyboard and screen-reader users was unreachable without a mouse. The view
 * switch lives on V now and Tab is left to the browser.
 */
function harness() {
  const calls = { toggleView: 0, toasts: [] };
  const canvasGrid = {
    selectedNodeId: null, setViewMode: vi.fn(), resetView: vi.fn(),
    _targetZoom: 1, getNode: () => null, callbacks: {},
  };
  const audioEngine = { sources: new Map(), toggleSource: vi.fn(), removeSource: vi.fn(), updateSourcePosition: vi.fn() };
  calls.audioEngine = audioEngine;
  initKeyboardShortcuts({
    canvasGrid,
    audioEngine,
    undoManager: { undo: vi.fn(), redo: vi.fn(), push: vi.fn(), execute: vi.fn((cmd) => cmd.execute()) },
    timeline: { isPlaying: false, play: vi.fn(), pause: vi.fn(), addKeyframe: vi.fn(), visible: false },
    inspector: { render: vi.fn() },
    onToggleView: () => { calls.toggleView += 1; },
    onToast: (m) => calls.toasts.push(m),
    onShowShortcuts: vi.fn(),
  });
  return { calls, canvasGrid };
}

const press = (key, target) => {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  (target || document.body).dispatchEvent(e);
  return e;
};

describe('keyboard shortcuts leave the browser its own keys', () => {
  it('does not swallow Tab, so focus can still move', () => {
    const { calls } = harness();
    const button = document.createElement('button');
    document.body.appendChild(button);
    button.focus();
    const e = press('Tab', button);
    expect(e.defaultPrevented, 'Tab must reach the browser').toBe(false);
    expect(calls.toggleView).toBe(0);
    button.remove();
  });

  it('switches the view on V instead', () => {
    const { calls } = harness();
    press('v');
    expect(calls.toggleView).toBe(1);
    press('V');
    expect(calls.toggleView).toBe(2);
  });

  it('leaves V alone while text is being typed', () => {
    const { calls } = harness();
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    press('v', input);
    expect(calls.toggleView).toBe(0);
    input.remove();
  });

  it('nudges a selected sound as an undoable move', () => {
    // An arrow key used to write straight to the engine, the one way to move
    // a sound that neither undo nor the journey's keyframes knew about.
    const { calls, canvasGrid } = harness();
    calls.audioEngine.sources.set('a', { id: 'a', x: 0, y: 0, z: 0, spatial: true });
    canvasGrid.selectedNodeId = 'a';
    press('ArrowRight');
    expect(calls.audioEngine.updateSourcePosition).toHaveBeenCalledWith('a', 0.25, 0, 0);
  });

  it('documents the key it actually uses', () => {
    const row = SHORTCUTS.find(s => s.labelKey === 'shortcutSwitchView');
    expect(row.keys).toEqual(['V']);
    expect(SHORTCUTS.some(s => s.keys.includes('Tab'))).toBe(false);
  });
});
