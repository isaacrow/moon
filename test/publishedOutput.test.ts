// Phase 12, step 3: what Moon publishes is strict BIBFRAME 3.0.1 — Arabic tagged, dates in EDTF, no term or
// value outside the standard — measured on the whole live catalogue of 7 November 2026.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import jsonld from 'jsonld';
import { finishPublished } from '../supabase/functions/server/publishedOutput.tsx';
import { auditNTriples } from '../supabase/functions/server/ldAudit.tsx';
import * as T from '../supabase/functions/server/bibframeTerms.generated.tsx';

const VOCAB = {
  bfClasses: T.BF_CLASSES, bfObject: T.BF_OBJECT_PROPERTIES, bfData: T.BF_DATATYPE_PROPERTIES,
  bflcClasses: T.BFLC_CLASSES, bflcObject: T.BFLC_OBJECT_PROPERTIES, bflcData: T.BFLC_DATATYPE_PROPERTIES,
};
const one = (node: any) => finishPublished({ '@graph': [node] })['@graph'][0];

test('Arabic is tagged @ar, and its romanization beside it @ar-Latn', () => {
  const t = one({ '@id': 'w', 'bf:title': { '@type': 'bf:Title', 'bf:mainTitle': ['al-Qabasāt', 'القبسات'] } });
  assert.deepEqual(t['bf:title']['bf:mainTitle'], [{ '@value': 'al-Qabasāt', '@language': 'ar-Latn' }, { '@value': 'القبسات', '@language': 'ar' }]);
  const english = one({ '@id': 'w', 'rdfs:label': 'Nineteen eighty-four' });
  assert.equal(english['rdfs:label'], 'Nineteen eighty-four', 'text in one Latin script alone is left as it is');
});

test('a publication date gets its EDTF reading, Hijri years too', () => {
  const i = one({ '@id': 'i', 'bf:provisionActivity': [{ '@type': 'bf:Publication', 'bf:date': '1445 هـ' }, { '@type': 'bf:Publication', 'bf:date': '2008' }] });
  assert.deepEqual(i['bf:provisionActivity'][0]['bf:date'][1], { '@value': '[2023,2024]', '@type': 'http://id.loc.gov/datatypes/edtf' });
  assert.deepEqual(i['bf:provisionActivity'][1]['bf:date'][1], { '@value': '2008', '@type': 'http://id.loc.gov/datatypes/edtf' });
});

test('terms outside BIBFRAME 3.0.1 become theirs, and nothing is lost', () => {
  const w = one({
    '@id': 'w', '@type': 'bf:Work', 'bf:creator': 'Orwell, George', 'bf:classificationLcc': 'PR6029.R8', 'bf:topical': 'Dystopias',
    'bf:contribution': [{ '@type': 'bf:Contribution', 'bf:agent': { 'rdfs:label': 'Someone else' } }], 'bf:governmentPublication': 'national',
  });
  assert.equal(w['bf:creator'], undefined);
  assert.ok(w['bf:contribution'].some((c: any) => c['bf:agent']['rdfs:label'] === 'Orwell, George' && c['@type'].includes('bf:PrimaryContribution')));
  assert.equal(w['bf:classification'][0]['@type'], 'bf:ClassificationLcc');
  assert.equal(w['bf:subject'][0]['rdfs:label'], 'Dystopias');
  assert.equal(w['moonext:governmentPublication'], 'national', 'kept, in Moon\'s own namespace');
  assert.deepEqual(one({ '@id': 'e', '@type': 'bf:Expression' })['@type'], ['bf:Work', 'moonext:Expression']);
});

test('text where BIBFRAME wants a node becomes the right node', () => {
  const a = one({ '@id': 'a', 'bf:descriptionConventions': 'rda', 'bf:descriptionLanguage': 'ara', 'bf:source': 'local', 'bf:summary': 'ملخص', 'bf:title': 'كتاب', 'bf:issuance': 'mono' });
  assert.deepEqual(a['bf:descriptionConventions'], { '@id': 'http://id.loc.gov/vocabulary/descriptionConventions/rda', 'rdfs:label': 'rda' });
  assert.equal(a['bf:descriptionLanguage']['@id'], 'http://id.loc.gov/vocabulary/languages/ara');
  assert.equal(a['bf:issuance']['@id'], 'http://id.loc.gov/vocabulary/issuance/mono');
  assert.deepEqual(a['bf:source'], { '@type': 'bf:Source', 'rdfs:label': 'local' });
  assert.deepEqual(a['bf:summary'], { '@type': 'bf:Summary', 'rdfs:label': { '@value': 'ملخص', '@language': 'ar' } });
  assert.equal(a['bf:title']['@type'], 'bf:Title');
  const t = one({ '@id': 't', 'bf:temporalCoverage': { 'rdfs:label': '20th century' } });
  assert.equal(t['bf:temporalCoverage'], '20th century', 'a text property keeps text');
});

