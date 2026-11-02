import test from 'node:test';
import assert from 'node:assert/strict';
import { Parser as N3Parser } from 'n3';
import { toTurtle, toRdfXml, resolvePropertyUri, KNOWN_NAMESPACES } from '../src/services/rdfGraphBuilder';
import { buildW3CJsonLd, validateW3CJsonLd, jsonLdToTurtle, jsonLdToNTriples, BIBFRAME_JSONLD_CONTEXT } from '../src/services/w3cJsonLdBuilder';
import { realLocExamples } from '../src/app/utils/realLocExamples';
import { FOLIOApiClient, FOLIO_PRESETS } from '../src/app/services/folioApiClient';
import { VuFindApiClient, VUFIND_PRESETS } from '../src/app/services/vufindApiClient';
import { toBibframeJsonLdString } from '../src/services/bibframeNormalizer';

// Helper to parse Turtle with N3 parser to guarantee syntactic validity
function parseTurtle(turtleStr: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const parser = new N3Parser();
    const quads: any[] = [];
    parser.parse(turtleStr, (error, quad) => {
      if (error) {
        reject(error);
      } else if (quad) {
        quads.push(quad);
      } else {
        resolve(quads);
      }
    });
  });
}

test('1. Turtle Serialization - Empty-property nodes and basic structures', async () => {
  const doc = {
    '@context': { ...BIBFRAME_JSONLD_CONTEXT },
    '@graph': [
      {
        '@id': 'https://moonlib.org/item/1001',
        '@type': 'bf:Item'
      },
      {
        '@id': 'https://moonlib.org/work/2002',
        '@type': ['bf:Work', 'bflc:TranscribedWork']
      }
    ]
  };

  const ttl = toTurtle(doc);
  assert.ok(ttl.includes('<https://moonlib.org/item/1001>') && ttl.includes('a bf:Item .'), 'Must serialize empty-property node ending with period');

  // Must parse cleanly in N3 parser
  const quads = await parseTurtle(ttl);
  assert.ok(quads.length >= 3, `Expected at least 3 triples, got ${quads.length}`);
});

test('2. Turtle Serialization - Nested blank nodes with no trailing period inside brackets', async () => {
  const doc = {
    '@context': { ...BIBFRAME_JSONLD_CONTEXT },
    '@graph': [
      {
        '@id': 'https://moonlib.org/work/3003',
        '@type': 'bf:Work',
        'bf:title': [
          {
            '@type': 'bf:Title',
            'bf:mainTitle': [{ '@value': 'The Shining Moon' }],
            'bf:subtitle': [{ '@value': 'A Historical Survey' }]
          }
        ],
        'bf:contribution': [
          {
            '@type': 'bf:Contribution',
            'bf:agent': {
              '@type': 'bf:Person',
              'rdfs:label': 'Ibn Battuta'
            },
            'bf:role': [{ '@id': 'http://id.loc.gov/vocabulary/relators/aut' }]
          }
        ]
      }
    ]
  };

  const ttl = toTurtle(doc);
  assert.ok(ttl.includes('bf:title ['), 'Must use blank node property list syntax');
  assert.ok(ttl.includes('bf:mainTitle "The Shining Moon"'), 'Must serialize main title');
  assert.ok(ttl.includes('rdfs:label "Ibn Battuta"'), 'Must serialize nested agent label');

  // N3 parse check
  const quads = await parseTurtle(ttl);
  assert.ok(quads.length > 0, 'Quads must be extracted');
});

test('3. Turtle Serialization - Blank nodes without @type must not serialize as JSON string', async () => {
  const doc = {
    '@context': { ...BIBFRAME_JSONLD_CONTEXT },
    '@graph': [
      {
        '@id': 'https://moonlib.org/work/4004',
        '@type': 'bf:Work',
        'bf:note': {
          'rdfs:label': 'A manuscript note'
        }
      }
    ]
  };

  const ttl = toTurtle(doc);
  assert.ok(!ttl.includes('"{'), 'Must NOT stringify objects into JSON strings');
  assert.ok(ttl.includes('rdfs:label "A manuscript note"'), 'Must format inner property');

  const quads = await parseTurtle(ttl);
  assert.ok(quads.length >= 2, 'Must parse blank node note');
});

test('4. Turtle Serialization - URI references, language literals, and typed literals', async () => {
  const doc = {
    '@context': { ...BIBFRAME_JSONLD_CONTEXT },
    '@graph': [
      {
        '@id': 'https://moonlib.org/work/5005',
        '@type': 'bf:Work',
        'bf:title': {
          '@type': 'bf:Title',
          'bf:mainTitle': { '@value': 'القبسات', '@language': 'ara' }
        },
        'bf:originDate': { '@value': '1650', '@type': 'xsd:gYear' },
        'bf:language': { '@id': 'http://id.loc.gov/vocabulary/languages/ara' },
        'bf:hasInstance': { '@id': '_:b99' }
      },
      {
        '@id': '_:b99',
        '@type': 'bf:Instance',
        'bf:instanceOf': { '@id': 'https://moonlib.org/work/5005' }
      }
    ]
  };

  const ttl = toTurtle(doc);
  assert.ok(ttl.includes('"القبسات"@ara'), 'Must format language-tagged literal');
  assert.ok(ttl.includes('"1650"^^xsd:gYear'), 'Must format typed literal');
  assert.ok(ttl.includes('<http://id.loc.gov/vocabulary/languages/ara>'), 'Must format URI reference');
  assert.ok(ttl.includes('_:b99'), 'Must format blank node reference without angle brackets');
  assert.ok(!ttl.includes('<_:b99>'), 'Must NOT wrap blank node ID in angle brackets');

  const quads = await parseTurtle(ttl);
  assert.ok(quads.length >= 6, 'All quads must parse');
});

