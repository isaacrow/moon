// Gaps the LC comparison found in Moon's MARC export (Phase 9): a title or note held in its own node and
// linked by @id was missed, and LC writes 043, 505, 521 and 758 where Moon wrote nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bibframeToMarc } from '../src/services/marc/bibframeToMarc';
import { fixLegacyDocument } from '../src/services/legacyRecordFix';

const sub = (rec: any, tag: string, code: string) => rec.fields.find((f: any) => f.tag === tag)?.subfields?.find(([c]: string[]) => c === code)?.[1];
const fixture = JSON.parse(readFileSync('test/fixtures/legacy/record-1771342400925.json', 'utf8'));
const rec = bibframeToMarc(fixLegacyDocument(fixture.document).document, { recordId: 'record-1771342400925' });

test('a title and notes linked by @id reach the MARC record', () => {
  assert.equal(sub(rec, '245', 'a'), 'Ali b. Abi Talib :');
  assert.equal(sub(rec, '245', 'b'), 'Rereading Historical Sources');
  assert.equal(sub(rec, '500', 'a'), 'include indexing');
  assert.equal(sub(rec, '520', 'a'), 'speaks abou imam ali');
});

test('contents, audience, geographic area and the Work link, as LC writes them', () => {
  assert.equal(sub(rec, '505', 'a'), 'includes ali bin abi talb biography');
  assert.equal(sub(rec, '521', 'a'), 'musims');
  assert.equal(sub(rec, '043', 'a'), 'a-iq---');
  assert.equal(sub(rec, '758', '1'), 'https://mooon.site/resource/work/record-1771342400925');
  assert.equal(sub(rec, '758', '4'), 'http://id.loc.gov/ontologies/bibframe/instanceOf');
});

test('a node is never written inside itself', () => {
  const loop = { '@graph': [
    { '@id': 'https://mooon.site/resource/work/w', '@type': 'bf:Work', 'bf:title': { '@id': '_:t' } },
    { '@id': '_:t', '@type': 'bf:Title', 'bf:mainTitle': 'Loop', 'bf:relatedTo': { '@id': '_:t' } },
    { '@id': 'https://mooon.site/resource/instance/i', '@type': 'bf:Instance', 'bf:instanceOf': { '@id': 'https://mooon.site/resource/work/w' } },
  ] };
  assert.equal(sub(bibframeToMarc(loop), '245', 'a'), 'Loop');
});
