// LC's "bounded description" RDF/XML (what Marva and bibframe2marc exchange): Work, Instance and Items at the
// top, named by their class; every other node nested where it is used. It must still be exactly the same graph.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Parser } from 'n3';
import { RdfXmlParser } from 'rdfxml-streaming-parser';
import { toBoundedRdfXml } from '../supabase/functions/server/rdfXml.tsx';

const BF = 'http://id.loc.gov/ontologies/bibframe/';
const NT = `<https://mooon.site/resource/instance/r1> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <${BF}Instance> .
<https://mooon.site/resource/instance/r1> <${BF}instanceOf> <https://mooon.site/resource/work/r1> .
<https://mooon.site/resource/instance/r1> <${BF}title> _:it .
_:it <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <${BF}Title> .
_:it <${BF}mainTitle> "القبسات"@ar-Arab .
_:it <${BF}mainTitle> "al-Qabasāt"@ar-Latn .
<https://mooon.site/resource/instance/r1> <${BF}provisionActivity> _:pub .
_:pub <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <${BF}Publication> .
_:pub <${BF}place> _:place .
_:place <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <${BF}Place> .
_:place <http://www.w3.org/2000/01/rdf-schema#label> "Tehran" .
<https://mooon.site/resource/work/r1> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <${BF}Work> .
<https://mooon.site/resource/work/r1> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <${BF}Text> .
<https://mooon.site/resource/work/r1> <${BF}hasInstance> <https://mooon.site/resource/instance/r1> .
<https://mooon.site/resource/work/r1> <${BF}contribution> _:c .
_:c <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <${BF}PrimaryContribution> .
_:c <${BF}agent> <http://id.loc.gov/rwo/agents/n123> .
<http://id.loc.gov/rwo/agents/n123> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <${BF}Agent> .
<http://id.loc.gov/rwo/agents/n123> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <${BF}Person> .
<http://id.loc.gov/rwo/agents/n123> <http://www.w3.org/2000/01/rdf-schema#label> "Mīr Dāmād, Muḥammad Bāqir" .
<https://mooon.site/resource/work/r1> <${BF}subject> _:shared .
<https://mooon.site/resource/work/r1> <${BF}genreForm> _:shared .
_:shared <http://www.w3.org/2000/01/rdf-schema#label> "Philosophy" .
<https://mooon.site/resource/work/r1> <${BF}language> <http://id.loc.gov/vocabulary/languages/ara> .
<https://mooon.site/resource/item/r1-1> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <${BF}Item> .
<https://mooon.site/resource/item/r1-1> <${BF}itemOf> <https://mooon.site/resource/instance/r1> .
<https://mooon.site/resource/item/r1-1> <${BF}shelfMark> _:sm .
_:sm <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <${BF}ShelfMark> .
_:sm <http://www.w3.org/2000/01/rdf-schema#label> "B753.D363 Q23" .
`;
const PREFIXES = { bf: BF, rdfs: 'http://www.w3.org/2000/01/rdf-schema#' };

const key = (q: any) => [q.subject, q.predicate, q.object].map((t: any) =>
  t.termType === 'BlankNode' ? '_' : t.termType === 'Literal' ? `"${t.value}"@${t.language}^^${t.datatype?.value}` : t.value).join(' ');

async function parseRdfXml(xml: string): Promise<any[]> {
  const parser = new RdfXmlParser();
  const out: any[] = [];
  await new Promise<void>((resolve, reject) => {
    parser.on('data', (q) => out.push(q)).on('error', reject).on('end', resolve);
    parser.write(xml);
    parser.end();
  });
  return out;
}

const quads = new Parser({ format: 'N-Triples' }).parse(NT);
const xml = toBoundedRdfXml(quads as any, PREFIXES);
/** The top-level elements (two-space indent) in order. */
const topLevel = [...xml.matchAll(/^ {2}<([a-zA-Z:]+)[ >/]/gm)].map((m) => m[1]);

test('it is exactly the same graph as the flat form', async () => {
  const back = await parseRdfXml(xml);
  assert.deepEqual(back.map(key).sort(), quads.map(key).sort());
  assert.equal(back.length, quads.length);
});

test('Work, Instance and Item are the only top-level elements, in that order, named by class', () => {
  assert.deepEqual(topLevel, ['bf:Work', 'bf:Instance', 'bf:Item']);
  assert.match(xml, /<bf:Work rdf:about="https:\/\/mooon\.site\/resource\/work\/r1">/);
  assert.match(xml, /<rdf:type rdf:resource="http:\/\/id\.loc\.gov\/ontologies\/bibframe\/Text"\/>/);
  // The Work and Instance point at each other; neither is nested in the other.
  assert.match(xml, /<bf:hasInstance rdf:resource="https:\/\/mooon\.site\/resource\/instance\/r1"\/>/);
  assert.match(xml, /<bf:instanceOf rdf:resource="https:\/\/mooon\.site\/resource\/work\/r1"\/>/);
  assert.match(xml, /<bf:itemOf rdf:resource="https:\/\/mooon\.site\/resource\/instance\/r1"\/>/);
});

test('other nodes are nested where they are used, outside agents included', () => {
  // Language tags are case-insensitive (BCP 47); the N-Triples parser gives them in lower case.
  assert.match(xml, /<bf:title>\s*<bf:Title>\s*<bf:mainTitle xml:lang="ar-arab">القبسات<\/bf:mainTitle>/i);
  assert.match(xml, /<bf:provisionActivity>\s*<bf:Publication>\s*<bf:place>\s*<bf:Place>\s*<rdfs:label>Tehran<\/rdfs:label>/);
  assert.match(xml, /<bf:agent>\s*<bf:Agent rdf:about="http:\/\/id\.loc\.gov\/rwo\/agents\/n123">\s*<rdf:type rdf:resource="http:\/\/id\.loc\.gov\/ontologies\/bibframe\/Person"\/>/);
  assert.match(xml, /<bf:shelfMark>\s*<bf:ShelfMark>/);
  // A plain outside URI with nothing said about it stays a reference.
  assert.match(xml, /<bf:language rdf:resource="http:\/\/id\.loc\.gov\/vocabulary\/languages\/ara"\/>/);
  assert.doesNotMatch(xml, /rdf:Description rdf:about="https:\/\/mooon/);
});

test('a node used twice is written once and referred to the second time', () => {
  const nested = xml.match(/<bf:subject>\s*<rdf:Description rdf:nodeID="([^"]+)">/);
  assert.ok(nested, 'the shared node is nested under its first use');
  assert.match(xml, new RegExp(`<bf:genreForm rdf:nodeID="${nested![1]}"/>`));
  assert.equal(xml.match(/>Philosophy</g)?.length, 1);
});