test('5. Turtle Serialization - Empty arrays must be omitted and not create invalid syntax', async () => {
  const doc = {
    '@context': { ...BIBFRAME_JSONLD_CONTEXT },
    '@graph': [
      {
        '@id': 'https://moonlib.org/work/6006',
        '@type': 'bf:Work',
        'bf:subject': [],
        'bf:note': []
      }
    ]
  };

  const ttl = toTurtle(doc);
  assert.ok(!ttl.includes('bf:subject ()'), 'Empty array must not be output as empty collection');
  const quads = await parseTurtle(ttl);
  assert.strictEqual(quads.length, 1, 'Only rdf:type quad should exist');
});

test('6. RDF/XML Serialization - Preserves actual namespaces and local names', () => {
  const doc = {
    '@context': { ...BIBFRAME_JSONLD_CONTEXT },
    '@graph': [
      {
        '@id': 'https://moonlib.org/work/7007',
        '@type': 'bf:Work',
        'http://purl.org/dc/terms/title': 'Dublin Core Title',
        'http://www.w3.org/2000/01/rdf-schema#label': 'RDFS Label',
        'http://id.loc.gov/vocabulary/relators/aut': { '@id': 'http://id.loc.gov/authorities/names/n85043844' },
        'http://www.loc.gov/mads/rdf/v1#authoritativeLabel': { '@value': 'Islamic Philosophy', '@language': 'en' },
        'bf:title': {
          '@type': 'bf:Title',
          'bf:mainTitle': { '@value': 'Main Title' }
        }
      }
    ]
  };

  const xml = toRdfXml(doc);
  assert.ok(xml.includes('xmlns:dcterms="http://purl.org/dc/terms/"'), 'Must declare dcterms namespace');
  assert.ok(xml.includes('xmlns:relators="http://id.loc.gov/vocabulary/relators/"'), 'Must declare relators namespace');
  assert.ok(xml.includes('xmlns:madsrdf="http://www.loc.gov/mads/rdf/v1#"'), 'Must declare madsrdf namespace');

  assert.ok(xml.includes('<dcterms:title>Dublin Core Title</dcterms:title>'), 'Must preserve dcterms:title tag and not rename to bf:');
  assert.ok(xml.includes('<rdfs:label>RDFS Label</rdfs:label>'), 'Must preserve rdfs:label and not rename to bf:');
  assert.ok(xml.includes('<madsrdf:authoritativeLabel xml:lang="en">Islamic Philosophy</madsrdf:authoritativeLabel>'), 'Must preserve madsrdf tag and lang attr');
  assert.ok(xml.includes('<relators:aut rdf:resource="http://id.loc.gov/authorities/names/n85043844"/>'), 'Must preserve relators:aut reference');
});

test('7. RDF/XML Serialization - Correct blank node references and typed literals', () => {
  const doc = {
    '@context': { ...BIBFRAME_JSONLD_CONTEXT },
    '@graph': [
      {
        '@id': 'https://moonlib.org/work/8008',
        '@type': 'bf:Work',
        'bf:hasInstance': { '@id': '_:b42' },
        'bf:originDate': { '@value': '2024', '@type': 'xsd:gYear' }
      },
      {
        '@id': '_:b42',
        '@type': 'bf:Instance'
      }
    ]
  };

  const xml = toRdfXml(doc);
  assert.ok(xml.includes('rdf:nodeID="b42"'), 'Blank node reference must use rdf:nodeID, not rdf:resource');
  assert.ok(!xml.includes('rdf:resource="_:b42"'), 'Must never emit rdf:resource="_:b42"');
  assert.ok(xml.includes('rdf:datatype="http://www.w3.org/2001/XMLSchema#gYear"'), 'RDF/XML datatype must be full URI, not xsd:gYear');
});

test('8. W3C JSON-LD Builder - Preserves WEMI Work/Instance/Item links and Expression', () => {
  const uriSet = {
    work: 'https://moonlib.org/work/w1',
    instance: 'https://moonlib.org/instance/i1',
    item: 'https://moonlib.org/item/it1',
    expression: 'https://moonlib.org/expression/e1',
    admin: 'https://moonlib.org/admin/a1'
  };

  const inputWithoutExpr = {
    workData: { title: 'Test Work' },
    instanceData: { title: 'Test Instance' },
    itemData: { shelfMark: 'B753.D363' },
    uriSet,
    enableExpression: false
  };

  const doc1 = buildW3CJsonLd(inputWithoutExpr);
  const work1 = doc1['@graph'].find(n => n['@id'] === uriSet.work);
  const inst1 = doc1['@graph'].find(n => n['@id'] === uriSet.instance);
  const item1 = doc1['@graph'].find(n => n['@id'] === uriSet.item);

  assert.ok(work1, 'Work node must exist');
  assert.ok(inst1, 'Instance node must exist');
  assert.ok(item1, 'Item node must exist');

  assert.deepEqual(work1['bf:hasInstance'], [{ '@id': uriSet.instance }], 'Work must link to Instance');
  assert.deepEqual(inst1['bf:instanceOf'], { '@id': uriSet.work }, 'Instance must link to Work');
  assert.deepEqual(inst1['bf:hasItem'], [{ '@id': uriSet.item }], 'Instance must link to Item');
  assert.deepEqual(item1['bf:itemOf'], { '@id': uriSet.instance }, 'Item must link to Instance');

  // With Expression
  const inputWithExpr = {
    ...inputWithoutExpr,
    expressionData: { language: 'ara' },
    enableExpression: true
  };
  const doc2 = buildW3CJsonLd(inputWithExpr);
  const work2 = doc2['@graph'].find(n => n['@id'] === uriSet.work);
  const expr2 = doc2['@graph'].find(n => n['@id'] === uriSet.expression);
  const inst2 = doc2['@graph'].find(n => n['@id'] === uriSet.instance);

  assert.ok(expr2, 'Expression node must exist when enabled');
  assert.deepEqual(work2['bf:hasExpression'], [{ '@id': uriSet.expression }], 'Work must link to Expression');
  assert.deepEqual(expr2['bf:expressionOf'], { '@id': uriSet.work }, 'Expression must link to Work');
  assert.deepEqual(inst2['bf:instanceOf'], { '@id': uriSet.expression }, 'Instance must link to Expression');
});

