// Moon → FOLIO Inventory: the Instance a record becomes is valid against FOLIO's own schema
// (test/fixtures/folio/instance.schema.json, mod-inventory-storage), carries nothing invented, and sending
// twice updates the same Instance instead of making a duplicate.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildFolioInstance, sendInstance, cqlString, instanceHash, folioClient, type FolioRef, type FolioApi } from '../supabase/functions/server/folio.tsx';

const schema = JSON.parse(readFileSync(new URL('./fixtures/folio/instance.schema.json', import.meta.url), 'utf8'));
const qabasat = JSON.parse(readFileSync(new URL('../public/records/al-qabasat.jsonld', import.meta.url), 'utf8'));

const REF: FolioRef = {
  instanceTypes: { txt: 'type-txt', zzz: 'type-zzz', tdi: 'type-tdi' },
  identifierTypes: { ISBN: 'id-isbn', ISSN: 'id-issn', LCCN: 'id-lccn', OCLC: 'id-oclc' },
  contributorNameTypes: { personal: 'name-personal', corporate: 'name-corporate', meeting: 'name-meeting' },
  contributorTypes: { aut: 'ctype-aut', trl: 'ctype-trl' },
  classificationTypes: { LC: 'class-lc', Dewey: 'class-dewey' },
  generalNoteTypeId: 'note-general',
  modesOfIssuance: { 'single unit': 'mode-single' },
};

/** The schema's own rules: required fields, no unknown properties, required keys inside each array item. */
function schemaErrors(instance: any): string[] {
  const errors: string[] = [];
  for (const r of schema.required) if (instance[r] === undefined || instance[r] === '') errors.push(`missing ${r}`);
  for (const k of Object.keys(instance)) {
    const p = schema.properties[k];
    if (!p) { errors.push(`unknown property ${k}`); continue; }
    if (p.type === 'array' && !Array.isArray(instance[k])) errors.push(`${k} must be an array`);
    if (p.type === 'string' && typeof instance[k] !== 'string') errors.push(`${k} must be a string`);
    for (const item of Array.isArray(instance[k]) ? instance[k] : []) {
      if (p.items?.type === 'string' && typeof item !== 'string') errors.push(`${k} items must be strings`);
      for (const r of p.items?.required || []) if (!item?.[r]) errors.push(`${k} item missing ${r}`);
      for (const ik of Object.keys(p.items?.properties ? item : {})) if (!p.items.properties[ik]) errors.push(`${k} item has unknown ${ik}`);
    }
  }
  return errors;
}

const record = (graph: any[]) => ({ '@graph': graph });
const WORK = 'https://mooon.site/resource/work/w1';
const INST = 'https://mooon.site/resource/instance/w1';
const modern = record([
  {
    '@id': WORK, '@type': 'bf:Work',
    'bf:content': { '@id': 'http://id.loc.gov/vocabulary/contentTypes/txt' },
    'bf:language': [{ '@id': 'http://id.loc.gov/vocabulary/languages/ara' }],
    'bf:contribution': [
      { '@type': ['bf:Contribution', 'bflc:PrimaryContribution'], 'bf:agent': { '@type': 'bf:Person', 'rdfs:label': 'الوردي، علي، 1913-1995' }, 'bf:role': { '@id': 'http://id.loc.gov/vocabulary/relators/aut' } },
      { '@type': 'bf:Contribution', 'bf:agent': { '@type': 'bf:Person', 'rdfs:label': 'محمود، أنيس' }, 'bf:role': { '@id': 'http://id.loc.gov/vocabulary/relators/xyz', 'rdfs:label': 'محقق' } },
      { '@type': 'bf:Contribution', 'bf:agent': { '@type': 'bf:Organization', 'rdfs:label': 'جامعة بغداد' } },
    ],
    'bf:subject': [{ '@type': 'bf:Topic', 'rdfs:label': 'العراق -- أحوال اجتماعية' }],
    'bf:classification': [{ '@type': 'bf:ClassificationLcc', 'bf:classificationPortion': 'HN662', 'bf:itemPortion': '.W37 2018' }],
    'bf:summary': [{ '@type': 'bf:Summary', 'rdfs:label': 'دراسة في المجتمع العراقي.' }],
  },
  {
    '@id': INST, '@type': 'bf:Instance',
    'bf:instanceOf': { '@id': WORK },
    'bf:title': [{ '@type': 'bf:Title', 'bf:mainTitle': 'نظرية المعرفة عند ابن خلدون', 'bf:subtitle': 'دراسة' }, { '@type': 'bf:VariantTitle', 'bf:mainTitle': 'Variant' }],
    'bf:identifiedBy': [{ '@type': 'bf:Isbn', 'rdf:value': '9789953000000' }, { '@type': 'bf:Local', 'rdf:value': '12345', 'bf:assigner': { '@id': 'http://id.loc.gov/vocabulary/organizations/ocolc' } }, { '@type': 'bf:Local', 'rdf:value': 'b1' }],
    'bf:provisionActivity': [{ '@type': 'bf:Publication', 'bf:place': { '@type': 'bf:Place', 'rdfs:label': 'بغداد' }, 'bf:agent': { 'rdfs:label': 'دار الوراق' }, 'bf:date': '2018' }],
    'bf:editionStatement': 'الطبعة الثانية',
    'bf:extent': { '@type': 'bf:Extent', 'rdfs:label': '312 صفحة' },
    'bf:dimensions': '24 سم',
    'bf:issuance': { '@id': 'http://id.loc.gov/vocabulary/issuance/mono' },
    'bf:seriesStatement': 'سلسلة الدراسات الاجتماعية ؛ 4',
  },
]);

