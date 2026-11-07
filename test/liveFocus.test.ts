// Phase 13 S4: field presence. Who is in which field (from the room's focus/blur/leave messages), one
// entry per person and never yourself, and the soft lock: typing where someone else is asks first, once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyFocusMessage, peopleInField, busyFields, needsAsking, allowKey, editingLabel, fieldLabelFromKey } from '../src/app/utils/liveFocus';

const peers = {
  a1: { id: 'a1', u: 'ali', at: 1 },
  a2: { id: 'a2', u: 'ali', at: 5 },
  m1: { id: 'm1', u: 'mara', at: 3 },
  me: { id: 'me', u: 'isaac', at: 0 },
};

test('focus, blur and leave keep the map of who is where', () => {
  let f = applyFocusMessage({}, { t: 'focus', id: 'a1', f: 'Work:title' });
  assert.deepEqual(f, { a1: 'Work:title' });
  const same = applyFocusMessage(f, { t: 'focus', id: 'a1', f: 'Work:title' });
  assert.equal(same, f, 'nothing changed: same object');
  f = applyFocusMessage(f, { t: 'focus', id: 'a1', f: 'Instance:extent' });
  assert.deepEqual(f, { a1: 'Instance:extent' });
  assert.equal(applyFocusMessage(f, { t: 'blur', id: 'a1', f: 'Work:title' }), f, 'a late blur for an old field changes nothing');
  assert.deepEqual(applyFocusMessage(f, { t: 'blur', id: 'a1' }), {});
  assert.deepEqual(applyFocusMessage(f, { t: 'leave', id: 'a1' }), {});
  assert.equal(applyFocusMessage(f, { t: 'cursor', id: 'a1', f: 'x', x: 0, y: 0 }), f);
  assert.equal(applyFocusMessage(f, null), f);
});

test('people in a field: one per person, never yourself, earliest first', () => {
  const focus = { a1: 'Work:title', a2: 'Work:title', m1: 'Work:title', me: 'Work:title' };
  assert.deepEqual(peopleInField(focus, peers, 'Work:title', 'isaac').map((p) => p.u), ['ali', 'mara']);
  assert.deepEqual(peopleInField(focus, peers, 'Instance:extent', 'isaac'), []);
  const busy = busyFields({ a1: 'Work:title', m1: 'Instance:extent', me: 'Work:subject' }, peers, 'isaac');
  assert.deepEqual([...busy.keys()].sort(), ['Instance:extent', 'Work:title']);
  assert.ok(!busy.has('Work:subject'), 'your own field is not busy');
});

test('soft lock: asks while someone is there, not again after "edit anyway" for those people', () => {
  const ali = [peers.a1];
  const allowed = new Set<string>();
  assert.equal(needsAsking([], 'Work:title', allowed), false);
  assert.equal(needsAsking(ali, 'Work:title', allowed), true);
  allowed.add(allowKey('Work:title', 'ali'));
  assert.equal(needsAsking(ali, 'Work:title', allowed), false);
  assert.equal(needsAsking([peers.a1, peers.m1], 'Work:title', allowed), true, 'someone new arrived: ask again');
  assert.equal(needsAsking(ali, 'Instance:extent', allowed), true, 'another field: ask again');
});

test('labels in both languages', () => {
  assert.equal(editingLabel(['Ali'], 'Title', false), 'Ali is editing Title');
  assert.equal(editingLabel(['Ali', 'Mara'], 'Title', false), 'Ali and Mara are editing Title');
  assert.equal(editingLabel(['Ali', 'Mara', 'Zaid'], 'Title', false), 'Ali, Mara and Zaid are editing Title');
  assert.equal(editingLabel(['علي'], 'العنوان', true), 'علي يحرّر العنوان');
  assert.equal(fieldLabelFromKey('Work:mainTitle'), 'main title');
  assert.equal(fieldLabelFromKey('Instance:provisionActivity'), 'provision activity');
  assert.equal(fieldLabelFromKey('marc:245'), '245');
});
