// Phase 13 S19: Moon's change feed, as LC and OCLC publish theirs (ActivityStreams 2.0): one activity per
// published record (Create, Update, Delete), newest first, in pages of 50 that link to each other.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changeFeed, activities, PAGE_SIZE } from '../supabase/functions/server/changeFeed.tsx';

const BASE = 'https://mooon.site/resource';
const doc = (id: string) => ({ '@graph': [
  { '@id': `${BASE}/work/${id}`, '@type': 'bf:Work' },
  { '@id': `${BASE}/instance/${id}`, '@type': ['bf:Instance', 'bf:Print'] },
] });

test('created, changed and withdrawn records become Create, Update and Delete, newest first', () => {
  const items = activities([
    { id: 'a', title: 'New book', document: doc('a'), createdAt: '2026-11-08T10:00:00Z', saved: '2026-11-08T10:00:10Z' },
    { id: 'b', title: 'Edited', document: doc('b'), createdAt: '2026-11-01T10:00:00Z', saved: '2026-11-07T09:00:00Z' },
    { id: 'c', title: 'Gone', createdAt: '2026-10-01T10:00:00Z', saved: '2026-10-02T10:00:00Z', deletedAt: '2026-11-08T12:00:00Z' },
  ], BASE);
  assert.deepEqual(items.map((i) => [i.type, i.object.id]), [
    ['Delete', `${BASE}/instance/c`], ['Create', `${BASE}/instance/a`], ['Update', `${BASE}/instance/b`],
  ]);
  assert.equal(items[1].object['bf:instanceOf'], `${BASE}/work/a`);
  assert.equal(items[1].object.url[0].href, `${BASE}/instance/a.jsonld`);
  assert.equal(items[0].object.type, 'Tombstone');
  assert.ok(!('name' in items[0].object), 'a withdrawn record is not described');
});

test('the collection and its pages link to each other', () => {
  const records = Array.from({ length: PAGE_SIZE + 3 }, (_, i) => ({ id: `r${i}`, createdAt: '2026-01-01T00:00:00Z', saved: new Date(Date.UTC(2026, 0, 2, 0, i)).toISOString() }));
  const col = changeFeed(records, BASE);
  assert.equal(col.type, 'OrderedCollection');
  assert.equal(col.totalItems, PAGE_SIZE + 3);
  assert.equal(col.first.id, `${BASE}/changes?page=1`);
  assert.equal(col.last.id, `${BASE}/changes?page=2`);
  const p1 = changeFeed(records, BASE, 1);
  assert.equal(p1.orderedItems.length, PAGE_SIZE);
  assert.equal(p1.next, `${BASE}/changes?page=2`);
  assert.ok(!('prev' in p1));
  assert.equal(p1.orderedItems[0].object.id, `${BASE}/instance/r${PAGE_SIZE + 2}`, 'newest first');
  const p2 = changeFeed(records, BASE, 9);
  assert.equal(p2.id, `${BASE}/changes?page=2`, 'a page past the end is the last page');
  assert.equal(p2.orderedItems.length, 3);
});
