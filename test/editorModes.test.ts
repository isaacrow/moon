// Phase 13 S22: practice copies never point at the real record; simple mode shows a short list of fields.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SIMPLE_FIELDS, practiceCopy, isPractice, keepPractice, PRACTICE_MAX } from '../src/app/utils/editorModes';
import { getPropertiesByDomain } from '../src/services/ontologyRegistry';

test('a practice copy has no storage id or version, and says where it came from', () => {
  const real = { work: {}, instance: {}, metadata: { storageId: 'rec-1', serverVersion: 4, createdAt: 't' } };
  const copy = practiceCopy(real, 'rec-1');
  assert.equal((copy.metadata as any).storageId, undefined);
  assert.equal((copy.metadata as any).serverVersion, undefined);
  assert.equal((copy.metadata as any).practiceFrom, 'rec-1');
  assert.ok(isPractice(copy));
  assert.ok(!isPractice(real));
  assert.equal(real.metadata.storageId, 'rec-1', 'the real record is untouched');
});

test('practice saves: newest first, one per id, at most PRACTICE_MAX', () => {
  let list: any[] = [];
  for (let i = 0; i < PRACTICE_MAX + 5; i++) list = keepPractice({ id: `p${i}`, title: 't', savedAt: 's', document: {} }, list);
  assert.equal(list.length, PRACTICE_MAX);
  assert.equal(list[0].id, `p${PRACTICE_MAX + 4}`);
  list = keepPractice({ id: 'p10', title: 'again', savedAt: 's', document: {} }, list);
  assert.equal(list.filter((r) => r.id === 'p10').length, 1);
});

test('every simple-mode field exists in the editor', () => {
  for (const [entity, fields] of Object.entries(SIMPLE_FIELDS)) {
    const known = new Set(getPropertiesByDomain(entity).map((p: any) => p.shortName));
    for (const f of fields) assert.ok(known.has(f), `${entity} ${f}`);
  }
});
