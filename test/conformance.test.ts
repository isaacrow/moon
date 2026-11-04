/**
 * BIBFRAME conformance: every record Moon produces is checked the way an outside consumer
 * (LC, a triple store, Sinopia) would see it.
 *
 * 1. Each export format is parsed by an independent RDF parser (jsonld.js, N3, rdfxml-streaming-parser).
 * 2. All four formats must hold exactly the same graph (compared after RDF canonicalization).
 * 3. The graph is checked against the official ontology: only defined, non-deprecated terms;
 *    datatype properties hold literals and object properties hold nodes; every bf: property is
 *    used on a node of its rdfs:domain; typed literals are valid; language tags are BCP 47.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Readable } from 'node:stream';
import { Parser as N3Parser, Writer as N3Writer } from 'n3';
import jsonld from 'jsonld';
import { RdfXmlParser } from 'rdfxml-streaming-parser';
import { toTurtle, toRdfXml } from '../src/services/rdfGraphBuilder';
import { buildW3CJsonLd, jsonLdToNTriples } from '../src/services/w3cJsonLdBuilder';
import { toBibframeJsonLdString } from '../src/services/bibframeNormalizer';
import {
  BF_CLASSES, BF_OBJECT_PROPERTIES, BF_DATATYPE_PROPERTIES, BF_PROPERTY_DOMAINS, BF_SUPERCLASSES, BF_DEPRECATED,
  BFLC_CLASSES, BFLC_OBJECT_PROPERTIES, BFLC_DATATYPE_PROPERTIES, BFLC_DEPRECATED
} from '../src/services/bibframeTerms.generated';
import { realLocExamples } from '../src/app/utils/realLocExamples';
import { exampleWork, exampleInstance } from '../src/app/utils/exampleData';

const BF = 'http://id.loc.gov/ontologies/bibframe/';
const BFLC = 'http://id.loc.gov/ontologies/bflc/';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const XSD = 'http://www.w3.org/2001/XMLSchema#';

const URIS = {
  work: 'https://moonlib.org/work/c1',
  expression: 'https://moonlib.org/expression/c1-1',
  instance: 'https://moonlib.org/instance/c1',
  item: 'https://moonlib.org/item/c1-1',
  admin: 'https://moonlib.org/admin/c1'
};

// ---------------------------------------------------------------------------
// Parsing every format with an independent parser
// ---------------------------------------------------------------------------

const parseN3 = (text: string, format: string) => new N3Parser({ format }).parse(text);

async function parseJsonLd(text: string) {
  const nquads = await jsonld.toRDF(JSON.parse(text), { format: 'application/n-quads', safe: true } as any) as unknown as string;
  return parseN3(nquads, 'N-Quads');
}

function parseRdfXml(text: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const quads: any[] = [];
    Readable.from([text]).pipe(new RdfXmlParser({ baseIRI: 'https://moonlib.org/' }))
      .on('data', (q: any) => quads.push(q)).on('error', reject).on('end', () => resolve(quads));
  });
}

/** Canonical N-Quads (RDFC-1.0): equal strings mean isomorphic graphs, blank nodes included. */
async function canonical(quads: any[]): Promise<string> {
  const nq = new N3Writer({ format: 'N-Quads' }).quadsToString(quads);
  return await jsonld.canonize(nq, { algorithm: 'URDNA2015', inputFormat: 'application/n-quads', safe: true } as any) as unknown as string;
}

async function allFormats(doc: any) {
  return {
    jsonld: await parseJsonLd(toBibframeJsonLdString(doc)),
    turtle: parseN3(toTurtle(doc), 'Turtle'),
    ntriples: parseN3(jsonLdToNTriples(doc), 'N-Triples'),
    rdfxml: await parseRdfXml(toRdfXml(doc))
  };
}

// ---------------------------------------------------------------------------
// Ontology checks on the parsed graph
// ---------------------------------------------------------------------------

function term(iri: string): { ns: 'bf' | 'bflc'; local: string } | null {
  if (iri.startsWith(BF)) return { ns: 'bf', local: iri.slice(BF.length) };
  if (iri.startsWith(BFLC)) return { ns: 'bflc', local: iri.slice(BFLC.length) };
  return null;
}

/** The class and all its bf: superclasses. */
function ancestry(local: string, seen = new Set<string>()): Set<string> {
  if (seen.has(local)) return seen;
  seen.add(local);
  for (const s of BF_SUPERCLASSES[local] || []) ancestry(s, seen);
  return seen;
}

