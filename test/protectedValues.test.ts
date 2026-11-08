// Phase 13 S18: values another library added to a shared entity are protected.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyOwnership, statementsOf, withOwners, withoutOwners, ownersOf, libraryKey, blockedMessage } from '../supabase/functions/server/protectedValues.tsx';

const kerbala = { username: 'ali', library: 'Kerbala Library', admin: false };
const najaf = { username: 'sara', library: 'Najaf Library', admin: false };
const admin = { username: 'isaac', library: 'Moon', admin: true };

const base = { label: 'ابن المقفع', variants: ['Ibn al-Muqaffaʿ'], sameAs: ['http://id.loc.gov/authorities/names/n1'], data: { birthDate: '724' } };

test('statements: one per value, links compared without http/https or wiki/entity', () => {
  const s = statementsOf({ ...base, sameAs: ['https://www.wikidata.org/wiki/Q1'], data: { ...base.data, _owners: {} } });
  assert.ok(s.has('sameAs:wikidata.org/entity/Q1'));
  assert.ok(![...s.keys()].some((k) => k.includes('_owners')));
  assert.equal(libraryKey(' Kerbala   Library '), 'kerbala library');
});

test('another library cannot remove or change what a library added; the same library and the Super Admin can', () => {
  // Kerbala creates the entity: every statement is theirs.
  const first = applyOwnership({ label: '', variants: [], sameAs: [] }, base, kerbala, 't1');
  assert.deepEqual(first.blocked, []);
  const stored = { ...base, data: withOwners(base.data, first.owners) };
  assert.equal(ownersOf(stored.data)['variant:Ibn al-Muqaffaʿ'].library, 'Kerbala Library');

  // Najaf adds a form: fine, and that form is Najaf's.
  const added = { ...stored, variants: [...stored.variants, 'ابن المقفع، عبد الله'] };
  const r1 = applyOwnership(stored, added, najaf, 't2');
  assert.deepEqual(r1.blocked, []);
  assert.equal(r1.owners['variant:ابن المقفع، عبد الله'].library, 'Najaf Library');
  assert.equal(r1.owners['label:ابن المقفع'].library, 'Kerbala Library', 'kept statements keep their owner');

  // Najaf removes Kerbala's LC link and changes the birth date: refused.
  const r2 = applyOwnership(stored, { ...stored, sameAs: [], data: { ...stored.data, birthDate: '720' } }, najaf, 't3');
  assert.deepEqual(r2.blocked.map((b) => b.key).sort(), ['data:birthDate=724', 'sameAs:id.loc.gov/authorities/names/n1']);
  assert.match(blockedMessage(r2.blocked), /Kerbala Library/);

  // Kerbala itself (written another way) and the Super Admin may.
  assert.deepEqual(applyOwnership(stored, { ...stored, sameAs: [] }, { ...kerbala, library: ' kerbala library' }, 't4').blocked, []);
  assert.deepEqual(applyOwnership(stored, { ...stored, sameAs: [] }, admin, 't5').blocked, []);
});

test('values from before owners were kept are open to all; owners from the request are ignored', () => {
  const legacy = { ...base, data: { birthDate: '724' } };
  assert.deepEqual(applyOwnership(legacy, { ...legacy, variants: [] }, najaf, 't').blocked, []);
  const forged = withOwners({ birthDate: '724', _owners: { x: { library: 'Fake', by: 'x', at: 't' } } }, {});
  assert.deepEqual(forged, { birthDate: '724' });
  assert.deepEqual(withoutOwners({ a: 1, _owners: {} }), { a: 1 });
});
