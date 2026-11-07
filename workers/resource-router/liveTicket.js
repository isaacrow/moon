// Live tickets: a short pass the Moon server gives a signed-in cataloger so they may join the live room
// of one record. The ticket is `<payload>.<signature>`, both base64url; the payload is JSON
// { v: 1, u: username, r: record id, exp: seconds since 1970 }, signed with HMAC-SHA256 and the
// LIVE_TICKET_SECRET that only the Moon server and this Worker know. The server's copy of the signing
// code is supabase/functions/server/liveTicket.tsx; test/liveRoom.test.ts checks the two agree.

const enc = new TextEncoder();

function b64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(text) {
  const s = text.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

/** Signs a ticket (used by the tests; the Moon server has its own copy). */
export async function signLiveTicket(secret, { username, recordId, ttlSeconds = 60, now = Date.now() }) {
  const payload = b64url(enc.encode(JSON.stringify({ v: 1, u: username, r: recordId, exp: Math.floor(now / 1000) + ttlSeconds })));
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(payload)));
  return `${payload}.${b64url(sig)}`;
}

/**
 * Checks a ticket for one record. Returns { ok: true, username } or { ok: false, reason }.
 * Refuses when the secret is missing, the signature is wrong, the ticket is for another record,
 * or it has expired.
 */
export async function verifyLiveTicket(secret, ticket, recordId, now = Date.now()) {
  if (!secret || secret.length < 16) return { ok: false, reason: 'live editing is off' };
  if (typeof ticket !== 'string' || ticket.length > 2048) return { ok: false, reason: 'no ticket' };
  const dot = ticket.indexOf('.');
  if (dot < 1 || dot !== ticket.lastIndexOf('.')) return { ok: false, reason: 'bad ticket' };
  const payload = ticket.slice(0, dot);
  let sig;
  try { sig = fromB64url(ticket.slice(dot + 1)); } catch { return { ok: false, reason: 'bad ticket' }; }
  const good = await crypto.subtle.verify('HMAC', await hmacKey(secret), sig, enc.encode(payload));
  if (!good) return { ok: false, reason: 'bad signature' };
  let data;
  try { data = JSON.parse(new TextDecoder().decode(fromB64url(payload))); } catch { return { ok: false, reason: 'bad ticket' }; }
  if (!data || data.v !== 1 || typeof data.u !== 'string' || !data.u || typeof data.r !== 'string') return { ok: false, reason: 'bad ticket' };
  if (data.r !== recordId) return { ok: false, reason: 'ticket is for another record' };
  if (typeof data.exp !== 'number' || data.exp * 1000 < now) return { ok: false, reason: 'ticket expired' };
  return { ok: true, username: data.u };
}
