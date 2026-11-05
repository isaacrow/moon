// The SHACL shapes generated from a profile, run by an independent SHACL engine (rdf-validate-shacl),
// must agree with the server's publish gate on what a record lacks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Parser as N3Parser } from 'n3';
import SHACLValidator from 'rdf-validate-shacl';
import factory from 'rdf-validate-shacl/src/defaultEnv.js';
import { missingForPublish, shapesFromProfile } from '../supabase/functions/server/publishGate.tsx';
import { MONOGRAPH_PROFILE } from '../supabase/functions/server/profiles.tsx';
import { toTurtle } from '../src/services/rdfGraphBuilder';

const dataset = (ttl: string) => factory.dataset(new N3Parser().parse(ttl) as any);
const validator = new SHACLValidator(dataset(shapesFromProfile(MONOGRAPH_PROFILE)), { factory });

const lc = (path: string) => ({ '@id': `http://id.loc.gov/vocabulary/${path}` });
const record = () => ({
  '@context': { bf: 'http://id.loc.gov/ontologies/bibframe/', rdfs: 'http://www.w3.org/2000/01/rdf-schema#' },
  '@graph': [
    { '@id': 'https://mooon.site/resource/work/r1', '@type': 'bf:Work',
      'bf:title': { '@type': 'bf:Title', 'bf:mainTitle': 'القبسات' }, 'bf:content': lc('contentTypes/txt'),
      'bf:hasInstance': { '@id': 'https://mooon.site/resource/instance/r1' } },
    { '@id': 'https://mooon.site/resource/instance/r1', '@type': 'bf:Instance',
      'bf:title': { '@type': 'bf:Title', 'bf:mainTitle': 'القبسات' },
      'bf:instanceOf': { '@id': 'https://mooon.site/resource/work/r1' },
      'bf:media': lc('mediaTypes/n'), 'bf:carrier': lc('carriers/nc'), 'bf:issuance': lc('issuance/mono') },
  ],
});

/** bf: properties the SHACL engine reports as violated (the path of each failing property shape). */
async function shaclMissing(doc: any): Promise<string[]> {
  const report = await validator.validate(dataset(toTurtle(doc)));
  const paths = report.results.map((r: any) => {
    const p = r.path?.value || '';
    return p ? `bf:${p.split('/').pop()}` : 'bf:instanceOf'; // the sh:or link check has no single path
  });
  return [...new Set(paths)].sort();
}
const gateMissing = (doc: any) => [...new Set(missingForPublish(doc).map((m) => m.field))].sort();

test('the generated shapes are valid Turtle with a node shape per resource template', () => {
  const quads = new N3Parser().parse(shapesFromProfile(MONOGRAPH_PROFILE));
  const shapes = quads.filter((q) => q.predicate.value.endsWith('#type') && q.object.value === 'http://www.w3.org/ns/shacl#NodeShape');
  assert.equal(shapes.length, MONOGRAPH_PROFILE.Profile.resourceTemplates.length);
});

test('a complete record conforms, for the SHACL engine and the gate alike', async () => {
  assert.deepEqual(await shaclMissing(record()), []);
  assert.deepEqual(gateMissing(record()), []);
});

const cases: [string, (doc: any) => void][] = [
  ['no content type', (d) => { delete d['@graph'][0]['bf:content']; }],
  ['blank Instance main title', (d) => { d['@graph'][1]['bf:title'] = { '@type': 'bf:Title', 'bf:mainTitle': '  ' }; }],
  ['no carrier and no issuance', (d) => { delete d['@graph'][1]['bf:carrier']; delete d['@graph'][1]['bf:issuance']; }],
  ['no link between Instance and Work', (d) => { delete d['@graph'][1]['bf:instanceOf']; delete d['@graph'][0]['bf:hasInstance']; }],
];
for (const [name, breakIt] of cases) {
  test(`SHACL engine and gate report the same missing fields: ${name}`, async () => {
    const doc = record();
    breakIt(doc);
    const fromGate = gateMissing(doc);
    assert.ok(fromGate.length > 0);
    assert.deepEqual(await shaclMissing(doc), fromGate);
  });
}
