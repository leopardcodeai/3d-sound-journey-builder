/**
 * Saving and sharing without window.prompt.
 *
 * prompt() is the one dialog a web app cannot style, it is refused in some
 * embedded contexts, and on a phone it looks like it belongs to another app.
 * So a scene gets a name from an inline field or a sensible default, and a
 * link goes through the platform's own share sheet where the device has one,
 * the clipboard where it does not, and a visible box as the last resort.
 * Nothing here blocks the page.
 */

/** A name that reads as a moment, unique among the ones already taken. */
export function defaultSceneName(existing = [], now = new Date()) {
  const taken = new Set(existing);
  const day = now.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  const time = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const stamp = `${day} ${time}`;
  let name = stamp;
  let n = 2;
  while (taken.has(name)) name = `${stamp} (${n++})`;
  return name;
}

/**
 * Hands a link to the user by the best means available.
 *
 * @returns 'shared' when the share sheet took it, 'cancelled' when the user
 * closed that sheet, 'copied' when it went to the clipboard, and 'shown' when
 * the caller has to display it, because nothing else was possible.
 */
export async function shareLink(url, { nav, title = 'Sound Journey', preferSheet = false } = {}) {
  const n = nav || (typeof navigator !== 'undefined' ? navigator : null);
  if (preferSheet && n && typeof n.share === 'function') {
    try {
      await n.share({ title, url });
      return 'shared';
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancelled';
      // Anything else: fall through to the clipboard.
    }
  }
  if (n && n.clipboard && typeof n.clipboard.writeText === 'function') {
    try {
      await n.clipboard.writeText(url);
      return 'copied';
    } catch (e) { /* no permission here; show it instead */ }
  }
  return 'shown';
}
