// Live cursors: where the other catalogers' pointers are, pinned to fields instead of screen pixels.
// A pointer is sent as "the field under it" (its data-live-field key) plus where inside that field
// (0..1 across, 0..1 down). Each browser finds the same field on its own page and puts the arrow
// there, so it lands on the same field whatever the screen size, zoom, scroll or RTL/LTR.
// Kept free of React and the DOM (except the two small helpers at the end) so the tests can run it.

export interface RemoteCursor {
  f: string; // field key, or ROOT_FIELD for "somewhere in the editor"
  x: number;
  y: number;
  at: number; // when it last moved (ms)
}

export const ROOT_FIELD = 'editor';
export const SEND_GAP_MS = 50; // at most 20 positions a second
export const IDLE_FADE_MS = 30_000; // a pointer that has not moved for half a minute fades out

/** The cursors after one room message. `cursor` moves one, `hide` and `leave` remove one. */
export function applyCursorMessage(cursors: Record<string, RemoteCursor>, msg: any, now: number): Record<string, RemoteCursor> {
  if (!msg || typeof msg.id !== 'string') return cursors;
  if (msg.t === 'cursor' && typeof msg.f === 'string' && typeof msg.x === 'number' && typeof msg.y === 'number') {
    return { ...cursors, [msg.id]: { f: msg.f, x: clamp01(msg.x), y: clamp01(msg.y), at: now } };
  }
  if ((msg.t === 'hide' || msg.t === 'leave') && cursors[msg.id]) {
    const next = { ...cursors };
    delete next[msg.id];
    return next;
  }
  return cursors;
}

export const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

/** Where a point falls inside a box, as fractions, rounded so messages stay small. */
export function toFraction(rect: { left: number; top: number; width: number; height: number }, clientX: number, clientY: number) {
  const fx = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
  const fy = rect.height > 0 ? (clientY - rect.top) / rect.height : 0;
  return { x: Math.round(clamp01(fx) * 1000) / 1000, y: Math.round(clamp01(fy) * 1000) / 1000 };
}

/** The point on this screen for fractions inside a box. */
export function fromFraction(rect: { left: number; top: number; width: number; height: number }, x: number, y: number) {
  return { x: rect.left + x * rect.width, y: rect.top + y * rect.height };
}

/** Whether to send a new position: not more than every SEND_GAP_MS, and only when it changed. */
export function shouldSend(last: { f: string; x: number; y: number; at: number } | null, next: { f: string; x: number; y: number }, now: number): boolean {
  if (!last) return true;
  if (now - last.at < SEND_GAP_MS) return false;
  return last.f !== next.f || last.x !== next.x || last.y !== next.y;
}

export interface SpringState { x: number; y: number; vx: number; vy: number }

/**
 * One step of a soft spring towards the target, for smooth "human" movement of the arrow.
 * `lag` (0..1) makes the name pill trail a little behind the arrow.
 */
export function springStep(s: SpringState, tx: number, ty: number, dtMs: number, stiffness = 260, damping = 26): SpringState {
  const dt = Math.min(dtMs, 32) / 1000; // a slow frame never makes it jump or overshoot
  const ax = stiffness * (tx - s.x) - damping * s.vx;
  const ay = stiffness * (ty - s.y) - damping * s.vy;
  const vx = s.vx + ax * dt;
  const vy = s.vy + ay * dt;
  const x = s.x + vx * dt;
  const y = s.y + vy * dt;
  // Close enough: settle exactly, so idle arrows stop costing frames.
  if (Math.abs(tx - x) < 0.3 && Math.abs(ty - y) < 0.3 && Math.abs(vx) < 5 && Math.abs(vy) < 5) return { x: tx, y: ty, vx: 0, vy: 0 };
  return { x, y, vx, vy };
}

export const isSettled = (s: SpringState, tx: number, ty: number) => s.x === tx && s.y === ty && s.vx === 0 && s.vy === 0;

/** How visible an arrow is: full while moving, fading over 2 s once idle for IDLE_FADE_MS. */
export function cursorOpacity(lastMoved: number, now: number): number {
  const idle = now - lastMoved - IDLE_FADE_MS;
  return idle <= 0 ? 1 : Math.max(0, 1 - idle / 2000);
}

// ---- DOM helpers ----

/** The field (or the whole editor) under a pointer, as { key, element }; null outside the editor. */
export function anchorAt(target: EventTarget | null): { key: string; el: Element } | null {
  if (!(target instanceof Element)) return null;
  const root = target.closest('[data-live-root]');
  if (!root) return null;
  const field = target.closest('[data-live-field]');
  if (field && root.contains(field)) return { key: field.getAttribute('data-live-field') || ROOT_FIELD, el: field };
  return { key: ROOT_FIELD, el: root };
}

/** The element on this page for a field key; null when that field is not shown here (e.g. folded away). */
export function findAnchor(key: string): Element | null {
  const root = document.querySelector('[data-live-root]');
  if (!root) return null;
  if (key === ROOT_FIELD) return root;
  for (const el of root.querySelectorAll('[data-live-field]')) if (el.getAttribute('data-live-field') === key) return el;
  return null;
}
