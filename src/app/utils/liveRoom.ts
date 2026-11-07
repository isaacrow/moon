// The browser side of a record's live room. While a cataloger has a record open in Moon Studio, the
// page asks the Moon server for a 60-second live ticket and opens a WebSocket to
// wss://mooon.site/live/records/<id>. The room says who else is there, at once, instead of the
// half-minute heartbeat. A hidden tab leaves the room and rejoins when it is shown again; a lost
// connection is retried with a growing wait. If live editing is off (no secret yet) it stays quiet,
// and the heartbeat banner works as before.
import { moonFetch } from './moonApi';
import { applyLiveMessage, emptyLiveState, reconnectDelay, type LiveState } from './livePeers';

export interface LiveRoomHandle {
  /** Sends a message to the others (used by the live cursors). Dropped while not connected. */
  send(message: object): void;
  /** Hears every message from the room (cursor moves and so on); returns a function to stop. */
  onMessage(listener: (message: any) => void): () => void;
  stop(): void;
}

export function connectLiveRoom(recordId: string, onState: (state: LiveState) => void): LiveRoomHandle {
  let ws: WebSocket | null = null;
  let stopped = false;
  let off = false; // the server said live editing is off, or this account may not use it
  let failures = 0;
  let retry: number | undefined;
  let ping: number | undefined;
  let state: LiveState = emptyLiveState;
  const listeners = new Set<(message: any) => void>();

  const publish = (next: LiveState) => { state = next; onState(state); };

  const close = () => {
    window.clearTimeout(retry);
    window.clearInterval(ping);
    if (ws) {
      ws.onclose = null;
      try { ws.close(1000, 'bye'); } catch { /* already closed */ }
      ws = null;
    }
    publish(emptyLiveState);
  };

  const schedule = () => {
    if (stopped || off) return;
    window.clearTimeout(retry);
    retry = window.setTimeout(open, reconnectDelay(failures));
    failures += 1;
  };

  async function open() {
    if (stopped || off || ws || document.visibilityState !== 'visible') return;
    const res = await moonFetch<{ ticket?: string; url?: string }>(`/records/${encodeURIComponent(recordId)}/live-ticket`, { body: {} })
      .catch(() => null);
    if (stopped || ws || document.visibilityState !== 'visible') return;
    if (!res || !res.ok || !res.data?.ticket || !res.data?.url) {
      if (res && (res.status === 503 || res.status === 401 || res.status === 403 || res.status === 400)) { off = true; return; }
      schedule();
      return;
    }
    const socket = new WebSocket(`${res.data.url}?ticket=${encodeURIComponent(res.data.ticket)}`);
    ws = socket;
    socket.onopen = () => {
      failures = 0;
      ping = window.setInterval(() => { try { socket.send('{"t":"ping"}'); } catch { /* closing */ } }, 25_000);
    };
    socket.onmessage = (event) => {
      if (typeof event.data !== 'string') return;
      let msg: unknown;
      try { msg = JSON.parse(event.data); } catch { return; }
      publish(applyLiveMessage(state, msg));
      for (const listener of listeners) listener(msg);
    };
    socket.onclose = () => {
      window.clearInterval(ping);
      if (ws === socket) ws = null;
      publish(emptyLiveState);
      schedule();
    };
  }

  const onVisibility = () => {
    if (document.visibilityState === 'visible') { failures = 0; open(); }
    else close();
  };
  document.addEventListener('visibilitychange', onVisibility);
  open();

  return {
    send(message) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        try { ws.send(JSON.stringify(message)); } catch { /* closing */ }
      }
    },
    onMessage(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    stop() {
      stopped = true;
      listeners.clear();
      document.removeEventListener('visibilitychange', onVisibility);
      close();
    },
  };
}