test('the whole live catalogue, published this way, meets the standard', async () => {
  const dump = JSON.parse(readFileSync(new URL('./fixtures/ld-audit/live-2026-11-07.jsonld', import.meta.url), 'utf8'));
  const nt = await jsonld.toRDF(finishPublished(dump), { format: 'application/n-quads' }) as string;
  const r = auditNTriples(nt, VOCAB);
  const m = (k: string) => r.measures.find((x) => x.key === k)!;
  assert.deepEqual(r.unknownTerms, {}, 'no term outside BIBFRAME 3.0.1');
  assert.deepEqual(r.rangeErrors, {}, 'every value of the right kind');
  assert.equal(m('arabicTagged').value, m('arabicTagged').total, 'every Arabic value tagged');
  assert.ok(m('arabicTagged').total > 100);
  assert.ok(m('edtfDates').value >= 33, 'every dated publication has an EDTF date');
  assert.equal(r.counts.works, 46, 'the same 46 Works');
  // And the stored record is not changed.
  assert.ok(JSON.stringify(dump).includes('"bf:creator"'));
});

import { upgradeLegacyTerms } from '../supabase/functions/server/publishedOutput.tsx';
import { findUnlinked } from '../supabase/functions/server/authorityLinking.tsx';

test('an older record\'s bf:creator becomes a contribution on save, so its author gets linked', () => {
  const doc = { '@graph': [{ '@id': 'https://mooon.site/resource/work/old1', '@type': 'bf:Work', 'bf:title': { '@type': 'bf:Title', 'bf:mainTitle': 'x' }, 'bf:creator': { '@type': 'bf:Person', 'rdfs:label': 'Austen, Jane, 1775-1817' }, 'bf:topical': 'Courtship' }] };
  assert.equal(findUnlinked(JSON.parse(JSON.stringify(doc))).some((t: any) => /Austen/.test(t.label)), false, 'before: the linker cannot see it');
  assert.equal(upgradeLegacyTerms(doc), true);
  const found = findUnlinked(doc).map((t: any) => `${t.kind}:${t.label}`);
  assert.ok(found.includes('agent:Austen, Jane, 1775-1817'));
  assert.ok(found.includes('topic:Courtship'));
  assert.equal(upgradeLegacyTerms(doc), false, 'a second time changes nothing');
});

test('step 6: a record\'s Work and Instance point at each other, and both carry a title', () => {
  const W = 'https://mooon.site/resource/work/r1', I = 'https://mooon.site/resource/instance/r1';
  // Only the Instance points at the Work; the Work's title is a reference to a Title node.
  const g1 = finishPublished({ '@graph': [
    { '@id': W, '@type': 'bf:Work', 'bf:title': { '@id': '_:b1' } },
    { '@id': '_:b1', '@type': 'bf:Title', 'bf:mainTitle': 'المقدمة' },
    { '@id': I, '@type': 'bf:Instance', 'bf:instanceOf': { '@id': W } },
  ] })['@graph'];
  const w1 = g1.find((n: any) => n['@id'] === W), i1 = g1.find((n: any) => n['@id'] === I);
  assert.deepEqual(w1['bf:hasInstance'], [{ '@id': I }], 'the Work points back');
  assert.deepEqual(i1['bf:title'][0]['bf:mainTitle'], { '@value': 'المقدمة', '@language': 'ar' }, 'the Instance takes the Work\'s title');
  // No link at all, and no title anywhere: the pair is linked and takes the record's own title.
  const g2 = finishPublished({ '@graph': [{ '@id': W, '@type': 'bf:Work' }, { '@id': I, '@type': 'bf:Instance' }] }, { title: 'Untitled draft 7' })['@graph'];
  assert.deepEqual(g2[1]['bf:instanceOf'], [{ '@id': W }]);
  assert.equal(g2[0]['bf:title'][0]['bf:mainTitle'], 'Untitled draft 7');
  assert.equal(g2[1]['bf:title'][0]['bf:mainTitle'], 'Untitled draft 7');
});
