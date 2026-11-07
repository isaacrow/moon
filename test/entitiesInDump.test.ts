// Phase 12, step 4: the data dump and SPARQL carry the entities, so a query can go from a record to its
// author and on to the author's LC, VIAF and Wikidata pages.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import jsonld from 'jsonld';
import { entityNodes } from '../supabase/functions/server/entityDocument.tsx';
import { auditNTriples } from '../supabase/functions/server/ldAudit.tsx';
import * as T from '../supabase/functions/server/bibframeTerms.generated.tsx';

const BASE = 'https://mooon.site/resource';
const CONTEXT = {
  bf: 'http://id.loc.gov/ontologies/bibframe/', bflc: 'http://id.loc.gov/ontologies/bflc/', rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  rdfs: 'http://www.w3.org/2000/01/rdf-schema#', xsd: 'http://www.w3.org/2001/XMLSchema#', madsrdf: 'http://www.loc.gov/mads/rdf/v1#',
  owl: 'http://www.w3.org/2002/07/owl#', moonext: 'https://mooon.site/ontology/', skos: 'http://www.w3.org/2004/02/skos/core#',
};
const VOCAB = {
  bfClasses: T.BF_CLASSES, bfObject: T.BF_OBJECT_PROPERTIES, bfData: T.BF_DATATYPE_PROPERTIES,
  bflcClasses: T.BFLC_CLASSES, bflcObject: T.BFLC_OBJECT_PROPERTIES, bflcData: T.BFLC_DATATYPE_PROPERTIES,
};

const IBN_KHALDUN = {
  id: 'ibn-khaldun-0a1b2c3d', kind: 'agent', label: 'ابن خلدون', variants: ['Ibn Khaldūn, 1332-1406'],
  sameAs: ['http://id.loc.gov/authorities/names/n50052785', 'http://www.wikidata.org/entity/Q9294'], data: { agentType: 'person' },
};

test('an entity in the dump: its authority, the real-world thing, and its outside links', async () => {
  const nt = await jsonld.toRDF({ '@context': CONTEXT, '@graph': entityNodes(IBN_KHALDUN as any, BASE, []) }, { format: 'application/n-quads' }) as string;
  const uri = `<${BASE}/agent/ibn-khaldun-0a1b2c3d>`;
  assert.ok(nt.includes(`${uri} <http://www.w3.org/2002/07/owl#sameAs> <http://id.loc.gov/authorities/names/n50052785>`));
  assert.ok(nt.includes(`${uri} <http://www.w3.org/2002/07/owl#sameAs> <http://www.wikidata.org/entity/Q9294>`));
  assert.ok(nt.includes('http://www.loc.gov/mads/rdf/v1#authoritativeLabel'));
});

test('with the entities added, the audit sees the outside links in the published data', async () => {
  const records = readFileSync(new URL('./fixtures/ld-audit/live-2026-11-07.nt', import.meta.url), 'utf8');
  const entity = await jsonld.toRDF({ '@context': CONTEXT, '@graph': entityNodes(IBN_KHALDUN as any, BASE, []) }, { format: 'application/n-quads' }) as string;
  const before = auditNTriples(records, VOCAB);
  const after = auditNTriples(records + entity.replace(/_:([A-Za-z0-9_-]+)/g, '_:e0-$1'), VOCAB);
  const m = (r: any, k: string) => r.measures.find((x: any) => x.key === k);
  assert.equal(m(before, 'sameAsInData').value, 0);
  assert.equal(m(after, 'sameAsInData').value, 1);
  assert.deepEqual(after.unknownTerms, before.unknownTerms, 'entities add no off-standard terms');
});

import { finishPublished } from '../supabase/functions/server/publishedOutput.tsx';

test('an entity\'s Arabic names are language-tagged like a record\'s', async () => {
  const doc = finishPublished({ '@context': CONTEXT, '@graph': entityNodes(IBN_KHALDUN as any, BASE, []) });
  const nt = await jsonld.toRDF(doc, { format: 'application/n-quads' }) as string;
  const arabic = nt.split('\n').filter((l) => /"[^"]*[\u0600-\u06ff][^"]*"/.test(l));
  assert.ok(arabic.length > 0);
  assert.ok(arabic.every((l) => /"@ar(-Latn)? \.$/.test(l.trim()) || /"@ar /.test(l)), 'every Arabic name tagged');
});
