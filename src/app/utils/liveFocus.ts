// Field presence: which field each other cataloger is working in right now, from the room's
// focus/blur messages, and the "soft lock" rule: typing in a field someone else is in asks first.
// Kept free of React and the DOM so the tests can run it.
import type { LivePeer } from './livePeers';

/** Peer id → the field key they are in. */
export type FocusMap = Record<string, string>;

export function applyFocusMessage(focus: FocusMap, msg: any): FocusMap {
  if (!msg || typeof msg.id !== 'string') return focus;
  if (msg.t === 'focus' && typeof msg.f === 'string') {
    if (focus[msg.id] === msg.f) return focus;
    return { ...focus, [msg.id]: msg.f };
  }
  // A blur for another field (they already moved on) changes nothing.
  if ((msg.t === 'blur' && (msg.f === undefined || focus[msg.id] === msg.f)) || msg.t === 'leave') {
    if (!(msg.id in focus)) return focus;
    const next = { ...focus };
    delete next[msg.id];
    return next;
  }
  return focus;
}

/** The other people in a field (one entry per person, never yourself), earliest arrival first. */
export function peopleInField(focus: FocusMap, peers: Record<string, LivePeer>, field: string, me: string): LivePeer[] {
  const byUser = new Map<string, LivePeer>();
  for (const [id, f] of Object.entries(focus)) {
    const p = peers[id];
    if (f !== field || !p || p.u === me) continue;
    const seen = byUser.get(p.u);
    if (!seen || p.at < seen.at) byUser.set(p.u, p);
  }
  return [...byUser.values()].sort((a, b) => a.at - b.at);
}

/** Every field someone else is in, with who: field key → people. */
export function busyFields(focus: FocusMap, peers: Record<string, LivePeer>, me: string): Map<string, LivePeer[]> {
  const out = new Map<string, LivePeer[]>();
  for (const f of new Set(Object.values(focus))) {
    const people = peopleInField(focus, peers, f, me);
    if (people.length) out.set(f, people);
  }
  return out;
}

/**
 * Soft lock: should typing in this field stop and ask first? Only when someone else is in it and
 * you have not already said "edit anyway" for that field while those same people were there.
 */
export function needsAsking(people: LivePeer[], field: string, allowed: Set<string>): boolean {
  return people.length > 0 && !people.every((p) => allowed.has(allowKey(field, p.u)));
}

export const allowKey = (field: string, username: string) => `${field}\u0000${username}`;

/** "Ali is editing Title" / "علي يحرّر العنوان" (several people: "Ali and Mara are editing …"). */
export function editingLabel(names: string[], fieldLabel: string, ar: boolean): string {
  if (ar) return `${names.join(' و')} ${names.length > 1 ? 'يحرّرون' : 'يحرّر'} ${fieldLabel}`;
  const who = names.length > 2 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names.join(' and ');
  return `${who} ${names.length > 1 ? 'are' : 'is'} editing ${fieldLabel}`;
}

/** A readable name for a field key when the page has no label for it: "Work:mainTitle" → "main title". */
export function fieldLabelFromKey(key: string): string {
  const name = key.includes(':') ? key.slice(key.lastIndexOf(':') + 1) : key;
  return name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').toLowerCase().trim();
}