test('9. Validation - Structural vs Semantic error separation', () => {
  // A document with missing @context (Structural error)
  const invalidStructure = {
    '@graph': [{ '@id': 'https://moonlib.org/work/1', '@type': 'bf:Work' }]
  };
  const val1 = validateW3CJsonLd(invalidStructure);
  assert.strictEqual(val1.valid, false, 'Invalid structure must not be valid');
  assert.strictEqual(val1.structural.valid, false, 'Structural check must fail');
  assert.ok(val1.structural.errors.some(e => e.includes('@context')), 'Must report missing @context');

  // A document that is structurally valid (valid IDs, valid context) but fails BIBFRAME semantic rules (missing Work/Instance/title)
  const structurallyValidOnly = {
    '@context': { ...BIBFRAME_JSONLD_CONTEXT },
    '@graph': [
      {
        '@id': 'https://moonlib.org/someEntity/1',
        '@type': 'rdfs:Resource',
        'rdfs:label': 'A generic resource'
      }
    ]
  };
  const val2 = validateW3CJsonLd(structurallyValidOnly);
  assert.strictEqual(val2.structural.valid, true, 'Structure itself is valid JSON-LD');
  assert.strictEqual(val2.semantic.valid, false, 'Semantic check must fail because bf:Work and bf:Instance are missing');
  assert.strictEqual(val2.valid, false, 'Overall valid must be false: not labeled valid BIBFRAME');
  assert.ok(val2.semantic.errors.some(e => e.includes('bf:Work')), 'Must report missing bf:Work');
});

test('10. Moon Wolf Representative Record - Al-Qabasat full cycle verification', async () => {
  const exampleRecord = realLocExamples[0].data;
  assert.ok(exampleRecord, 'Al-Qabasat example record must exist in realLocExamples');

  const uriSet = {
    work: 'http://id.loc.gov/resources/works/b125923',
    instance: 'http://id.loc.gov/resources/instances/b125923-inst',
    item: 'http://id.loc.gov/resources/items/b125923-item',
    expression: 'http://id.loc.gov/resources/expressions/b125923-expr',
    admin: 'http://id.loc.gov/resources/admin/b125923-admin'
  };

  const w3cDoc = buildW3CJsonLd({
    workData: exampleRecord.work,
    instanceData: exampleRecord.instance,
    itemData: exampleRecord.item || { shelfMark: 'B753.D363 Q23 1650' },
    adminData: exampleRecord.admin || {},
    uriSet,
    enableExpression: false
  });

  // 1. Validation check
  const val = validateW3CJsonLd(w3cDoc);
  assert.strictEqual(val.structural.valid, true, 'Representative record must be structurally valid');
  assert.strictEqual(val.semantic.valid, true, `Representative record must be semantically valid BIBFRAME: ${val.semantic.errors.join(', ')}`);
  assert.strictEqual(val.valid, true, 'Overall validation must be true');

  // 2. Turtle serialization and N3 parse check
  const ttl = jsonLdToTurtle(w3cDoc);
  assert.ok(ttl.length > 500, 'Turtle output must have substantial content');
  const quads = await parseTurtle(ttl);
  assert.ok(quads.length >= 10, `Representative record must yield at least 10 quads, got ${quads.length}`);

  // 3. RDF/XML serialization check
  const xml = toRdfXml(w3cDoc);
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), 'Must have XML declaration');
  assert.ok(xml.includes('<rdf:RDF'), 'Must have rdf:RDF root');
  assert.ok(xml.includes('<bf:Work rdf:about="http://id.loc.gov/resources/works/b125923">'), 'Must contain bf:Work node');
  assert.ok(xml.includes('<bf:Instance rdf:about="http://id.loc.gov/resources/instances/b125923-inst">'), 'Must contain bf:Instance node');
  assert.ok(xml.includes('القبسات'), 'Must contain Arabic title text');

  // 4. N-Triples serialization check
  const nt = jsonLdToNTriples(w3cDoc);
  assert.ok(nt.length > 500, 'N-Triples must be non-empty');
  assert.ok(!nt.includes('<_:'), 'N-Triples must not contain <_:>');
});

