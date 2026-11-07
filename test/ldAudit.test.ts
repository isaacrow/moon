// Phase 12: the linked-data audit. It measures the live catalogue as the audit of 7 November 2026 did, and
// every record the code makes (sample books, a record catalogued in MARC) uses only BIBFRAME 3.0.1 terms
// with the right kind of value, links Work and Instance both ways, and carries no junk.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import jsonld from 'jsonld';
import { auditNTriples, regressions, score } from '../supabase/functions/server/ldAudit.tsx';
import * as T from '../supabase/functions/server/bibframeTerms.generated.tsx';

(globalThis as any).localStorage ??= { getItem: () => null, setItem: () => {}, removeItem: () => {} };

const VOCAB = {
  bfClasses: T.BF_CLASSES, bfObject: T.BF_OBJECT_PROPERTIES, bfData: T.BF_DATATYPE_PROPERTIES,
  bflcClasses: T.BFLC_CLASSES, bflcObject: T.BFLC_OBJECT_PROPERTIES, bflcData: T.BFLC_DATATYPE_PROPERTIES,
};
const m = (r: ReturnType<typeof auditNTriples>, key: string) => r.measures.find((x) => x.key === key)!;

test('the server\'s BIBFRAME term list is the same as the app\'s', () => {
  const a = readFileSync(new URL('../src/services/bibframeTerms.generated.ts', import.meta.url), 'utf8');
  const b = readFileSync(new URL('../supabase/functions/server/bibframeTerms.generated.tsx', import.meta.url), 'utf8');
  assert.equal(a.replace(/\r\n/g, '\n'), b.replace(/\r\n/g, '\n'), 'run scripts/build-bibframe-terms.mjs');
});

test('the audit measures the live catalogue as the 7 November audit did', () => {
  const r = auditNTriples(readFileSync(new URL('./fixtures/ld-audit/live-2026-11-07.nt', import.meta.url), 'utf8'), VOCAB, { total: 73, withOutsideLinks: 1 });
  assert.deepEqual([r.counts.works, r.counts.instances], [46, 46]);
  assert.deepEqual([m(r, 'contributorsLinked').value, m(r, 'contributorsLinked').total], [19, 31]);
  assert.deepEqual([m(r, 'subjectsLinked').value, m(r, 'subjectsLinked').total], [61, 82]);
  assert.equal(m(r, 'arabicTagged').value, 0);
  assert.equal(m(r, 'sameAsInData').value, 0);
  assert.ok(r.unknownTerms['bf:creator'] === 5 && r.unknownTerms['bf:Expression'] === 2);
  assert.ok(r.unlinked.contributors.includes('Orwell, George, 1903-1950'));
  assert.equal(score(m(r, 'workInstance')) < 1, true);
});

test('a number that gets worse is a regression; one that gets better is not', () => {
  const r = auditNTriples(readFileSync(new URL('./fixtures/ld-audit/live-2026-11-07.nt', import.meta.url), 'utf8'), VOCAB);
  assert.deepEqual(regressions(r, { contributorsLinked: { value: 19, total: 31 }, unknownTerms: { value: 20, total: 0 } }), []);
  assert.equal(regressions(r, { contributorsLinked: { value: 30, total: 31 } }).length, 1);
  assert.equal(regressions(r, { unknownTerms: { value: 3, total: 0 } }).length, 1);
});

/** N-Triples for documents, blank nodes kept apart per document. */
async function ntOf(graphs: any[][], context: Record<string, string>): Promise<string> {
  let out = '';
  for (const [i, graph] of graphs.entries()) {
    const nt = await jsonld.toRDF({ '@context': context, '@graph': graph }, { format: 'application/n-quads' }) as string;
    out += nt.replace(/_:b(\d+)/g, `_:d${i}b$1`);
  }
  return out;
}

test('records the code makes are clean BIBFRAME 3.0.1: sample books and a record catalogued in MARC', async () => {
  const { SAMPLE_BOOKS, sampleRecord } = await import('../src/app/utils/sampleRecords');
  const { BIBFRAME_JSONLD_CONTEXT } = await import('../src/services/w3cJsonLdBuilder');
  const { marcTextToBibframe } = await import('../src/services/marc/marcEditing');
  const graphs = SAMPLE_BOOKS.map((b: any) => { const rec: any = sampleRecord(b, 'ci'); return [rec.work, rec.instance, rec.item, rec.adminMetadata].filter(Boolean); });
  const B = '\\';
  const marc = marcTextToBibframe([
    `LDR 00000nam${B}a2200000${B}i${B}4500`, '008 ' + '261106s2023    iq            000 0 ara d'.replace(/ /g, B),
    '020 ## $a 9789922000000', '041 0# $a ara $a eng', '100 0# $a Ibn Khaldūn, $d 1332-1406, $e author. $0 http://id.loc.gov/authorities/names/n50052785',
    '245 10 $a Muqaddimah / $c Ibn Khaldūn.', '246 31 $a Prolegomena', '264 #1 $a Baghdād : $b Dār al-Shuʼūn, $c 2023.', '300 ## $a 450 pages ; $c 24 cm',
    '336 ## $a text $b txt $2 rdacontent', '337 ## $a unmediated $b n $2 rdamedia', '338 ## $a volume $b nc $2 rdacarrier',
    '490 0# $a Silsilat al-turāth ; $v 3', '502 ## $a Thesis $b Ph.D. $c University of Baghdad $d 2009', '504 ## $a Includes bibliography.',
    '505 0# $a One -- Two.', '520 ## $a A summary.', '546 ## $a In Arabic.', '650 #0 $a Islamic philosophy. $0 http://id.loc.gov/authorities/subjects/sh85100934',
    '653 ## $a Heritage', '700 1# $a ʻAlī, Ḥusayn, $e editor.', '830 #0 $a Silsilat al-turāth ; $v 3',
  ].join('\n')).bibframe!;
  graphs.push([
    { ...marc.work, '@id': 'https://mooon.site/resource/work/ci-marc', 'bf:hasInstance': { '@id': 'https://mooon.site/resource/instance/ci-marc' } },
    { ...marc.instance, '@id': 'https://mooon.site/resource/instance/ci-marc', 'bf:instanceOf': { '@id': 'https://mooon.site/resource/work/ci-marc' } },
  ]);
  const r = auditNTriples(await ntOf(graphs, BIBFRAME_JSONLD_CONTEXT), VOCAB);
  assert.deepEqual(r.unknownTerms, {}, 'only BIBFRAME 3.0.1 and BFLC terms');
  assert.deepEqual(r.rangeErrors, {}, 'every property holds the right kind of value');
  for (const key of ['junk', 'placeholders']) assert.equal(m(r, key).value, 0, key);
  for (const key of ['workInstance', 'workTitle', 'instanceTitle']) assert.equal(score(m(r, key)), 1, key);
});
