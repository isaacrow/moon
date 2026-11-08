// Phase 13 S23: CC0 open data, the licence on each record, exports that respect it, and VoID.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CC0, licenceOf, openRecords, cleanLicence, voidDocument, voidTurtle } from '../supabase/functions/server/licence.tsx';
import { withLcAdminMetadata } from '../supabase/functions/server/lcAdminMetadata.tsx';

const BASE = 'https://mooon.site/resource';

test('every record is CC0 unless it says otherwise; only open licences go in bulk exports', () => {
  assert.equal(licenceOf({}).uri, CC0);
  assert.equal(licenceOf({ metadata: { license: 'odc-by' } }).id, 'odc-by');
  assert.equal(licenceOf({ metadata: { license: 'nonsense' } }).id, 'cc0');
  const recs = [{ id: 'a' }, { id: 'b', metadata: { license: 'restricted' } }, { id: 'c', metadata: { license: 'cc-by' } }];
  assert.deepEqual(openRecords(recs).map((r) => r.id), ['a', 'c']);
  assert.equal(cleanLicence('restricted'), 'restricted');
  assert.equal(cleanLicence('<script>'), undefined);
});

test('the published admin metadata says the licence, who made it and who licenses it', () => {
  const doc = { '@graph': [{ '@id': 'w', '@type': 'bf:Work' }, { '@id': 'i', '@type': 'bf:Instance' }] };
  const open = withLcAdminMetadata(doc, { id: 'r1', license: CC0 }, BASE)['@graph'].find((n: any) => n['@type'] === 'bf:AdminMetadata' && !n['bf:status']);
  assert.deepEqual(open['dcterms:license'], { '@id': CC0 });
  assert.equal(open['bf:assigner']['rdfs:label'], 'Moon');
  assert.equal(open['bflc:metadataLicensor']['rdfs:label'], 'Moon');
  const closed = withLcAdminMetadata(doc, { id: 'r2', license: '' }, BASE)['@graph'].find((n: any) => n['@type'] === 'bf:AdminMetadata' && !n['bf:status']);
  assert.equal(closed['dcterms:rights'], 'Not for redistribution');
  assert.equal(closed['dcterms:license'], undefined);
});

test('VoID: licence, dumps, SPARQL, counts', () => {
  const v = voidDocument(BASE, { records: 140, triples: 9000, entities: 300, modified: '2026-11-08T10:00:00Z', left: 2 });
  assert.equal(v['@type'], 'void:Dataset');
  assert.deepEqual(v['dcterms:license'], { '@id': CC0 });
  assert.deepEqual(v['void:sparqlEndpoint'], { '@id': `${BASE}/sparql` });
  assert.equal(v['void:entities'], 440);
  assert.match(v['dcterms:rights'], /2 published records/);
  const ttl = voidTurtle(BASE, { records: 1, triples: 2, entities: 3 });
  assert.match(ttl, /a void:Dataset ;/);
  assert.match(ttl, /void:documents 1 \.\n$/);
});
