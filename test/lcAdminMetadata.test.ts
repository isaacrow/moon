import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withLcAdminMetadata, catalogingLanguage, DESCRIPTION_LEVEL } from '../supabase/functions/server/lcAdminMetadata.tsx';

const W = 'https://mooon.site/resource/work/r1';
const I = 'https://mooon.site/resource/instance/r1';
const A = 'https://mooon.site/resource/admin/r1';
const doc = {
  '@graph': [
    { '@id': W, '@type': 'bf:Work', 'bf:title': { 'bf:mainTitle': 'Sufism' }, 'bf:adminMetadata': [{ '@id': A }] },
    { '@id': I, '@type': 'bf:Instance', 'bf:instanceOf': { '@id': W }, 'bf:extent': { 'rdfs:label': '344 ورقة' }, 'bf:note': { 'rdfs:label': 'نسخة مخطوطة كاملة' } },
    { '@id': A, '@type': 'bf:AdminMetadata', 'bf:creationDate': '2026-11-01', 'bf:descriptionLanguage': { '@id': 'http://id.loc.gov/vocabulary/languages/eng' } },
  ],
};
const facts = { id: 'r1', cataloger: 'ali', createdAt: '2026-11-01T09:00:00Z', saved: '2026-11-04T10:30:00Z', approvedBy: 'isaac' };

test('the cataloguing-details entry has LC\'s fields, and Arabic cataloguing is no longer called English', () => {
  const out = withLcAdminMetadata(doc, facts);
  const admin = out['@graph'].find((n: any) => n['@id'] === A);
  assert.deepEqual(admin['bf:descriptionLevel'], { '@id': DESCRIPTION_LEVEL });
  assert.deepEqual(admin['bflc:encodingLevel'], { '@id': 'http://id.loc.gov/vocabulary/menclvl/f' });
  assert.deepEqual(admin['bf:descriptionConventions'], { '@id': 'http://id.loc.gov/vocabulary/descriptionConventions/rda' });
  assert.deepEqual(admin['bf:descriptionLanguage'], { '@id': 'http://id.loc.gov/vocabulary/languages/ara' });
  assert.equal(admin['bf:creationDate'], '2026-11-01');
  const local = admin['bf:identifiedBy'][0];
  assert.equal(local['@type'], 'bf:Local');
  assert.equal(local['rdf:value'], 'r1');
});

test('events: new by the cataloguer, corrected by the reviewer who published it, on the Work', () => {
  const out = withLcAdminMetadata(doc, facts);
  const work = out['@graph'].find((n: any) => n['@id'] === W);
  const events = work['bf:adminMetadata'].filter((x: any) => x['bf:status']);
  assert.deepEqual(events.map((e: any) => [e['bf:status']['@id'].split('/').pop(), e['bf:date']['@value'], e['bf:agent']['rdfs:label']]), [
    ['n', '2026-11-01T09:00:00.000Z', 'ali'],
    ['c', '2026-11-04T10:30:00.000Z', 'isaac'],
  ]);
  // Still linked to the details entry exactly once, and the Instance links to it too.
  assert.equal(work['bf:adminMetadata'].filter((x: any) => x['@id'] === A).length, 1);
  const inst = out['@graph'].find((n: any) => n['@id'] === I);
  assert.deepEqual(inst['bf:adminMetadata'], [{ '@id': A }]);
});

test('the input is untouched, a second pass adds nothing, and a record never edited has one event', () => {
  const once = withLcAdminMetadata(doc, facts);
  assert.equal(doc['@graph'][2]['bf:descriptionLanguage']['@id'].endsWith('/eng'), true);
  const twice = withLcAdminMetadata(once, facts);
  assert.deepEqual(twice, once);
  const fresh = withLcAdminMetadata(doc, { id: 'r1', cataloger: 'ali', createdAt: '2026-11-01T09:00:00Z', saved: '2026-11-01T09:00:00Z' });
  const w = fresh['@graph'].find((n: any) => n['@id'] === W);
  assert.equal(w['bf:adminMetadata'].filter((x: any) => x['bf:status']).length, 1);
});

test('a record with no admin entry gets one; the language comes from the cataloguer\'s words only', () => {
  const bare = { '@graph': [{ '@id': W, '@type': 'bf:Work' }, { '@id': I, '@type': 'bf:Instance', 'bf:extent': '200 p.' }] };
  const out = withLcAdminMetadata(bare, { id: 'r1' });
  const admin = out['@graph'].find((n: any) => n['@type'] === 'bf:AdminMetadata');
  assert.equal(admin['@id'], A);
  assert.equal(admin['bf:descriptionLanguage']['@id'], 'http://id.loc.gov/vocabulary/languages/eng');
  // An Arabic title alone (transcribed from the book) does not make the cataloguing Arabic.
  assert.equal(catalogingLanguage([{ '@type': 'bf:Instance', 'bf:title': { 'bf:mainTitle': 'القبسات' } }], 'http://x/eng'), 'http://x/eng');
});