test('11. FOLIO Integration - Local stack presets for D:\\folio', () => {
  assert.strictEqual(FOLIO_PRESETS.local.okapiUrl, 'http://localhost:9130', 'Okapi default port must be 9130');
  assert.strictEqual(FOLIO_PRESETS.local.tenant, 'diku', 'Default tenant must be diku');
  assert.strictEqual(FOLIO_PRESETS.local.uiUrl, 'http://localhost:3000', 'Local Stripes UI must be port 3000');

  const client = new FOLIOApiClient(FOLIO_PRESETS.local);
  assert.strictEqual(client.getConfig().okapiUrl, 'http://localhost:9130');
  assert.strictEqual(client.getConfig().tenant, 'diku');
});

test('12. FOLIO Integration - Bi-directional BIBFRAME to FOLIO Instance conversion', () => {
  const exampleRecord = realLocExamples[0].data;
  const uriSet = {
    work: 'http://id.loc.gov/resources/works/b125923',
    instance: 'http://id.loc.gov/resources/instances/b125923-inst',
    item: 'http://id.loc.gov/resources/items/b125923-item'
  };

  const w3cDoc = buildW3CJsonLd({
    workData: exampleRecord.work,
    instanceData: exampleRecord.instance,
    itemData: exampleRecord.item || {},
    adminData: exampleRecord.admin || {},
    uriSet,
    enableExpression: false
  });

  const client = new FOLIOApiClient(FOLIO_PRESETS.local);

  // A. From W3C JSON-LD doc
  const folioFromW3C = client.bibframeToFOLIOInstance(w3cDoc);
  assert.strictEqual(folioFromW3C.source, 'BIBFRAME', 'Source must be BIBFRAME');
  assert.ok(folioFromW3C.title && folioFromW3C.title.includes('القبسات'), 'Title must contain Arabic mainTitle');
  assert.ok(Array.isArray(folioFromW3C.contributors) && folioFromW3C.contributors.length > 0, 'Contributors must be populated');
  assert.ok(folioFromW3C.contributors.some(c => c.name.includes('الداماد') || c.name.includes('محمد باقر')), 'Must include author');
  assert.ok(folioFromW3C.instanceTypeId, 'Instance type ID must be present for mod-inventory');

  // B. From WolfMoon raw editor state
  const folioFromEditor = client.bibframeToFOLIOInstance({
    workData: exampleRecord.work,
    instanceData: exampleRecord.instance,
  });
  assert.strictEqual(folioFromEditor.source, 'BIBFRAME');
  assert.ok(folioFromEditor.title && folioFromEditor.title.includes('القبسات'));
  assert.ok(folioFromEditor.contributors && folioFromEditor.contributors.length > 0);
});

test('13. VuFind Integration - Local stack presets for D:\\vufind', () => {
  assert.strictEqual(VUFIND_PRESETS.local.baseUrl, 'http://localhost:8080', 'VuFind portal port must be 8080');
  assert.strictEqual(VUFIND_PRESETS.local.solrUrl, 'http://localhost:8983/solr/biblio', 'Solr default core must be biblio on 8983');

  const client = new VuFindApiClient(VUFIND_PRESETS.local);
  assert.strictEqual(client.getConfig().baseUrl, 'http://localhost:8080');
  assert.strictEqual(client.getConfig().solrUrl, 'http://localhost:8983/solr/biblio');
});

test('14. VuFind Integration - BIBFRAME to VuFind Solr doc mapping and two-way conversion', () => {
  const exampleRecord = realLocExamples[0].data;
  const uriSet = {
    work: 'http://id.loc.gov/resources/works/b125923',
    instance: 'http://id.loc.gov/resources/instances/b125923-inst',
    item: 'http://id.loc.gov/resources/items/b125923-item'
  };

  const w3cDoc = buildW3CJsonLd({
    workData: exampleRecord.work,
    instanceData: exampleRecord.instance,
    itemData: exampleRecord.item || {},
    adminData: exampleRecord.admin || {},
    uriSet,
    enableExpression: false
  });

  const client = new VuFindApiClient(VUFIND_PRESETS.local);

  // A. From W3C JSON-LD doc to Solr doc
  const solrDoc = client.bibframeToVuFindSolr(w3cDoc);
  assert.strictEqual(solrDoc.record_format, 'bibframe', 'Record format must be bibframe');
  assert.ok(solrDoc.title && solrDoc.title.includes('القبسات'), 'Title must contain Arabic text');
  assert.ok(solrDoc.author && (solrDoc.author.includes('الداماد') || solrDoc.author.includes('محمد باقر')), 'Author must be extracted');
  assert.ok(Array.isArray(solrDoc.format) && solrDoc.format.includes('Book'), 'Format must include Book');
  assert.ok(solrDoc.fulltext && solrDoc.fulltext.includes('القبسات'), 'Fulltext must include title words');

  // B. From raw editor state to Solr doc
  const solrFromEditor = client.bibframeToVuFindSolr({
    workData: exampleRecord.work,
    instanceData: exampleRecord.instance,
  });
  assert.ok(solrFromEditor.title.includes('القبسات'));
  assert.ok(solrFromEditor.author.includes('محمد باقر'));

  // C. Two-way conversion: VuFind search record back to Moon BIBFRAME
  const mockVuFindRecord = {
    id: 'vf-12345',
    title: 'تاريخ الفلسفة الإسلامية',
    titleFull: 'تاريخ الفلسفة الإسلامية في العصر الحديث',
    authors: ['هنري كوربان'],
    publishers: ['دار النهار'],
    publicationDates: ['1983'],
    places: ['بيروت'],
    isbns: ['978-2-07-032212-1'],
    languages: ['ara'],
    formats: ['Book']
  };

  const importedBF = client.vufindRecordToBibframe(mockVuFindRecord);
  assert.strictEqual(importedBF.work.title, 'تاريخ الفلسفة الإسلامية');
  assert.strictEqual(importedBF.work.author, 'هنري كوربان');
  assert.strictEqual(importedBF.instance.publisher, 'دار النهار');
  assert.strictEqual(importedBF.instance.isbn, '978-2-07-032212-1');
  assert.strictEqual(importedBF.admin.vufindId, 'vf-12345');
});