test('a full record maps to a schema-valid FOLIO Instance', () => {
  const { instance, warnings } = buildFolioInstance(modern, REF);
  assert.deepEqual(schemaErrors(instance), []);
  assert.deepEqual(warnings, []);
  assert.equal(instance!.source, 'FOLIO');
  assert.equal(instance!.title, 'نظرية المعرفة عند ابن خلدون : دراسة');
  assert.equal(instance!.instanceTypeId, 'type-txt');
  assert.equal(instance!.sourceUri, INST);
  assert.deepEqual(instance!.identifiers, [{ identifierTypeId: 'id-isbn', value: '9789953000000' }, { identifierTypeId: 'id-oclc', value: '12345' }]);
  assert.deepEqual(instance!.contributors, [
    { name: 'الوردي، علي، 1913-1995', contributorNameTypeId: 'name-personal', primary: true, contributorTypeId: 'ctype-aut' },
    { name: 'محمود، أنيس', contributorNameTypeId: 'name-personal', primary: false, contributorTypeText: 'محقق' },
    { name: 'جامعة بغداد', contributorNameTypeId: 'name-corporate', primary: false },
  ]);
  assert.deepEqual(instance!.publication, [{ publisher: 'دار الوراق', place: 'بغداد', dateOfPublication: '2018', role: 'Publication' }]);
  assert.deepEqual(instance!.classifications, [{ classificationNumber: 'HN662 .W37 2018', classificationTypeId: 'class-lc' }]);
  assert.deepEqual(instance!.physicalDescriptions, ['312 صفحة ; 24 سم']);
  assert.deepEqual(instance!.languages, ['ara']);
  assert.deepEqual(instance!.series, [{ value: 'سلسلة الدراسات الاجتماعية ؛ 4' }]);
  assert.equal(instance!.modeOfIssuanceId, 'mode-single');
  assert.deepEqual(instance!.notes, [{ instanceNoteTypeId: 'note-general', note: 'دراسة في المجتمع العراقي.', staffOnly: false }]);
});

test('a real Moon sample (al-Qabasat manuscript) is schema-valid and nothing is invented', () => {
  const { instance } = buildFolioInstance(qabasat, REF);
  assert.deepEqual(schemaErrors(instance), []);
  assert.equal(instance!.title, 'القبسات');
  // The old browser mapping used this manuscript's call number and extent as defaults for every record;
  // here they come from the record itself, and nothing else is made up.
  assert.ok(instance!.classifications.some((c: any) => c.classificationNumber.startsWith('B753.D363')));
  assert.ok(instance!.physicalDescriptions[0].includes('344 ورقة'));
  const json = JSON.stringify(instance);
  for (const made of ['مكتبة محلية', 'Unknown', 'Untitled']) assert.ok(!json.includes(made), `invented value ${made}`);
});

