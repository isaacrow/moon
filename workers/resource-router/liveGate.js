// The door to the live rooms: wss://mooon.site/live/records/<record id>?ticket=<live ticket>.
// Only a Moon Studio page on mooon.site with a fresh ticket for this record gets through; the
// ticket comes from the Moon server (POST /records/:id/live-ticket) and names the cataloger.

import { verifyLiveTicket } from './liveTicket.js';
import { isRoomId } from './liveRoomCore.js';

const ALLOWED_ORIGINS = ['https://mooon.site'];

export async function handleLive(request, env, now = Date.now()) {
  const url = new URL(request.url);
  const match = /^\/live\/records\/([^/]+)$/.exec(url.pathname);
  if (!match) return new Response('Not found', { status: 404 });
  let recordId;
  try { recordId = decodeURIComponent(match[1]); } catch { return new Response('Not found', { status: 404 }); }
  if (!isRoomId(recordId)) return new Response('Not found', { status: 404 });
  if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET' } });
  if ((request.headers.get('Upgrade') || '').toLowerCase() !== 'websocket') {
    return new Response('This address is for live editing in Moon Studio', { status: 426, headers: { Upgrade: 'websocket' } });
  }
  const extra = (env.LIVE_EXTRA_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const origin = request.headers.get('Origin') || '';
  if (![...ALLOWED_ORIGINS, ...extra].includes(origin)) return new Response('Forbidden', { status: 403 });
  if (!env.LIVE_ROOM) return new Response('Live editing is not set up yet', { status: 503 });

  const check = await verifyLiveTicket(env.LIVE_TICKET_SECRET, url.searchParams.get('ticket'), recordId, now);
  if (!check.ok) return new Response(`Forbidden: ${check.reason}`, { status: 403 });

  const headers = new Headers(request.headers);
  headers.set('X-Live-User', check.username);
  const room = env.LIVE_ROOM.get(env.LIVE_ROOM.idFromName(recordId));
  return room.fetch(new Request(`https://live.internal/records/${encodeURIComponent(recordId)}`, { method: 'GET', headers }));
}