test('15. FOLIO Live Cataloging - Auto-Sync payload mapping & roundtrip preservation', () => {
  const folioClient = new FOLIOApiClient(FOLIO_PRESETS.local);

  const initialFolioInstance = {
    id: 'fol-889900',
    title: 'الإشارات والتنبيهات مع الشرح',
    contributors: [{ name: 'ابن سينا' }, { name: 'نصير الدين الطوسي' }],
    publication: [{ publisher: 'مؤسسة مطبوعات ديني', dateOfPublication: '1996', place: 'قم' }],
    identifiers: [{ value: '964-6012-00-1', identifierTypeId: '8261054f-be78-422d-bd51-4ed9f33c3422' }],
    subjects: [{ value: 'الفلسفة الإسلامية' }, { value: 'المنطق' }],
    instanceTypeId: '6312d172-f0cf-40f6-b27d-9fa8feaf332f',
    source: 'FOLIO',
  };

  // 1. Convert FOLIO instance into Moon BIBFRAME
  const bfRecord = folioClient.folioInstanceToBIBFRAME(initialFolioInstance);
  assert.strictEqual(bfRecord.title, 'الإشارات والتنبيهات مع الشرح');
  assert.strictEqual(bfRecord.workData.author, 'ابن سينا');
  assert.strictEqual(bfRecord.instanceData.isbn, '964-6012-00-1');
  assert.strictEqual(bfRecord.metadata.folioInstanceId, 'fol-889900');

  // 2. Cataloger modifies the record in Moon Wolf (enriching subjects and publisher)
  const newTitle = 'الإشارات والتنبيهات مع شرح نصير الدين الطوسي';
  bfRecord.workData.title = newTitle;
  bfRecord.workData['bf:title'] = newTitle;
  bfRecord.instanceData.title = newTitle;
  bfRecord.instanceData['bf:title'] = newTitle;
  bfRecord.instanceData.publisher = 'مؤسسة النشر الإسلامي';

  // 3. Auto-sync back to FOLIO instance payload
  const syncedFolioPayload = folioClient.bibframeToFOLIOInstance(bfRecord);
  assert.strictEqual(syncedFolioPayload.title, newTitle);
  assert.strictEqual(syncedFolioPayload.source, 'BIBFRAME');
  assert.ok(syncedFolioPayload.contributors && syncedFolioPayload.contributors.length > 0);
  assert.strictEqual(syncedFolioPayload.contributors[0].name, 'ابن سينا');
  assert.strictEqual(syncedFolioPayload.publication?.[0]?.publisher, 'مؤسسة النشر الإسلامي');
  assert.strictEqual(syncedFolioPayload.identifiers?.[0]?.value, '964-6012-00-1');
});

// ---------------------------------------------------------------------------
// Export correctness: every format must carry the same BIBFRAME graph
// ---------------------------------------------------------------------------

const AUDIT_URIS = {
  work: 'https://moonlib.org/work/a1',
  expression: 'https://moonlib.org/expression/a1-1',
  instance: 'https://moonlib.org/instance/a1',
  item: 'https://moonlib.org/item/a1-1',
  admin: 'https://moonlib.org/admin/a1'
};
const AUSTEN = 'http://id.loc.gov/authorities/names/n79032879';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const RDFS_LABEL = 'http://www.w3.org/2000/01/rdf-schema#label';
const BF = 'http://id.loc.gov/ontologies/bibframe/';

function auditRecord(work: any, instance: any, item: any = {}) {
  return buildW3CJsonLd({ workData: work, instanceData: instance, itemData: item, uriSet: AUDIT_URIS });
}

test('16. Turtle and N-Triples keep authority IRIs together with their labels', async () => {
  const doc = auditRecord({
    'bf:title': { 'bf:mainTitle': 'Pride and prejudice' },
    'bf:contribution': [{ 'bf:agent': { '@id': AUSTEN, '@type': 'bf:Person', 'rdfs:label': 'Austen, Jane, 1775-1817' } }]
  }, { 'bf:title': { 'bf:mainTitle': 'Pride and prejudice' } });

  for (const quads of [await parseTurtle(jsonLdToTurtle(doc)), new N3Parser({ format: 'N-Triples' }).parse(jsonLdToNTriples(doc))]) {
    assert.ok(quads.some(q => q.predicate.value === `${BF}agent` && q.object.value === AUSTEN), 'contribution must link to the LC name IRI');
    assert.ok(quads.some(q => q.subject.value === AUSTEN && q.predicate.value === RDFS_LABEL && q.object.value === 'Austen, Jane, 1775-1817'), 'the IRI keeps its label');
    assert.ok(quads.some(q => q.subject.value === AUSTEN && q.predicate.value === RDF_TYPE && q.object.value === `${BF}Person`), 'the IRI keeps its type');
  }
});

