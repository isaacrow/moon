// RDF/XML served at /resource/<kind>/<id>.rdf: written from the record's triples, read back by a real
// RDF/XML parser, it must give the same graph (blank nodes, language tags, datatypes, Arabic text included).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Parser } from 'n3';
import { RdfXmlParser } from 'rdfxml-streaming-parser';
import { toRdfXml } from '../supabase/functions/server/rdfXml.tsx';

const NT = `<https://mooon.site/resource/work/w1> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://id.loc.gov/ontologies/bibframe/Work> .
<https://mooon.site/resource/work/w1> <http://id.loc.gov/ontologies/bibframe/title> _:t1 .
_:t1 <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://id.loc.gov/ontologies/bibframe/Title> .
_:t1 <http://id.loc.gov/ontologies/bibframe/mainTitle> "القبسات"@ar .
_:t1 <http://id.loc.gov/ontologies/bibframe/mainTitle> "al-Qabasāt"@ar-Latn .
<https://mooon.site/resource/work/w1> <http://id.loc.gov/ontologies/bibframe/originDate> "1977"^^<http://www.w3.org/2001/XMLSchema#gYear> .
<https://mooon.site/resource/work/w1> <http://id.loc.gov/ontologies/bibframe/note> "a < b & \\"c\\"" .
<https://mooon.site/resource/work/w1> <https://mooon.site/ontology/localNote> "x" .
`;

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

test('RDF/XML round-trips to the same triples', async () => {
  const quads = new Parser({ format: 'N-Triples' }).parse(NT);
  const xml = toRdfXml(quads as any, { bf: 'http://id.loc.gov/ontologies/bibframe/' });
  assert.match(xml, /xmlns:bf="http:\/\/id\.loc\.gov\/ontologies\/bibframe\/"/);
  assert.match(xml, /xml:lang="ar"/);
  const back = await parseRdfXml(xml);
  assert.deepEqual(back.map(key).sort(), quads.map(key).sort());
  // The two Title statements stay on one blank node.
  const titleNodes = new Set(back.filter((q) => q.subject.termType === 'BlankNode').map((q) => q.subject.value));
  assert.equal(titleNodes.size, 1);
});

test('a predicate with no XML-safe local name is refused, not written wrong', () => {
  const quads = new Parser({ format: 'N-Triples' }).parse('<http://e/s> <http://e/p/1x> "v" .');
  assert.throws(() => toRdfXml(quads as any), /cannot be written/);
});
