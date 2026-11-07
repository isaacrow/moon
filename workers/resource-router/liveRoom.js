// One live room per record (a Cloudflare Durable Object). Everyone who has the record open in Moon
// Studio keeps a WebSocket to it; the room tells each of them who is there, and passes pointer and
// field messages between them (see liveRoomCore.js for exactly what may pass).
//
// It uses the hibernation API: between messages the room sleeps and costs nothing, and its sockets
// stay open. Pings are answered by Cloudflare without waking it. Each socket carries its peer
// ({ id, u, at }) as an attachment, so the room knows who is who after it wakes.
// The Worker (index.js) has already checked the cataloger's live ticket before a request gets here,
// and only the Worker can reach the room, so the X-Live-User header can be trusted.

import { MAX_PEERS, allowMessage, parseClientMessage, relayed, welcome } from './liveRoomCore.js';

export class LiveRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.rates = new Map(); // peer id → rate window; lost when the room sleeps, which is fine
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"t":"ping"}', '{"t":"pong"}'));
  }

  peers() {
    const list = [];
    for (const ws of this.ctx.getWebSockets()) {
      const p = ws.deserializeAttachment();
      if (p && p.id) list.push({ ws, peer: p });
    }
    return list;
  }

  send(ws, message) {
    try { ws.send(JSON.stringify(message)); } catch { /* already closed */ }
  }

  broadcast(message, exceptId) {
    for (const { ws, peer } of this.peers()) if (peer.id !== exceptId) this.send(ws, message);
  }

  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
    const username = request.headers.get('X-Live-User') || '';
    if (!username) return new Response('Forbidden', { status: 403 });
    const current = this.peers();
    if (current.length >= MAX_PEERS) return new Response('This record\'s live room is full', { status: 503 });

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const peer = { id: crypto.randomUUID().slice(0, 8), u: username, at: Date.now() };
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(peer);
    this.send(server, welcome(peer, current.map((c) => c.peer)));
    this.broadcast({ t: 'join', peer }, peer.id);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, data) {
    const peer = ws.deserializeAttachment();
    if (!peer || typeof data !== 'string') return;
    let rate = this.rates.get(peer.id);
    if (!rate) { rate = {}; this.rates.set(peer.id, rate); }
    if (!allowMessage(rate, Date.now())) return;
    const message = parseClientMessage(data);
    if (message) this.broadcast(relayed(peer.id, message), peer.id);
  }

  async webSocketClose(ws) {
    this.left(ws);
    try { ws.close(1000, 'bye'); } catch { /* already closed */ }
  }

  async webSocketError(ws) {
    this.left(ws);
  }

  left(ws) {
    const peer = ws.deserializeAttachment();
    if (!peer || !peer.id) return;
    this.rates.delete(peer.id);
    try { ws.serializeAttachment(null); } catch { /* closed: it drops out of getWebSockets anyway */ }
    this.broadcast({ t: 'leave', id: peer.id }, peer.id);
  }
}