test('17. Vocabulary fields: codes become id.loc.gov IRIs, free text becomes a labelled node', () => {
  const doc = auditRecord({ 'bf:language': 'English' }, {
    'bf:issuance': 'مخطوط وحيد / أحادي (Single unit)',
    'bf:carrier': 'nc',
    'bf:media': { 'rdfs:label': 'unmediated' }
  });
  const nt = jsonLdToNTriples(doc);
  assert.doesNotThrow(() => new N3Parser({ format: 'N-Triples' }).parse(nt), 'N-Triples must stay parseable');
  assert.ok(nt.includes('<http://id.loc.gov/vocabulary/carriers/nc>'));
  assert.ok(!/vocabulary\/[A-Za-z]+\/[^>]*[^a-z>][^>]*>/.test(nt), 'free text must never be glued onto a vocabulary IRI');
  assert.ok(nt.includes('"مخطوط وحيد / أحادي (Single unit)"') && nt.includes('"English"') && nt.includes('"unmediated"'));
});

test('18. Properties entered on the wrong entity move to the one BIBFRAME defines them for', () => {
  const doc = auditRecord(
    { 'bf:title': { 'bf:mainTitle': 'القبسات' } },
    {
      'bf:title': { 'bf:mainTitle': 'القبسات' },
      'bf:heldBy': { '@type': 'bf:Organization', 'rdfs:label': 'العتبة العباسية' },
      'bf:itemOf': { '@id': 'https://moonlib.org/instance/stale' },
      'bf:originDate': '1650',
      'bf:edition': 'نسخة كاملة'
    }
  );
  const byType = (t: string) => doc['@graph'].find((n: any) => [].concat(n['@type']).includes(t));
  const instance = byType('bf:Instance'), item = byType('bf:Item'), work = byType('bf:Work');
  assert.ok(!instance['bf:heldBy'] && item['bf:heldBy'], 'heldBy belongs to the Item');
  assert.ok(!instance['bf:itemOf'], 'record links are built, never copied from form data');
  assert.ok(!instance['bf:originDate'] && work['bf:originDate'], 'originDate belongs to the Work');
  assert.ok(!instance['bf:edition'] && instance['moonext:edition'], 'a property of another class is kept as a Moon extension');
});

test('19. Dates are only typed when valid; call numbers keep their item portion', () => {
  const doc = auditRecord({
    'bf:originDate': '1650 [1061 هـ.]',
    'bf:classification': { '@type': 'bf:ClassificationLcc', 'bf:classificationPortion': 'PS3562.E353', 'bf:itemPortion': 'T6 2002' }
  }, { 'bf:provisionActivity': [{ '@type': 'bf:Publication', 'bf:date': '2002' }], 'bf:copyrightDate': 'c2002' });
  const ttl = jsonLdToTurtle(doc);
  assert.ok(ttl.includes('"1650 [1061 هـ.]"') && !ttl.includes('"1650 [1061 هـ.]"^^'), 'non-year text is a plain literal');
  assert.ok(ttl.includes('"2002"^^xsd:gYear'));
  assert.ok(ttl.includes('"c2002"') && !ttl.includes('"c2002"^^'));
  assert.ok(ttl.includes('bf:itemPortion "T6 2002"'));
});

test('20. Primary contribution and description language follow the record', () => {
  const doc = auditRecord({
    'bf:contribution': [
      { 'bf:agent': { 'rdfs:label': 'Editor, An' }, 'bf:role': { '@id': 'http://id.loc.gov/vocabulary/relators/edt' } },
      { 'bf:agent': { 'rdfs:label': 'Author, An' }, 'bf:role': { '@id': 'http://id.loc.gov/vocabulary/relators/aut' } }
    ],
    'bf:adminMetadata': { 'bf:descriptionLanguage': 'ara', 'bf:descriptionConventions': 'RDA', 'bf:source': 'IQ-KaCCS' }
  }, {});
  const work = doc['@graph'].find((n: any) => n['@type'] === 'bf:Work');
  const primary = work['bf:contribution'].filter((c: any) => [].concat(c['@type']).includes('bf:PrimaryContribution'));
  assert.strictEqual(primary.length, 1);
  assert.strictEqual(primary[0]['bf:agent']['rdfs:label'], 'Author, An', 'the author, not the first-listed editor, is primary');
  const admin = doc['@graph'].find((n: any) => n['@type'] === 'bf:AdminMetadata');
  assert.deepStrictEqual(admin['bf:descriptionLanguage'], [{ '@id': 'http://id.loc.gov/vocabulary/languages/ara' }]);
  assert.deepStrictEqual(admin['bf:descriptionConventions'], [{ '@id': 'http://id.loc.gov/vocabulary/descriptionConventions/rda' }]);
  assert.strictEqual(admin['bf:assigner'][0]['rdfs:label'], 'IQ-KaCCS');
});

test('21. No placeholder titles; a title entered once describes both Work and Instance', () => {
  const lookedUp = auditRecord({ 'bf:title': { 'bf:mainTitle': 'The Muqaddimah' } }, {});
  const instance = lookedUp['@graph'].find((n: any) => n['@type'] === 'bf:Instance');
  assert.strictEqual(instance['bf:title'][0]['bf:mainTitle'][0]['@value'], 'The Muqaddimah');
  const empty = jsonLdToTurtle(auditRecord({}, {}));
  assert.ok(!/Untitled|بدون عنوان/.test(empty), 'an empty record must not invent a title');
  assert.strictEqual(validateW3CJsonLd(auditRecord({}, {})).semantic.valid, false, 'validation still asks for a title');
});

