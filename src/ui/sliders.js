/**
 * Range inputs paint their filled portion from a CSS custom property, so it
 * has to be refreshed whenever a value changes or new markup appears.
 */
export function setRangeFill(el) {
  if (!el || el.type !== 'range') return;
  const min = parseFloat(el.min) || 0;
  const max = parseFloat(el.max);
  const value = parseFloat(el.value);
  const pct = Number.isFinite(max) && max > min ? ((value - min) / (max - min)) * 100 : 0;
  el.style.setProperty('--fill', `${Math.max(0, Math.min(100, pct))}%`);
}

export function syncRangeFills(root) {
  const scope = root || (typeof document !== 'undefined' ? document : null);
  if (!scope || !scope.querySelectorAll) return;
  scope.querySelectorAll('input[type="range"]').forEach(setRangeFill);
}

/**
 * Keep every range in a subtree painted, including ones added later. One
 * delegated listener beats wiring each control.
 */
export function watchRangeFills(root) {
  const scope = root || document;
  syncRangeFills(scope);
  scope.addEventListener('input', (e) => {
    if (e.target && e.target.type === 'range') setRangeFill(e.target);
  }, true);
}
