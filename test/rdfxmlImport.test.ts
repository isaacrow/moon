// RDF/XML import: Moon's DOMParser-based reader must give exactly the graph an independent RDF/XML parser
// (rdfxml-streaming-parser) gives, and Moon's own RDF/XML exports must import back to the same record.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Readable } from 'node:stream';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { Writer as N3Writer, Parser as N3Parser } from 'n3';
import jsonld from 'jsonld';
import { RdfXmlParser } from 'rdfxml-streaming-parser';
import { parseRdfXml } from '../src/services/rdfXmlParser';
import { importBibframe } from '../src/services/bibframeImport';
import { toRdfXml, toTurtle } from '../src/services/rdfGraphBuilder';
import { buildW3CJsonLd } from '../src/services/w3cJsonLdBuilder';
import { realLocExamples } from '../src/app/utils/realLocExamples';

(globalThis as any).DOMParser = DOMParser;
(globalThis as any).XMLSerializer = XMLSerializer;

const BASE = 'https://mooon.site/';
const reference = (text: string): Promise<any[]> => new Promise((resolve, reject) => {
  const quads: any[] = [];
  Readable.from([text]).pipe(new RdfXmlParser({ baseIRI: BASE }))
    .on('data', (q: any) => quads.push(q)).on('error', reject).on('end', () => resolve(quads));
});
const canonical = async (quads: any[]) => await jsonld.canonize(new N3Writer({ format: 'N-Quads' }).quadsToString(quads),
  { algorithm: 'URDNA2015', inputFormat: 'application/n-quads', safe: true } as any) as unknown as string;

async function sameGraph(text: string, name: string) {
  const ours = await canonical(parseRdfXml(text, { baseIRI: BASE }));
  const theirs = await canonical(await reference(text));
  assert.ok(theirs.length > 0, `${name}: the reference parser read triples`);
  assert.equal(ours, theirs, `${name}: Moon's RDF/XML reader and rdfxml-streaming-parser disagree`);
}

test('LC-style sample record (al-qabasat.rdf) reads exactly like the reference parser', async () => {
  await sameGraph(readFileSync(new URL('../public/records/al-qabasat.rdf', import.meta.url), 'utf8'), 'al-qabasat.rdf');
});

test("Moon's own RDF/XML exports read exactly like the reference parser", async () => {
  for (const e of realLocExamples as any[]) await sameGraph(toRdfXml(e.data), e.id);
});

test('the RDF/XML syntax BIBFRAME records use', async () => {
  await sameGraph(`<?xml version="1.0" encoding="UTF-8"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#"
         xmlns:bf="http://id.loc.gov/ontologies/bibframe/" xml:base="https://mooon.site/resource/" xml:lang="ar">
  <bf:Work rdf:about="work/x1">
    <bf:title rdf:parseType="Resource">
      <rdf:type rdf:resource="http://id.loc.gov/ontologies/bibframe/Title"/>
      <bf:mainTitle>القبسات</bf:mainTitle>
      <bf:mainTitle xml:lang="ar-Latn">al-Qabasāt</bf:mainTitle>
    </bf:title>
    <bf:contribution>
      <bf:PrimaryContribution rdf:nodeID="c1">
        <bf:agent><bf:Person rdf:about="http://id.loc.gov/authorities/names/n85043844" rdfs:label="Mīr Dāmād"/></bf:agent>
        <bf:role rdf:resource="http://id.loc.gov/vocabulary/relators/aut"/>
      </bf:PrimaryContribution>
    </bf:contribution>
    <bf:originDate rdf:datatype="http://www.w3.org/2001/XMLSchema#gYear">1650</bf:originDate>
    <bf:note rdfs:label="A note given as an attribute"/>
    <bf:hasInstance rdf:resource="#i1"/>
    <bf:subject rdf:parseType="Collection">
      <bf:Topic rdf:about="http://id.loc.gov/authorities/subjects/sh85068382"/>
      <rdf:Description rdf:ID="t2"/>
    </bf:subject>
  </bf:Work>
  <rdf:Description rdf:ID="i1">
    <rdf:type rdf:resource="http://id.loc.gov/ontologies/bibframe/Instance"/>
    <bf:extent><rdf:Bag><rdf:li>544 pages</rdf:li><rdf:li>ill.</rdf:li></rdf:Bag></bf:extent>
    <bf:dimensions></bf:dimensions>
  </rdf:Description>
</rdf:RDF>`, 'syntax sample');
});

test('a Moon RDF/XML export imports back to the same record', async () => {
  const URIS = { work: 'https://mooon.site/resource/work/r1', instance: 'https://mooon.site/resource/instance/r1',
    item: 'https://mooon.site/resource/item/r1-1', expression: 'https://mooon.site/resource/expression/r1-1', admin: 'https://mooon.site/resource/admin/r1' };
  const doc = buildW3CJsonLd({
    workData: { 'bf:title': { 'bf:mainTitle': 'Pride and prejudice' }, 'bf:language': 'eng', 'bf:content': 'txt',
      'bf:contribution': [{ 'bf:agent': { '@id': 'http://id.loc.gov/authorities/names/n79032879', '@type': 'bf:Person', 'rdfs:label': 'Austen, Jane, 1775-1817' }, 'bf:role': 'aut' }] },
    instanceData: { 'bf:extent': '480 p.', 'bf:carrier': 'nc', 'bf:identifiedBy': { '@type': 'bf:Isbn', 'rdf:value': '9780141439518' } },
    uriSet: URIS,
  });
  const triples = (ttl: string) => new N3Parser().parse(ttl).filter((q) => !/(creation|change)Date$/.test(q.predicate.value))
    .map((q) => `${q.subject.termType === 'BlankNode' ? '_' : q.subject.value} ${q.predicate.value} ${q.object.termType === 'BlankNode' ? '_' : q.object.value}`).sort();
  const rec = await importBibframe(toRdfXml(doc), 'rdfxml');
  const again = buildW3CJsonLd({ workData: rec!.work, instanceData: rec!.instance, itemData: rec!.item, uriSet: URIS });
  assert.deepEqual(triples(toTurtle(again)), triples(toTurtle(doc)));
});

test('broken XML gives a plain error', () => {
  // Browsers report bad XML as a <parsererror> document; xmldom (Node) needs to be asked to throw.
  class StrictParser extends DOMParser {
    constructor() { super({ errorHandler: (_level: string, m: string) => { throw new Error(m); } } as any); }
  }
  assert.throws(() => parseRdfXml('<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><oops></rdf:RDF>', { DOMParser: StrictParser as any }),
    /not well-formed XML/);
});