test('22. Invalid ids never become IRIs (AI-suggested or internal authority ids)', async () => {
  const doc = auditRecord({
    'bf:contribution': [{ 'bf:agent': { '@id': 'ai-1730000000000', '@type': 'bf:Person', 'rdfs:label': 'ابن خلدون' } }],
    'bf:subject': [{ '@id': 'Q42 local', '@type': 'bf:Topic', 'rdfs:label': 'تاريخ' }]
  }, { 'bf:title': 'مقدمة' });
  const ttl = jsonLdToTurtle(doc);
  await parseTurtle(ttl);
  assert.doesNotThrow(() => new N3Parser({ format: 'N-Triples' }).parse(jsonLdToNTriples(doc)));
  assert.ok(!ttl.includes('ai-1730000000000') && !ttl.includes('Q42 local'));
  assert.ok(ttl.includes('<https://moonlib.org/work/a1/agent/0>'), 'the contributor falls back to a minted URI');
});

test('23. Editor session defaults never override the record; exports follow LC conventions', async () => {
  const editorAdmin = {
    '@type': 'bf:AdminMetadata',
    'bf:descriptionLanguage': { '@id': 'http://id.loc.gov/vocabulary/languages/eng' },
    'bf:catalogerId': 'tester'
  };
  const doc = buildW3CJsonLd({
    workData: {
      'bf:title': { 'bf:mainTitle': 'القبسات' }, 'bf:content': 'txt', 'bf:language': 'ara',
      'bf:contribution': [{ '@type': 'bflc:PrimaryContribution', 'bf:agent': { 'rdfs:label': 'الميرداماد' } }],
      'bf:adminMetadata': { 'bf:descriptionLanguage': 'ara' }
    },
    instanceData: {}, adminData: editorAdmin, uriSet: AUDIT_URIS
  });
  const admin = doc['@graph'].find((n: any) => n['@type'] === 'bf:AdminMetadata');
  assert.deepStrictEqual(admin['bf:descriptionLanguage'], [{ '@id': 'http://id.loc.gov/vocabulary/languages/ara' }]);
  assert.strictEqual(admin['bflc:catalogerId'][0]['@value'], 'tester');

  const quads = await parseTurtle(jsonLdToTurtle(doc));
  const has = (p: string, o: string) => quads.some(q => q.predicate.value === p && q.object.value === o);
  assert.ok(has(RDF_TYPE, `${BF}PrimaryContribution`) && !has(RDF_TYPE, 'http://id.loc.gov/ontologies/bflc/PrimaryContribution'), 'bflc:PrimaryContribution is deprecated');
  assert.ok(has(RDF_TYPE, `${BF}Text`), 'a txt Work is also a bf:Text');
  assert.ok(quads.some(q => q.object.value === 'القبسات' && q.object.language === 'ar-arab'), 'Arabic script is language-tagged');
  const inMemory = doc['@graph'].find((n: any) => n['@type'] === 'bf:Work');
  assert.strictEqual(typeof inMemory['bf:title'][0]['bf:mainTitle'][0]['@value'], 'string', 'editors reading the builder output keep plain values');
});

