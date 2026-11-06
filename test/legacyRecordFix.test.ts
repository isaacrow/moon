// The old-record repair, tested on real published records saved by Moon's early editor
// (test/fixtures/legacy/*.json, copied from the live catalogue on 6 Nov 2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import jsonld from 'jsonld';
import { fixLegacyDocument, titleOf } from '../src/services/legacyRecordFix';

const CONTEXT = {
  bf: 'http://id.loc.gov/ontologies/bibframe/',
  bflc: 'http://id.loc.gov/ontologies/bflc/',
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
  xsd: 'http://www.w3.org/2001/XMLSchema#',
  madsrdf: 'http://www.loc.gov/mads/rdf/v1#',
};
const fixture = (id: string) => JSON.parse(readFileSync(`test/fixtures/legacy/${id}.json`, 'utf8'));
/** What any JSON-LD tool (the OPAC's linked data, SPARQL, LC's converter) actually reads from a document. */
async function triples(document: any): Promise<Set<string>> {
  const nq = await jsonld.toRDF({ '@context': CONTEXT, '@graph': document['@graph'] }, { format: 'application/n-quads' }) as string;
  // Blank node labels differ between runs; compare with them masked.
  return new Set(nq.split('\n').filter(Boolean).map((l) => l.replace(/_:[A-Za-z0-9]+/g, '_:')));
}
const BF = 'http://id.loc.gov/ontologies/bibframe/';
const W = 'https://mooon.site/resource/work/record-1771342400925';
const I = 'https://mooon.site/resource/instance/record-1771342400925';

test('an early-editor record gets its title, summary, links and Work–Instance link back', async () => {
  const before = await triples(fixture('record-1771342400925').document);
  const { document, report, changed } = fixLegacyDocument(fixture('record-1771342400925').document);
  const after = await triples(document);
  assert.equal(changed, true);
  const has = (s: Set<string>, re: RegExp) => [...s].some((t) => re.test(t));
  // Before: the Work had no title and the Instance was not linked to it — what LC's converter rejected.
  assert.equal(has(before, new RegExp(`<${W}> <${BF}title>`)), false);
  assert.equal(has(before, new RegExp(`<${I}> <${BF}instanceOf> <${W}>`)), false);
  // After: both are there, the title node carries its words, links are links, no placeholder is left.
  assert.ok(has(after, new RegExp(`<${W}> <${BF}title> _:`)));
  assert.ok(has(after, new RegExp(`<${BF}mainTitle> "Ali b. Abi Talib :"`)));
  assert.ok(has(after, new RegExp(`<${I}> <${BF}instanceOf> <${W}>`)));
  assert.ok(has(after, new RegExp(`<${W}> <${BF}language> <http://id.loc.gov/vocabulary/languages/ara>`)));
  assert.ok(has(after, /rdf-schema#label> "speaks abou imam ali "/));
  assert.ok(has(after, new RegExp(`<${I}> <${BF}responsibilityStatement> "By Mohammad reza al-Khaghani`)));
  assert.equal([...after].some((t) => t.includes('moon.local')), false);
  assert.ok(after.size > before.size * 3, `${before.size} → ${after.size} triples`);
  assert.ok(report.placeholdersRelinked >= 6, JSON.stringify(report));
  assert.equal(report.instanceLinked, false, 'the placeholder Work link was repointed, so no new link was needed');
  assert.equal(titleOf(document), 'Ali b. Abi Talib : Rereading Historical Sources');
});

test('records that were already read correctly lose nothing', async () => {
  for (const id of ['record-1789649846891', 'record-1793814549325']) {
    const before = await triples(fixture(id).document);
    const after = await triples(fixLegacyDocument(fixture(id).document).document);
    // A link that was stored as text and is now a real link is the same statement.
    const asLink = (t: string) => t.replace(/ "(https?:\/\/[^"]+)" \.$/, ' <$1> .');
    const lost = [...before].filter((t) => !after.has(t) && !after.has(asLink(t)));
    assert.deepEqual(lost, [], `${id} lost triples`);
    assert.ok(after.size >= before.size);
  }
});

test('running it twice changes nothing more, and the input is untouched', () => {
  const input = fixture('record-1771342400925').document;
  const copy = JSON.stringify(input);
  const once = fixLegacyDocument(input);
  const twice = fixLegacyDocument(once.document);
  assert.equal(JSON.stringify(input), copy);
  assert.equal(twice.changed, false, JSON.stringify(twice.report));
  assert.deepEqual(twice.document, once.document);
});

test('a test entry is repaired in form but has no real content to recover', () => {
  const { document } = fixLegacyDocument(fixture('record-1771428622208').document);
  assert.equal(titleOf(document), 'isaac : faleh');
});
