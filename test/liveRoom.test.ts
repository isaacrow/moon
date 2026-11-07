import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signLiveTicket as serverSign, liveTicketsEnabled, liveRoomUrl } from '../supabase/functions/server/liveTicket.tsx';
// @ts-ignore plain JS module from the Cloudflare Worker
import { verifyLiveTicket, signLiveTicket as workerSign } from '../workers/resource-router/liveTicket.js';
// @ts-ignore plain JS module from the Cloudflare Worker
import { parseClientMessage, allowMessage, isRoomId, RATE_PER_SECOND, MAX_MESSAGE_CHARS } from '../workers/resource-router/liveRoomCore.js';
// @ts-ignore plain JS module from the Cloudflare Worker
import { handleLive } from '../workers/resource-router/liveGate.js';
import { applyLiveMessage, emptyLiveState, otherPeople, reconnectDelay } from '../src/app/utils/livePeers.ts';

const SECRET = 'test-secret-0123456789abcdef';
const RECORD = '3f2a9c1e-1111-4b2b-9c9c-0123456789ab';
const NOW = Date.UTC(2026, 10, 7, 12, 0, 0);

test('a ticket signed by the Moon server opens the room for that record', async () => {
  const ticket = await serverSign(SECRET, { username: 'mara', recordId: RECORD, now: NOW });
  assert.deepEqual(await verifyLiveTicket(SECRET, ticket, RECORD, NOW + 30_000), { ok: true, username: 'mara' });
  // The two copies of the signing code produce the same ticket.
  assert.equal(ticket, await workerSign(SECRET, { username: 'mara', recordId: RECORD, now: NOW }));
  assert.equal(liveRoomUrl(RECORD), `wss://mooon.site/live/records/${RECORD}`);
});

test('Arabic usernames survive the ticket', async () => {
  const ticket = await serverSign(SECRET, { username: 'مريم', recordId: RECORD, now: NOW });
  assert.deepEqual(await verifyLiveTicket(SECRET, ticket, RECORD, NOW), { ok: true, username: 'مريم' });
});