test('24. OPAC exports: one BIBFRAME producer, no made-up holdings', async () => {
  // The OPAC service loads the live catalog on import; keep this test offline.
  const store: Record<string, string> = {};
  (globalThis as any).localStorage ??= { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; }, removeItem: (k: string) => { delete store[k]; } };
  const realFetch = globalThis.fetch;
  (globalThis as any).fetch = async () => ({ ok: false, status: 503, json: async () => ({}), text: async () => '' });
  try {
    const { wolfMoonOpacService } = await import('../src/services/wolfMoonOpacService');
    const work: any = {
      id: 'w1', uri: 'https://moonlib.org/work/w1', title: 'القبسات', language: 'ara', subjects: [],
      primaryCreator: { nameArabic: 'الميرداماد', uri: undefined },
      instances: [{
        id: 'i1', uri: 'https://moonlib.org/instance/i1', title: 'القبسات',
        items: [{ id: 'it1', uri: 'https://moonlib.org/item/i1-1', heldBy: 'المكتبة المركزية', shelfMark: 'PJ7862 .A1', barcode: '31924000000001', synthetic: true }]
      }]
    };
    const ttl = wolfMoonOpacService.generateTurtleRdf(work);
    const quads = await parseTurtle(ttl);
    assert.ok(!ttl.includes('PJ7862') && !ttl.includes('31924000000001'), 'placeholder copies are never exported');
    assert.ok(!ttl.includes('undefined'));
    assert.ok(!ttl.includes('bflc:PrimaryContribution'));
    assert.ok(quads.some(q => q.predicate.value === `${BF}instanceOf` && q.object.value === 'https://moonlib.org/work/w1'));

    const saved: any = { ...work, document: { work: { 'bf:title': { 'bf:mainTitle': 'القبسات' } }, instance: {}, metadata: { uriSet: AUDIT_URIS } } };
    const fromRecord = await parseTurtle(wolfMoonOpacService.generateTurtleRdf(saved));
    const fromEditor = await parseTurtle(jsonLdToTurtle(auditRecord({ 'bf:title': { 'bf:mainTitle': 'القبسات' } }, {})));
    const norm = (qs: any[]) => qs.filter(q => !/(creation|change)Date/.test(q.predicate.value)).map(q => `${q.subject.termType === 'BlankNode' ? '_' : q.subject.value} ${q.predicate.value} ${q.object.termType === 'BlankNode' ? '_' : q.object.value}`).sort();
    assert.deepStrictEqual(norm(fromRecord), norm(fromEditor), 'a saved record exports from the OPAC exactly as from the editor');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('25. Import: LC-style expanded JSON-LD keeps parallel scripts, exact identifiers and Work classes', async () => {
  const { importBibframe } = await import('../src/services/bibframeImport');
  const B = 'http://id.loc.gov/ontologies/bibframe/';
  const lc = [
    { '@id': 'http://id.loc.gov/resources/works/1', '@type': [`${B}Work`, `${B}Text`, `${B}Manuscript`],
      [`${B}title`]: [{ '@id': '_:t1' }], [`${B}hasInstance`]: [{ '@id': 'http://id.loc.gov/resources/instances/1' }],
      [`${B}classification`]: [{ '@id': '_:c1' }] },
    { '@id': '_:t1', '@type': [`${B}Title`], [`${B}mainTitle`]: [{ '@value': 'al-Qabasāt' }, { '@value': 'القبسات', '@language': 'ar-arab' }] },
    { '@id': '_:c1', '@type': [`${B}ClassificationLcc`], [`${B}classificationPortion`]: [{ '@value': 'B753.D363' }],
      [`${B}assigner`]: [{ '@id': 'http://id.loc.gov/vocabulary/organizations/dlc' }] },
    { '@id': 'http://id.loc.gov/resources/instances/1', '@type': [`${B}Instance`], [`${B}instanceOf`]: [{ '@id': 'http://id.loc.gov/resources/works/1' }],
      [`${B}identifiedBy`]: [{ '@id': '_:i1' }],
      [`${B}responsibilityStatement`]: [{ '@value': 'Mīr Dāmād' }, { '@value': 'الميرداماد', '@language': 'ar-arab' }],
      [`${B}provisionActivity`]: [{ '@id': '_:p1' }] },
    { '@id': '_:i1', '@type': [`${B}Lccn`], 'http://www.w3.org/1999/02/22-rdf-syntax-ns#value': [{ '@value': ' 2016496993' }] },
    { '@id': '_:p1', '@type': [`${B}Production`], 'http://id.loc.gov/ontologies/bflc/simpleDate': [{ '@value': '[17th century?]' }] }
  ];
  const rec = await importBibframe(JSON.stringify(lc), 'jsonld');
  const quads = await parseTurtle(jsonLdToTurtle(buildW3CJsonLd({ workData: rec!.work, instanceData: rec!.instance, uriSet: AUDIT_URIS })));
  const lit = (v: string, lang?: string) => quads.some(q => q.object.value === v && (lang === undefined || q.object.language === lang));
  assert.ok(lit('al-Qabasāt') && lit('القبسات', 'ar-arab'), 'both scripts of the title survive');
  assert.ok(lit('Mīr Dāmād') && lit('الميرداماد', 'ar-arab'), 'both scripts of the responsibility statement survive');
  assert.ok(lit(' 2016496993'), 'identifiers are kept exactly');
  assert.ok(lit('[17th century?]'), 'bflc:simpleDate is kept');
  assert.ok(quads.some(q => q.object.value === 'http://id.loc.gov/vocabulary/organizations/dlc'), 'classification assigner is kept');
  assert.ok(quads.some(q => q.predicate.value === RDF_TYPE && q.object.value === `${B}Manuscript`), 'more specific Work classes are kept');
});

test('26. Import: a Moon export re-imports to the same record in every format', async () => {
  const { importBibframe } = await import('../src/services/bibframeImport');
  const doc = auditRecord({
    'bf:title': { 'bf:mainTitle': 'Pride and prejudice' }, 'bf:language': 'eng', 'bf:content': 'txt',
    'bf:contribution': [{ 'bf:agent': { '@id': AUSTEN, '@type': 'bf:Person', 'rdfs:label': 'Austen, Jane, 1775-1817' }, 'bf:role': { '@id': 'http://id.loc.gov/vocabulary/relators/aut' } }],
    'bf:classification': { '@type': 'bf:ClassificationLcc', 'bf:classificationPortion': 'PR4034', 'bf:itemPortion': '.P7 2003' }
  }, { 'bf:carrier': { '@id': 'http://id.loc.gov/vocabulary/carriers/nc', 'rdfs:label': 'volume' }, 'bf:extent': '480 p.', 'bf:identifiedBy': { '@type': 'bf:Isbn', 'rdf:value': '9780141439518' } },
  { 'bf:shelfMark': 'PR4034 .P7 2003', 'bf:heldBy': 'Main Library' });
  const norm = (qs: any[]) => qs.filter(q => !/(creation|change)Date$/.test(q.predicate.value))
    .map(q => `${q.subject.termType === 'BlankNode' ? '_' : q.subject.value} ${q.predicate.value} ${q.object.termType === 'BlankNode' ? '_' : q.object.value}`).sort();
  const before = norm(await parseTurtle(jsonLdToTurtle(doc)));
  for (const [format, text] of [['jsonld', toBibframeJsonLdString(doc)], ['turtle', jsonLdToTurtle(doc)], ['ntriples', jsonLdToNTriples(doc)]] as const) {
    const rec = await importBibframe(text, format);
    const again = buildW3CJsonLd({ workData: rec!.work, instanceData: rec!.instance, itemData: rec!.item, uriSet: AUDIT_URIS });
    assert.deepStrictEqual(norm(await parseTurtle(jsonLdToTurtle(again))), before, `round trip through ${format}`);
  }
});