const LANG_TAG = /^[a-zA-Z]{2,3}(-[a-zA-Z]{4})?(-([a-zA-Z]{2}|\d{3}))?(-[a-zA-Z\d]{5,8})*$/;

export function ontologyIssues(quads: any[]): string[] {
  const issues = new Set<string>();
  const types = new Map<string, Set<string>>();
  for (const q of quads) {
    if (q.predicate.value !== RDF_TYPE) continue;
    if (q.object.termType === 'Literal') { issues.add(`rdf:type holds the literal "${q.object.value}"`); continue; }
    const t = term(q.object.value);
    if (!t) continue;
    if (t.ns === 'bf' && !BF_CLASSES.has(t.local)) issues.add(`undefined class bf:${t.local}`);
    if (t.ns === 'bflc' && !BFLC_CLASSES.has(t.local)) issues.add(`undefined class bflc:${t.local}`);
    if ((t.ns === 'bf' ? BF_DEPRECATED : BFLC_DEPRECATED).has(t.local)) issues.add(`deprecated class ${t.ns}:${t.local}`);
    if (t.ns === 'bf') {
      const set = types.get(q.subject.value) || new Set<string>();
      for (const a of ancestry(t.local)) set.add(a);
      types.set(q.subject.value, set);
    }
  }
  for (const q of quads) {
    const p = term(q.predicate.value);
    const o = q.object;
    if (o.termType === 'Literal') {
      if (!o.value.trim()) issues.add(`empty literal on ${q.predicate.value}`);
      if (o.language && !LANG_TAG.test(o.language)) issues.add(`bad language tag "${o.language}"`);
      const dt = o.datatype?.value;
      if (dt === `${XSD}gYear` && !/^-?\d{4}$/.test(o.value)) issues.add(`invalid xsd:gYear "${o.value}"`);
      if (dt === `${XSD}date` && !/^-?\d{4}-\d{2}-\d{2}$/.test(o.value)) issues.add(`invalid xsd:date "${o.value}"`);
      if (dt === `${XSD}dateTime` && Number.isNaN(Date.parse(o.value))) issues.add(`invalid xsd:dateTime "${o.value}"`);
    }
    if (!p) continue;
    const name = `${p.ns}:${p.local}`;
    const isObj = p.ns === 'bf' ? BF_OBJECT_PROPERTIES.has(p.local) : BFLC_OBJECT_PROPERTIES.has(p.local);
    const isData = p.ns === 'bf' ? BF_DATATYPE_PROPERTIES.has(p.local) : BFLC_DATATYPE_PROPERTIES.has(p.local);
    if (!isObj && !isData) { issues.add(`undefined property ${name}`); continue; }
    if ((p.ns === 'bf' ? BF_DEPRECATED : BFLC_DEPRECATED).has(p.local)) issues.add(`deprecated property ${name}`);
    if (isObj && o.termType === 'Literal') issues.add(`object property ${name} holds the literal "${o.value.slice(0, 40)}"`);
    if (isData && o.termType !== 'Literal') issues.add(`datatype property ${name} holds a node`);
    const domain = p.ns === 'bf' ? BF_PROPERTY_DOMAINS[p.local] : undefined;
    const subjectTypes = types.get(q.subject.value);
    if (domain && subjectTypes && !subjectTypes.has(domain)) {
      issues.add(`${name} used on ${[...subjectTypes][0]} (domain is bf:${domain})`);
    }
  }
  return [...issues].sort();
}

// ---------------------------------------------------------------------------
// Records under test: bundled real records, plus editor output with hard cases
// ---------------------------------------------------------------------------

const qabasat = JSON.parse(readFileSync(new URL('../public/records/al-qabasat.json', import.meta.url), 'utf8'));