test('forged, expired, wrong-record and missing-secret tickets are refused', async () => {
  const ticket = await serverSign(SECRET, { username: 'mara', recordId: RECORD, now: NOW });
  assert.equal((await verifyLiveTicket('another-secret-0123456789', ticket, RECORD, NOW)).ok, false);
  assert.equal((await verifyLiveTicket(SECRET, ticket, RECORD, NOW + 61_000)).reason, 'ticket expired');
  assert.equal((await verifyLiveTicket(SECRET, ticket, 'other-record', NOW)).reason, 'ticket is for another record');
  assert.equal((await verifyLiveTicket('', ticket, RECORD, NOW)).reason, 'live editing is off');
  assert.equal((await verifyLiveTicket('short', ticket, RECORD, NOW)).reason, 'live editing is off');
  // Changing the name inside the ticket breaks the signature.
  const [payload, sig] = ticket.split('.');
  const json = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
  json.u = 'isaac';
  const forged = Buffer.from(JSON.stringify(json)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  assert.equal((await verifyLiveTicket(SECRET, `${forged}.${sig}`, RECORD, NOW)).reason, 'bad signature');
  for (const bad of [null, '', 'nodot', 'a.b.c', `${payload}.!!!`]) {
    assert.equal((await verifyLiveTicket(SECRET, bad, RECORD, NOW)).ok, false);
  }
  assert.equal(liveTicketsEnabled(undefined), false);
  assert.equal(liveTicketsEnabled('0123456789abcdef'), true);
});

test('the room passes on only cleaned pointer and field messages', () => {
  assert.deepEqual(parseClientMessage('{"t":"cursor","f":"bf:title","x":0.123456,"y":1.7,"html":"<b>"}'), { t: 'cursor', f: 'bf:title', x: 0.1235, y: 1 });
  assert.deepEqual(parseClientMessage('{"t":"focus","f":"contribution[0]/agent"}'), { t: 'focus', f: 'contribution[0]/agent' });
  assert.deepEqual(parseClientMessage('{"t":"blur"}'), { t: 'blur' });
  assert.deepEqual(parseClientMessage('{"t":"focus","f":"العنوان"}'), { t: 'focus', f: 'العنوان' });
  for (const bad of [
    '{"t":"cursor","f":"bf:title","x":"1","y":0}',
    '{"t":"cursor","f":"<script>","x":0,"y":0}',
    '{"t":"focus","f":""}',
    '{"t":"blur","f":"a b"}',
    '{"t":"welcome","self":{}}',
    '{"t":"join"}',
    '[1,2]',
    'not json',
    JSON.stringify({ t: 'focus', f: 'x'.repeat(MAX_MESSAGE_CHARS) }),
  ]) assert.equal(parseClientMessage(bad), null, bad);
});

test('each connection may send at most the set number of messages per second', () => {
  const state: any = {};
  let allowed = 0;
  for (let i = 0; i < RATE_PER_SECOND + 10; i++) if (allowMessage(state, 1000 + i)) allowed++;
  assert.equal(allowed, RATE_PER_SECOND);
  assert.equal(allowMessage(state, 2001), true);
});

test('room ids', () => {
  assert.equal(isRoomId(RECORD), true);
  assert.equal(isRoomId('../etc'), false);
  assert.equal(isRoomId(''), false);
});

function liveRequest(path: string, headers: Record<string, string>) {
  return { url: `https://mooon.site${path}`, method: 'GET', headers: new Headers(headers) } as unknown as Request;
}

test('the Worker lets in only Moon pages with a fresh ticket for that record', async () => {
  const seen: { name?: string; user?: string | null } = {};
  const env = {
    LIVE_TICKET_SECRET: SECRET,
    LIVE_ROOM: {
      idFromName: (name: string) => { seen.name = name; return name; },
      get: () => ({ fetch: async (req: Request) => { seen.user = req.headers.get('X-Live-User'); return new Response('room'); } }),
    },
  };
  const ticket = await serverSign(SECRET, { username: 'mara', recordId: RECORD, now: NOW });
  const ws = { Upgrade: 'websocket', Origin: 'https://mooon.site' };
  const path = `/live/records/${RECORD}?ticket=${encodeURIComponent(ticket)}`;

  const ok = await handleLive(liveRequest(path, ws), env, NOW);
  assert.equal(await ok.text(), 'room');
  assert.deepEqual(seen, { name: RECORD, user: 'mara' });

  assert.equal((await handleLive(liveRequest(path, { ...ws, Origin: 'https://evil.example' }), env, NOW)).status, 403);
  assert.equal((await handleLive(liveRequest(path, { Origin: 'https://mooon.site' }), env, NOW)).status, 426);
  assert.equal((await handleLive(liveRequest(`/live/records/${RECORD}`, ws), env, NOW)).status, 403);
  assert.equal((await handleLive(liveRequest(`/live/records/other-record?ticket=${ticket}`, ws), env, NOW)).status, 403);
  assert.equal((await handleLive(liveRequest(path, ws), env, NOW + 120_000)).status, 403);
  assert.equal((await handleLive(liveRequest('/live/elsewhere', ws), env, NOW)).status, 404);
  assert.equal((await handleLive(liveRequest(path, ws), { LIVE_TICKET_SECRET: SECRET }, NOW)).status, 503);
  // Someone sending their own X-Live-User header gets the name from the ticket, not theirs.
  await handleLive(liveRequest(path, { ...ws, 'X-Live-User': 'isaac' }), env, NOW);
  assert.equal(seen.user, 'mara');
});

test('the page builds the list of who is here from the room messages', () => {
  let s = applyLiveMessage(emptyLiveState, {
    t: 'welcome',
    self: { id: 'me1', u: 'mara', at: 5 },
    peers: [{ id: 'a1', u: 'ali', at: 1 }, { id: 'm2', u: 'mara', at: 2 }, { bad: true }],
  });
  assert.deepEqual(otherPeople(s, 'mara').map((p) => p.u), ['ali']); // never yourself, even in another tab
  s = applyLiveMessage(s, { t: 'join', peer: { id: 'z1', u: 'zainab', at: 9 } });
  s = applyLiveMessage(s, { t: 'join', peer: { id: 'a2', u: 'ali', at: 10 } }); // Ali's second tab
  assert.deepEqual(otherPeople(s, 'mara').map((p) => [p.u, p.id]), [['ali', 'a1'], ['zainab', 'z1']]);
  s = applyLiveMessage(s, { t: 'leave', id: 'a1' });
  // Ali's first tab closed: his second tab arrived after Zainab, so he now comes second.
  assert.deepEqual(otherPeople(s, 'mara').map((p) => [p.u, p.id]), [['zainab', 'z1'], ['ali', 'a2']]);
  s = applyLiveMessage(s, { t: 'leave', id: 'a2' });
  assert.deepEqual(otherPeople(s, 'mara').map((p) => p.u), ['zainab']);
  assert.equal(applyLiveMessage(s, { t: 'cursor', id: 'z1' }), s);
  assert.equal(applyLiveMessage(s, null), s);
});

test('the room relays a cleaned message to the others and says when someone leaves', async () => {
  (globalThis as any).WebSocketRequestResponsePair ??= class { constructor(public req: string, public res: string) {} };
  // @ts-ignore plain JS module from the Cloudflare Worker
  const { LiveRoom } = await import('../workers/resource-router/liveRoom.js');
  const fake = (peer: any) => {
    const sock: any = { peer, sent: [] as any[], closed: false };
    sock.send = (m: string) => sock.sent.push(JSON.parse(m));
    sock.deserializeAttachment = () => sock.peer;
    sock.serializeAttachment = (p: any) => { sock.peer = p; };
    sock.close = () => { sock.closed = true; };
    return sock;
  };
  const a = fake({ id: 'a', u: 'ali', at: 1 });
  const b = fake({ id: 'b', u: 'mara', at: 2 });
  const sockets = [a, b];
  const room = new LiveRoom({ setWebSocketAutoResponse() {}, getWebSockets: () => sockets.filter((s) => s.peer), acceptWebSocket() {} }, {});
  await room.webSocketMessage(a, '{"t":"cursor","f":"bf:title","x":0.5,"y":0.25,"extra":"x"}');
  await room.webSocketMessage(a, '{"t":"evil"}');
  assert.deepEqual(b.sent, [{ t: 'cursor', f: 'bf:title', x: 0.5, y: 0.25, id: 'a' }]);
  assert.deepEqual(a.sent, []); // nobody hears their own messages
  await room.webSocketClose(a, 1001);
  assert.equal(a.closed, true);
  assert.deepEqual(b.sent.at(-1), { t: 'leave', id: 'a' });
});

test('reconnect waits grow and then stay at 30 seconds', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 9].map(reconnectDelay), [1000, 2000, 5000, 10000, 30000, 30000]);
});
