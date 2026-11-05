import { test } from 'node:test';
import assert from 'node:assert/strict';
import { missingForPublish } from '../supabase/functions/server/publishGate.tsx';

const lc = (path: string) => ({ '@id': `http://id.loc.gov/vocabulary/${path}` });
const complete = () => ({
  '@graph': [
    { '@id': 'https://mooon.site/resource/work/r1', '@type': 'bf:Work',
      'bf:title': { '@type': 'bf:Title', 'bf:mainTitle': 'القبسات' }, 'bf:content': lc('contentTypes/txt') },
    { '@id': 'https://mooon.site/resource/instance/r1', '@type': ['bf:Instance', 'bf:Print'],
      'bf:title': { '@type': 'bf:Title', 'bf:mainTitle': [{ '@value': 'القبسات', '@language': 'ar' }] },
      'bf:instanceOf': { '@id': 'https://mooon.site/resource/work/r1' },
      'bf:media': lc('mediaTypes/n'), 'bf:carrier': lc('carriers/nc'), 'bf:issuance': lc('issuance/mono') },
  ],
});
const fields = (doc: any) => missingForPublish(doc).map((m) => m.field);

test('a complete record may be published', () => {
  assert.deepEqual(missingForPublish(complete()), []);
});

test('each required field is reported when missing, in English and Arabic', () => {
  const doc = complete();
  delete (doc['@graph'][0] as any)['bf:content'];
  (doc['@graph'][1] as any)['bf:title'] = { '@type': 'bf:Title', 'bf:mainTitle': '  ' };
  delete (doc['@graph'][1] as any)['bf:issuance'];
  const missing = missingForPublish(doc);
  assert.deepEqual(missing.map((m) => m.field), ['bf:content', 'bf:title', 'bf:issuance']);
  assert.equal(missing[1].entity, 'Instance');
  assert.equal(missing[1].ar, 'عنوان التجسيد');
});

test('no Work or Instance, or no link between them', () => {
  assert.deepEqual(fields({ '@graph': [] }), ['bf:Work', 'bf:Instance']);
  const doc = complete();
  (doc['@graph'][1] as any)['bf:instanceOf'] = { '@id': 'https://elsewhere.example/work/9' };
  assert.deepEqual(fields(doc), ['bf:instanceOf']);
  (doc['@graph'][0] as any)['bf:hasInstance'] = { '@id': 'https://mooon.site/resource/instance/r1' };
  assert.deepEqual(fields(doc), [], 'a hasInstance link from the Work also counts');
});

test('older records: unprefixed properties, titles as plain text or as a separate Title node', () => {
  const doc = {
    '@graph': [
      { '@id': 'https://x/w', '@type': 'Work', title: { mainTitle: 'Ali b. Abi Talib :' }, content: 'http://id.loc.gov/vocabulary/contentTypes/txt' },
      { '@id': 'https://x/i', '@type': 'bf:Instance', 'bf:title': { '@id': 'https://x/t' }, instanceOf: 'https://x/w',
        media: { 'rdfs:label': 'unmediated' }, carrier: lc('carriers/nc'), 'bf:issuance': lc('issuance/mono') },
      { '@id': 'https://x/t', '@type': 'bf:Title', 'bf:mainTitle': 'Ali b. Abi Talib :' },
    ],
  };
  assert.deepEqual(fields(doc), []);
});