const editorRecord = () => buildW3CJsonLd({
  workData: {
    '@type': 'bf:Text',
    'bf:title': [{ 'bf:mainTitle': ['القبسات', 'al-Qabasāt'], 'bf:subtitle': 'a "quoted" subtitle\nwith a line break' }],
    'bf:contribution': [
      { 'bf:agent': { '@id': 'http://id.loc.gov/authorities/names/n85043844', '@type': 'bf:Person', 'rdfs:label': 'Mīr Dāmād, Muḥammad Bāqir ibn Muḥammad, -1631' }, 'bf:role': 'aut' },
      { 'bf:agent': { 'rdfs:label': 'Copyist & <scribe>' }, 'bf:role': { 'rdfs:label': 'copyist' } }
    ],
    'bf:language': ['ara', { label: 'Persian', uri: 'http://id.loc.gov/vocabulary/languages/per' }],
    'bf:subject': [{ label: 'Islamic philosophy', uri: 'http://id.loc.gov/authorities/subjects/sh85068382' }, 'فلسفة'],
    'bf:genreForm': { '@id': 'http://id.loc.gov/authorities/genreForms/gf2014026085', 'rdfs:label': 'Manuscripts' },
    'bf:classification': { lcc: 'B753.D363 Q33 1650', ddc: '181.5' },
    'bf:content': 'txt',
    'bf:originDate': '1650',
    'bf:summary': 'A treatise on time and creation.',
    'bf:note': ['Note one', { 'rdfs:label': 'Note two', 'bf:noteType': 'general' }],
    'bf:geographicCoverage': 'a-ir',
    'bf:intendedAudience': 'Scholars',
    'bf:adminMetadata': { 'bf:descriptionLanguage': 'ara' }
  },
  instanceData: {
    '@type': 'bf:Manuscript',
    'bf:responsibilityStatement': 'Mīr Dāmād',
    'bf:editionStatement': 'Facsimile ed.',
    'bf:identifiedBy': [{ isbn: '9789953000000', lccn: ' 2016496993' }],
    'bf:provisionActivity': [{ '@type': 'bf:Production', 'bf:place': 'Isfahan', 'bf:date': '1061 هـ. = [1650]', 'bf:agent': 'Unknown workshop' }],
    'bf:extent': '214 leaves',
    'bf:dimensions': '21 cm',
    'bf:carrier': 'nc', 'bf:media': 'n', 'bf:issuance': 'mono',
    'bf:copyrightDate': 'c2002',
    'bf:heldBy': 'Misplaced on Instance Library',
    'bf:seriesStatement': 'Series ; 3'
  },
  itemData: {
    'bf:heldBy': 'Central Library',
    'bf:shelfMark': 'MS 1234',
    'bf:electronicLocator': 'https://example.net/scan?id=1&page=2',
    'bf:identifiedBy': '31924000000001',
    'bf:sublocation': 'Rare books'
  },
  uriSet: URIS
});

const expressionRecord = () => buildW3CJsonLd({
  workData: { 'bf:title': 'Original work', 'bf:language': 'ara' },
  expressionData: { 'bf:title': 'Translated expression', 'bf:language': 'eng' },
  instanceData: { 'bf:title': 'Translated expression' },
  uriSet: URIS,
  enableExpression: true
});

// Exactly what the Category Cards editors (BlankNodeEditors, AuthoritySelect) store.
const categoryCardsRecord = () => buildW3CJsonLd({
  workData: {
    'bf:title': { '@type': 'bf:Title', 'bf:mainTitle': 'كتاب الشفاء', mainTitle: 'كتاب الشفاء', 'bf:subtitle': 'الإلهيات', subtitle: 'الإلهيات' },
    'bf:contribution': [
      { '@type': 'bf:Contribution', 'bf:agent': { '@type': 'bf:Person', '@id': 'http://id.loc.gov/authorities/names/n79063767', 'rdfs:label': 'Avicenna, 980-1037' }, 'bf:role': { '@id': 'http://id.loc.gov/vocabulary/relators/aut', 'rdfs:label': 'aut' }, agent: { label: 'Avicenna, 980-1037', uri: 'http://id.loc.gov/authorities/names/n79063767' }, role: 'aut' },
      { '@type': 'bf:Contribution', 'bf:agent': { '@type': 'bf:Person', '@id': undefined, 'rdfs:label': 'Editor without a role' }, 'bf:role': { '@id': 'http://id.loc.gov/vocabulary/relators/', 'rdfs:label': '' }, agent: { label: 'Editor without a role' }, role: '' }
    ],
    'bf:language': { label: 'Arabic', uri: 'http://id.loc.gov/vocabulary/languages/ara', source: 'LOC' },
    'bf:classification': { '@type': 'bf:ClassificationLcc', 'bf:classificationPortion': 'B751', 'bf:itemPortion': '.A5 2001', scheme: 'lcc', number: 'B751 .A5 2001', classificationPortion: 'B751', itemPortion: '.A5 2001' },
    'bf:dissertation': { '@type': 'bf:Dissertation', degree: 'PhD', grantingInstitution: 'University of Baghdad', dissertationYear: '1999', dissertationIdentifier: 'D-42', dissertationNote: 'Revised thesis' },
    'bf:temporalCoverage': { '@type': 'bf:Temporal', startDate: '1000', endDate: '1100', 'rdfs:label': '1000-1100' }
  },
  instanceData: {
    'bf:identifiedBy': [{ type: 'Isbn', value: '9789953000000' }, { type: 'Oclc', value: '12345678' }, { type: 'Lccn', value: '' }],
    'bf:provisionActivity': { '@type': 'bf:Publication', 'bf:date': '2001', 'bflc:simpleDate': '2001', date: '2001', 'bf:agent': { '@type': 'bf:Organization', '@id': undefined, 'rdfs:label': 'Dar al-Kutub' }, agent: { label: 'Dar al-Kutub' }, 'bf:place': { '@type': 'bf:Place', 'rdfs:label': 'Beirut' }, place: { label: 'Beirut' } },
    'bf:hasSeries': { '@type': 'bf:Series', title: 'Silsilat al-turath', seriesEnumeration: '3', issn: '1234-5678', relationship: 'hasSeries', 'rdfs:label': 'Silsilat al-turath' }
  },
  itemData: {
    'bf:heldBy': { label: 'Library of Congress', uri: 'http://id.loc.gov/vocabulary/organizations/dlc' },
    'bf:immediateAcquisition': { '@type': 'bf:ImmediateAcquisition', source: 'Donor', date: '2020', method: 'gift', note: '', applicableInstitution: 'Main Library' }
  },
  uriSet: URIS
});

