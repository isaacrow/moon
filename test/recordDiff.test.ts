import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffRecords, recordLines } from '../src/app/utils/recordDiff.ts';

const doc = (instance: any, work: any = {}) => ({
  '@graph': [
    { '@id': 'https://mooon.site/resource/work/w1', '@type': 'bf:Work', ...work },
    { '@id': 'https://mooon.site/resource/instance/i1', '@type': ['bf:Instance', 'bf:Print'], ...instance },
  ],
});

test('identical documents have no differences', () => {
  const d = doc({ 'bf:title': { '@type': 'bf:Title', 'bf:mainTitle': 'القبسات' } });
  assert.deepEqual(diffRecords(d, structuredClone(d)), []);
});

test('a changed title shows before and after under a readable field', () => {
  const diff = diffRecords(
    doc({ 'bf:title': { '@type': 'bf:Title', 'bf:mainTitle': 'Old title' } }),
    doc({ 'bf:title': { '@type': 'bf:Title', 'bf:mainTitle': 'New title' } }),
  );
  assert.deepEqual(diff, [{ field: 'Instance › title [Title] › mainTitle', kind: 'changed', before: ['Old title'], after: ['New title'] }]);
});

test('added and removed fields, language tags and links', () => {
  const diff = diffRecords(
    doc({ 'bf:extent': { '@type': 'bf:Extent', 'rdfs:label': '344 p.' } }, { 'bf:language': { '@id': 'http://id.loc.gov/vocabulary/languages/ara' } }),
    doc({ 'bf:dimensions': '21 cm' }, { 'bf:language': { '@id': 'http://id.loc.gov/vocabulary/languages/eng' }, 'bf:summary': { '@value': 'ملخص', '@language': 'ar' } }),
  );
  const byField = Object.fromEntries(diff.map((d) => [d.field, d]));
  assert.equal(byField['Instance › extent [Extent] › label'].kind, 'removed');
  assert.equal(byField['Instance › dimensions'].kind, 'added');
  assert.deepEqual(byField['Work › language'].before, ['http://id.loc.gov/vocabulary/languages/ara']);
  assert.deepEqual(byField['Work › language'].after, ['http://id.loc.gov/vocabulary/languages/eng']);
  assert.deepEqual(byField['Work › summary'].after, ['ملخص (@ar)']);
});

test('reordering a list is not a change; adding to it is', () => {
  const a = doc({}, { 'bf:subject': [{ 'rdfs:label': 'Philosophy' }, { 'rdfs:label': 'Islam' }] });
  const b = doc({}, { 'bf:subject': [{ 'rdfs:label': 'Islam' }, { 'rdfs:label': 'Philosophy' }] });
  assert.deepEqual(diffRecords(a, b), []);
  const c = doc({}, { 'bf:subject': [{ 'rdfs:label': 'Islam' }, { 'rdfs:label': 'Philosophy' }, { 'rdfs:label': 'Logic' }] });
  assert.deepEqual(diffRecords(a, c), [{ field: 'Work › subject › label', kind: 'added', before: [], after: ['Logic'] }]);
});

test('changed ids alone are not differences; a second node of a type is numbered', () => {
  const a = { '@graph': [{ '@id': '_:b1', '@type': 'bf:Item', 'bf:shelfMark': 'X1' }, { '@id': '_:b2', '@type': 'bf:Item', 'bf:shelfMark': 'X2' }] };
  const b = { '@graph': [{ '@id': '_:c9', '@type': 'bf:Item', 'bf:shelfMark': 'X1' }, { '@id': '_:c8', '@type': 'bf:Item', 'bf:shelfMark': 'X3' }] };
  assert.deepEqual(diffRecords(a, b), [{ field: 'Item 2 › shelfMark', kind: 'changed', before: ['X2'], after: ['X3'] }]);
  assert.deepEqual(recordLines(a).map(([f]) => f), ['Item › shelfMark', 'Item 2 › shelfMark']);
});

test('documents without a @graph compare as empty', () => {
  assert.deepEqual(diffRecords(null, { '@graph': [] }), []);
});
