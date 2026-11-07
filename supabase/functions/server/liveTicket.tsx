// 🟢 Live tickets: the Moon server signs a 60-second pass that lets a signed-in cataloger join the live
// room of one record (the Cloudflare Worker at wss://mooon.site/live/records/:id checks it). Same
// format as workers/resource-router/liveTicket.js: `<payload>.<signature>`, base64url, HMAC-SHA256 with
// the LIVE_TICKET_SECRET both sides share. test/liveRoom.test.ts checks the two copies agree.

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** True when the secret is long enough to use. Without it, live editing is off. */
export function liveTicketsEnabled(secret: string | undefined | null): secret is string {
  return typeof secret === 'string' && secret.length >= 16;
}

export async function signLiveTicket(
  secret: string,
  opts: { username: string; recordId: string; ttlSeconds?: number; now?: number },
): Promise<string> {
  const exp = Math.floor((opts.now ?? Date.now()) / 1000) + (opts.ttlSeconds ?? 60);
  const payload = b64url(enc.encode(JSON.stringify({ v: 1, u: opts.username, r: opts.recordId, exp })));
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(payload)));
  return `${payload}.${b64url(sig)}`;
}

/** Where the browser connects. */
export function liveRoomUrl(recordId: string): string {
  return `wss://mooon.site/live/records/${encodeURIComponent(recordId)}`;
}
