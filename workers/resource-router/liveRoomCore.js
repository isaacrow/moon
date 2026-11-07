// The rules of a record's live room, kept apart from Cloudflare so the tests can run them in Node.
// The room (liveRoom.js) only passes on a few small message types, cleaned of anything else, so one
// cataloger's browser can never send another's page anything but a pointer position or a field name.
//
// Browser → room:   { t: 'cursor', f: fieldKey, x: 0..1, y: 0..1 }   pointer over a field
//                   { t: 'focus', f: fieldKey }  /  { t: 'blur', f?: fieldKey }
//                   { t: 'ping' }   (answered by the room without waking it)
// Room → browser:   { t: 'welcome', self: Peer, peers: Peer[] }   on joining
//                   { t: 'join', peer: Peer }  /  { t: 'leave', id }
//                   { t: 'cursor' | 'focus' | 'blur', id, ...the cleaned fields }
// Peer = { id, u: username, at: joined (ms) }. The same person in two tabs is two peers.

export const MAX_MESSAGE_CHARS = 1024;
export const MAX_PEERS = 24;
export const RATE_PER_SECOND = 30;

const FIELD_KEY = /^[\p{L}\p{N}_.:#\[\]\/-]{1,160}$/u;

const unit = (n) => (typeof n === 'number' && Number.isFinite(n) ? Math.min(1, Math.max(0, Math.round(n * 10000) / 10000)) : null);
const fieldKey = (f) => (typeof f === 'string' && FIELD_KEY.test(f) ? f : null);

/** A record id as it may appear in a room address. */
export function isRoomId(id) {
  return typeof id === 'string' && /^[A-Za-z0-9_.:-]{1,200}$/.test(id);
}

/** Reads one message from a browser; null for anything the room does not pass on. */
export function parseClientMessage(text) {
  if (typeof text !== 'string' || text.length > MAX_MESSAGE_CHARS) return null;
  let m;
  try { m = JSON.parse(text); } catch { return null; }
  if (!m || typeof m !== 'object' || Array.isArray(m)) return null;
  if (m.t === 'cursor') {
    const f = fieldKey(m.f), x = unit(m.x), y = unit(m.y);
    return f && x !== null && y !== null ? { t: 'cursor', f, x, y } : null;
  }
  if (m.t === 'focus') {
    const f = fieldKey(m.f);
    return f ? { t: 'focus', f } : null;
  }
  if (m.t === 'blur') {
    const f = m.f === undefined ? undefined : fieldKey(m.f);
    return f === null ? null : (f ? { t: 'blur', f } : { t: 'blur' });
  }
  return null;
}

/** What the others receive: the cleaned message plus who sent it. */
export function relayed(fromId, message) {
  return { ...message, id: fromId };
}

export function welcome(self, others) {
  return { t: 'welcome', self, peers: others };
}

/** A simple per-connection limit: at most RATE_PER_SECOND messages in any one-second window. */
export function allowMessage(state, now) {
  if (!state.windowStart || now - state.windowStart >= 1000) {
    state.windowStart = now;
    state.count = 0;
  }
  state.count += 1;
  return state.count <= RATE_PER_SECOND;
}
