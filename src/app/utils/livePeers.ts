// Who is in a record's live room right now, built from the room's messages (see
// workers/resource-router/liveRoomCore.js for the message shapes). Kept free of the browser so the
// tests can run it.

export interface LivePeer {
  id: string;
  u: string;
  at: number;
}

export interface LiveState {
  selfId: string | null;
  peers: Record<string, LivePeer>;
}

export const emptyLiveState: LiveState = { selfId: null, peers: {} };

const isPeer = (p: any): p is LivePeer =>
  !!p && typeof p.id === 'string' && typeof p.u === 'string' && typeof p.at === 'number';

/** The state after one message from the room. Unknown or broken messages change nothing. */
export function applyLiveMessage(state: LiveState, msg: any): LiveState {
  if (!msg || typeof msg !== 'object') return state;
  if (msg.t === 'welcome' && isPeer(msg.self) && Array.isArray(msg.peers)) {
    const peers: Record<string, LivePeer> = {};
    for (const p of msg.peers) if (isPeer(p)) peers[p.id] = p;
    return { selfId: msg.self.id, peers };
  }
  if (msg.t === 'join' && isPeer(msg.peer)) {
    if (msg.peer.id === state.selfId) return state;
    return { ...state, peers: { ...state.peers, [msg.peer.id]: msg.peer } };
  }
  if (msg.t === 'leave' && typeof msg.id === 'string' && state.peers[msg.id]) {
    const peers = { ...state.peers };
    delete peers[msg.id];
    return { ...state, peers };
  }
  return state;
}

/**
 * The other catalogers to show, one per person (someone with the record open in two tabs counts
 * once), never yourself, earliest arrival first.
 */
export function otherPeople(state: LiveState, myUsername: string): LivePeer[] {
  const byUser = new Map<string, LivePeer>();
  for (const p of Object.values(state.peers)) {
    if (p.u === myUsername) continue;
    const seen = byUser.get(p.u);
    if (!seen || p.at < seen.at) byUser.set(p.u, p);
  }
  return [...byUser.values()].sort((a, b) => a.at - b.at || a.u.localeCompare(b.u));
}

/** Wait before reconnecting after the n-th failure in a row: 1 s, 2 s, 5 s, 10 s, then 30 s. */
export function reconnectDelay(failures: number): number {
  const steps = [1000, 2000, 5000, 10000];
  return failures < steps.length ? steps[Math.max(0, failures)] : 30000;
}
