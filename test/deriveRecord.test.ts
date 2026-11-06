// Copy and derive: a new edition keeps the Work and only the stable parts of the Instance; a translation
// is a new Work linked by bf:translationOf. Neither takes the source record's URIs, identifiers or copies.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deriveRecord } from '../src/services/deriveRecord';

const doc = JSON.parse(readFileSync(new URL('../public/records/al-qabasat.jsonld', import.meta.url), 'utf8'));
const work = doc['@graph'].find((n: any) => String(n['@type']).includes('Work'));
const instance = doc['@graph'].find((n: any) => String(n['@type']).includes('Instance'));
const ids = { work: 'https://mooon.site/resource/work/new1', instance: 'https://mooon.site/resource/instance/new1' };
const OLD = /mooon\.site\/resource\/(work|instance)\/b125923/;

test('new edition: same Work content, fresh Instance with title and carrier only', () => {
  const d = deriveRecord({ work, instance }, 'edition', ids);
  assert.equal(d.work['@id'], ids.work);
  assert.deepEqual(d.instance['bf:instanceOf'], { '@id': ids.work });
  assert.deepEqual(d.work['bf:contribution'], work['bf:contribution'], 'creators and their authority URIs kept');
  assert.deepEqual(d.work['bf:subject'], work['bf:subject']);
  assert.deepEqual(d.instance['bf:title'], instance['bf:title']);
  for (const gone of ['bf:identifiedBy', 'bf:provisionActivity', 'bf:extent', 'bf:editionStatement', 'bf:hasItem', 'bf:adminMetadata', 'bf:note'])
    assert.equal(d.instance[gone], undefined, `${gone} is the new edition's own`);
  assert.equal(d.work['bf:hasInstance'], undefined);
  assert.deepEqual(d.work['bf:adminMetadata'], { '@type': 'bf:AdminMetadata', 'bf:derivedFrom': { '@id': work['@id'] } });
  // Only derivedFrom may still name the source record.
  const { ['bf:adminMetadata']: _a, ...rest } = d.work;
  assert.ok(!OLD.test(JSON.stringify(rest)) && !OLD.test(JSON.stringify(d.instance)), 'no URI of the source record carried over');
});

test('new translation: linked to the original, language and title to fill, original title kept as a variant', () => {
  const d = deriveRecord({ work, instance }, 'translation', ids);
  assert.equal(d.work['bf:translationOf']['@id'], work['@id']);
  assert.equal(d.work['bf:translationOf']['rdfs:label'], 'القبسات');
  assert.equal(d.work['bf:language'], undefined);
  assert.deepEqual(d.work['bf:title'], [{ '@type': 'bf:VariantTitle', 'bf:mainTitle': 'القبسات', 'bf:variantType': 'original title' }]);
  assert.equal(d.instance['bf:title'], undefined);
  assert.deepEqual(d.work['bf:contribution'], work['bf:contribution']);
});

test('own fragment ids are dropped, outside authority URIs kept, the source is not changed', () => {
  const before = JSON.stringify({ work, instance });
  const src = {
    work: { '@id': 'https://mooon.site/resource/work/a1', '@type': 'bf:Work',
      'bf:title': { '@id': 'https://mooon.site/resource/work/a1#title', '@type': 'bf:Title', 'bf:mainTitle': 'x' },
      'bf:subject': [{ '@id': 'http://id.loc.gov/authorities/subjects/sh85068390', 'rdfs:label': 'Islamic philosophy' }] },
    instance: { '@id': 'https://mooon.site/resource/instance/a1', '@type': 'bf:Instance', 'bf:carrier': { '@id': 'http://id.loc.gov/vocabulary/carriers/nc' } },
  };
  const d = deriveRecord(src, 'edition', ids);
  assert.equal(d.work['bf:title']['@id'], undefined);
  assert.equal(d.work['bf:subject'][0]['@id'], 'http://id.loc.gov/authorities/subjects/sh85068390');
  assert.deepEqual(d.instance['bf:carrier'], { '@id': 'http://id.loc.gov/vocabulary/carriers/nc' });
  assert.equal(JSON.stringify({ work, instance }), before);
});

test('the saved record says where it came from (bf:derivedFrom in its AdminMetadata)', async () => {
  const { buildW3CJsonLd } = await import('../src/services/w3cJsonLdBuilder');
  const d = deriveRecord({ work, instance }, 'edition', ids);
  const out: any = buildW3CJsonLd({ workData: d.work, instanceData: d.instance, uriSet: { work: ids.work, instance: ids.instance, item: `${ids.instance}-item`, admin: `${ids.work}#admin`, expression: `${ids.work}#expression` } });
  const graph = out?.['@graph'] || out?.jsonld?.['@graph'] || [];
  const admin = graph.find((n: any) => String(n['@type']).includes('AdminMetadata'));
  assert.ok(admin, 'an AdminMetadata node');
  assert.deepEqual(admin['bf:derivedFrom'], [{ '@id': work['@id'] }]);
});