test('Category Cards: identifier, contribution, classification, dissertation and series cards become proper BIBFRAME', () => {
  const quads = parseN3(toTurtle(categoryCardsRecord()), 'Turtle');
  const typeOf = (s: any) => quads.filter(q => q.subject.equals(s) && q.predicate.value === RDF_TYPE).map(q => q.object.value);
  const valueNode = (v: string) => quads.find(q => q.predicate.value.endsWith('#value') && q.object.value === v)?.subject;
  assert.deepEqual(typeOf(valueNode('9789953000000')), [`${BF}Isbn`]);
  assert.deepEqual(typeOf(valueNode('12345678')), [`${BF}Local`]);
  assert.ok(quads.some(q => q.subject.equals(valueNode('12345678')) && q.predicate.value === `${BF}assigner` && q.object.value.endsWith('/organizations/ocolc')));
  assert.ok(!quads.some(q => /\/relators\/$/.test(q.object.value)), 'a contribution without a role never links to ".../relators/"');
  assert.ok(!quads.some(q => /ontology\/(scheme|number|relationship|dissertation\w+)$/.test(q.predicate.value)), 'card inputs never leak into the record');
  assert.ok(quads.some(q => q.predicate.value === `${BF}date` && q.object.value === '1999'), 'dissertation year is bf:date');
});

const records: [string, () => any][] = [
  ['Category Cards record', categoryCardsRecord],
  ['al-qabasat.json', () => qabasat],
  ['exampleData', () => ({ work: exampleWork, instance: exampleInstance })],
  ...realLocExamples.map((e: any) => [`realLocExamples/${e.id}`, () => e.data] as [string, () => any]),
  ['editor record with hard cases', editorRecord],
  ['editor record with an Expression', expressionRecord],
  ['empty editor record', () => buildW3CJsonLd({ workData: {}, instanceData: {}, uriSet: URIS })]
];

for (const [name, make] of records) {
  test(`Conformance: ${name}: JSON-LD, Turtle, N-Triples and RDF/XML hold the same graph`, async () => {
    const doc = make();
    const parsed = await allFormats(doc);
    const reference = await canonical(parsed.turtle);
    assert.ok(parsed.turtle.length > 3, 'expected triples');
    for (const [format, quads] of Object.entries(parsed)) {
      if (format === 'turtle') continue;
      const other = await canonical(quads);
      if (other !== reference) {
        const a = new Set(reference.split('\n')), b = new Set(other.split('\n'));
        const missing = [...a].filter(l => !b.has(l)).slice(0, 8);
        const extra = [...b].filter(l => !a.has(l)).slice(0, 8);
        assert.fail(`${format} differs from Turtle.\nOnly in Turtle:\n  ${missing.join('\n  ')}\nOnly in ${format}:\n  ${extra.join('\n  ')}`);
      }
    }
  });

  test(`Conformance: ${name}: graph conforms to the BIBFRAME 3.0.1 / BFLC ontologies`, async () => {
    const quads = parseN3(toTurtle(make()), 'Turtle');
    assert.deepEqual(ontologyIssues(quads), []);
  });
}