test('a sparse record sends empty lists, not made-up values; missing reference data becomes a warning', () => {
  const sparse = record([{ '@id': INST, '@type': 'bf:Instance', 'bf:title': { '@type': 'bf:Title', 'bf:mainTitle': 'ديوان' } }]);
  const { instance, warnings } = buildFolioInstance(sparse, { ...REF, generalNoteTypeId: undefined });
  assert.deepEqual(schemaErrors(instance), []);
  assert.deepEqual([instance!.contributors, instance!.identifiers, instance!.publication, instance!.classifications], [[], [], [], []]);
  assert.deepEqual(warnings, []);
  assert.equal(buildFolioInstance(record([{ '@type': 'bf:Instance' }]), REF).instance, null, 'no title: nothing to send');
  const noTypes = buildFolioInstance(modern, { ...REF, instanceTypes: {} });
  assert.equal(noTypes.instance, null);
  assert.match(noTypes.warnings[0], /no instance type/);
});

/** A small in-memory FOLIO: instance storage with CQL on sourceUri, id and ISBN. */
function fakeFolio(seed: any[] = []): FolioApi & { store: Map<string, any>; calls: string[] } {
  const store = new Map<string, any>(seed.map((i) => [i.id, i]));
  const calls: string[] = [];
  let n = 0;
  const query = (path: string) => decodeURIComponent((path.match(/query=([^&]+)/) || [])[1] || '');
  return {
    store, calls,
    async get(path) {
      calls.push(`GET ${path}`);
      const one = path.match(/^\/instance-storage\/instances\/([^?]+)$/);
      if (one) return store.has(one[1]) ? { status: 200, json: store.get(one[1]) } : { status: 404, json: null };
      const q = query(path);
      const uri = (q.match(/^sourceUri=="(.+)"$/) || [])[1];
      const isbns = [...q.matchAll(/identifiers =\/@value "([^"]+)"/g)].map((m) => m[1]);
      const instances = [...store.values()].filter((i) => (uri && i.sourceUri === uri) || isbns.some((v) => (i.identifiers || []).some((x: any) => x.value === v)));
      return { status: 200, json: { instances, totalRecords: instances.length } };
    },
    async post(path, body) {
      calls.push(`POST ${path}`);
      const id = `inst-${++n}`;
      const saved = { ...body, id, hrid: `in0000${n}`, _version: 1 };
      store.set(id, saved);
      return { status: 201, json: saved };
    },
    async put(path, body) {
      calls.push(`PUT ${path}`);
      const id = path.split('/').pop()!;
      if (store.get(id)?._version !== body._version) return { status: 409, json: { message: 'version conflict' } };
      store.set(id, { ...body, _version: body._version + 1 });
      return { status: 204, json: null };
    },
  };
}

test('send twice: created, then the same Instance is updated (found by the stored link or by sourceUri)', async () => {
  const folio = fakeFolio();
  const { instance } = buildFolioInstance(modern, REF);
  const first = await sendInstance(folio, instance!, null);
  assert.equal(first.status, 'created');
  const id = (first as any).instanceId;
  const again = await sendInstance(folio, { ...instance!, title: 'عنوان معدل' }, { instanceId: id, sentAt: '', hash: '' });
  assert.equal(again.status, 'updated');
  // Link lost (e.g. sent from another Moon): the sourceUri still finds it.
  const third = await sendInstance(folio, instance!, null);
  assert.deepEqual([third.status, (third as any).instanceId], ['updated', id]);
  assert.equal(folio.store.size, 1, 'never a duplicate');
  assert.equal(folio.store.get(id).title, instance!.title);
});

