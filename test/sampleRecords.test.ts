import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SAMPLE_BOOKS, sampleRecord, sampleStorageId } from '../src/app/utils/sampleRecords.ts';
import { toServerDocument } from '../src/app/utils/recordStorageBackend.ts';
import { missingForPublish } from '../supabase/functions/server/publishGate.tsx';

const isbn13ok = (s: string) => {
  const d = [...s].map(Number);
  return d.length === 13 && d.reduce((sum, n, i) => sum + n * (i % 2 ? 3 : 1), 0) % 10 === 0;
};

test('the sample books are Arabic and English, each with a valid ISBN-13 and its own id', () => {
  assert.ok(SAMPLE_BOOKS.some((b) => b.lang === 'ara'));
  assert.ok(SAMPLE_BOOKS.some((b) => b.lang === 'eng'));
  for (const b of SAMPLE_BOOKS) assert.ok(isbn13ok(b.isbn), `${b.title}: ${b.isbn}`);
  assert.equal(new Set(SAMPLE_BOOKS.map(sampleStorageId)).size, SAMPLE_BOOKS.length);
});

test('every sample record is complete enough to be published', () => {
  for (const b of SAMPLE_BOOKS) {
    const doc = toServerDocument(sampleRecord(b, 'isaac'));
    assert.deepEqual(missingForPublish(doc), [], b.title);
  }
});