test('an update keeps FOLIO-only fields and clears values removed in Moon', async () => {
  const folio = fakeFolio([{ id: 'x1', hrid: 'in9', _version: 3, source: 'FOLIO', title: 'old', instanceTypeId: 't', sourceUri: INST, staffSuppress: true, statisticalCodeIds: ['s1'], subjects: [{ value: 'gone' }] }]);
  const { instance } = buildFolioInstance(modern, REF);
  const r = await sendInstance(folio, { ...instance!, subjects: [] }, null);
  assert.equal(r.status, 'updated');
  const saved = folio.store.get('x1');
  assert.deepEqual([saved.staffSuppress, saved.statisticalCodeIds, saved.subjects, saved.hrid], [true, ['s1'], [], 'in9']);
});

test('same ISBN already in FOLIO: offered to the user; then linked, or created anyway', async () => {
  const folio = fakeFolio([{ id: 'old1', hrid: 'in7', _version: 1, source: 'FOLIO', title: 'نظرية المعرفة', instanceTypeId: 't', identifiers: [{ identifierTypeId: 'id-isbn', value: '9789953000000' }] }]);
  const { instance } = buildFolioInstance(modern, REF);
  const offer = await sendInstance(folio, instance!, null);
  assert.deepEqual(offer, { status: 'match', candidates: [{ id: 'old1', hrid: 'in7', title: 'نظرية المعرفة' }], warnings: [] });
  assert.equal(folio.store.size, 1, 'nothing written before the user chooses');
  const linked = await sendInstance(folio, instance!, null, { linkTo: 'old1' });
  assert.deepEqual([linked.status, (linked as any).instanceId], ['updated', 'old1']);
  const fresh = fakeFolio([...folio.store.values()].map((i) => ({ ...i, sourceUri: undefined })));
  assert.equal((await sendInstance(fresh, instance!, null, { createAnyway: true })).status, 'created');
});

test('an Instance controlled by MARC is not overwritten', async () => {
  const folio = fakeFolio([{ id: 'm1', hrid: 'in5', _version: 1, source: 'MARC', title: 'x', instanceTypeId: 't', sourceUri: INST }]);
  const { instance } = buildFolioInstance(modern, REF);
  const r = await sendInstance(folio, instance!, null);
  assert.equal(r.status, 'blocked');
  assert.ok(!folio.calls.some((c) => c.startsWith('PUT')));
});

test('CQL strings are quoted and escaped; the hash changes only when the content does', () => {
  assert.equal(cqlString('a "b" * c\\'), '"a \\"b\\" \\* c\\\\"');
  const { instance } = buildFolioInstance(modern, REF);
  assert.equal(instanceHash(instance!), instanceHash(JSON.parse(JSON.stringify(instance))));
  assert.notEqual(instanceHash(instance!), instanceHash({ ...instance!, title: 'x' }));
});

test('sign-in: login-with-expiry cookie, else the older x-okapi-token; a bad account is a clear error', async () => {
  const seen: any[] = [];
  const modernFetch = (async (url: string, init: any) => {
    seen.push([url, init.headers['X-Okapi-Token']]);
    if (url.endsWith('/authn/login-with-expiry')) return new Response('{}', { status: 201, headers: { 'set-cookie': 'folioAccessToken=TOK1; Path=/; HttpOnly' } });
    return new Response('{"instanceTypes":[]}', { status: 200 });
  }) as unknown as typeof fetch;
  const api = await folioClient({ url: 'https://folio.example/', tenant: 'diku', username: 'u', password: 'p' }, modernFetch);
  await api.get('/instance-types?limit=1000');
  assert.deepEqual(seen.at(-1), ['https://folio.example/instance-types?limit=1000', 'TOK1']);

  const oldFetch = (async (url: string) => url.endsWith('/authn/login')
    ? new Response('{}', { status: 201, headers: { 'x-okapi-token': 'TOK2' } })
    : new Response('', { status: 404 })) as unknown as typeof fetch;
  await assert.doesNotReject(folioClient({ url: 'https://f', tenant: 't', username: 'u', password: 'p' }, oldFetch));

  const denied = (async () => new Response('bad', { status: 422 })) as unknown as typeof fetch;
  await assert.rejects(folioClient({ url: 'https://f', tenant: 't', username: 'u', password: 'p' }, denied), /sign-in failed/);
});
