// MARC import: files written by Moon and by other systems (Koha-style, with ISBD punctuation and 260)
// come back as Moon records that export to the same MARC.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { buildW3CJsonLd } from '../src/services/w3cJsonLdBuilder';
import { bibframeToMarc } from '../src/services/marc/bibframeToMarc';
import { marcToBibframe, clean } from '../src/services/marc/marcToBibframe';
import { toIso2709, toMarcXml, toMrk, readMarcFile, MarcRecord } from '../src/services/marc/marcRecord';
import { missingForPublish } from '../supabase/functions/server/publishGate.tsx';

const require = createRequire(import.meta.url);
const MarcjsRecord = require('marcjs/lib/Record');
const Iso2709 = require('marcjs/lib/Iso2709');

const URIS = { work: 'https://mooon.site/resource/work/m1', instance: 'https://mooon.site/resource/instance/m1',
  item: 'https://mooon.site/resource/item/m1-1', expression: 'https://mooon.site/resource/expression/m1-1', admin: 'https://mooon.site/resource/admin/m1' };
const NOW = new Date('2026-11-05T10:00:00Z');

const source = () => buildW3CJsonLd({
  workData: {
    'bf:title': { 'bf:mainTitle': 'القبسات', 'bf:subtitle': 'في الحكمة' },
    'bf:contribution': [
      { '@type': ['bf:Contribution', 'bf:PrimaryContribution'], 'bf:agent': { '@id': 'http://id.loc.gov/authorities/names/n85043844', '@type': 'bf:Person', 'rdfs:label': 'Mīr Dāmād, Muḥammad Bāqir ibn Muḥammad, -1631' }, 'bf:role': 'aut' },
      { 'bf:agent': { '@type': 'bf:Person', 'rdfs:label': 'Mohaghegh, Mehdi' }, 'bf:role': 'edt' },
    ],
    'bf:language': 'ara', 'bf:content': 'txt',
    'bf:subject': { '@id': 'http://id.loc.gov/authorities/subjects/sh85068382', 'rdfs:label': 'Islamic philosophy' },
    'bf:classification': { lcc: 'B753.D363 Q33 1977' },
  },
  instanceData: {
    'bf:responsibilityStatement': 'Mīr Dāmād',
    'bf:identifiedBy': [{ type: 'Isbn', value: '9789953000000' }],
    'bf:provisionActivity': { '@type': 'bf:Publication', 'bf:place': { '@id': 'http://id.loc.gov/vocabulary/countries/ir', 'rdfs:label': 'Tehran' }, 'bf:agent': 'Tehran University Press', 'bf:date': '1977' },
    'bf:extent': '544 pages', 'bf:dimensions': '24 cm', 'bf:media': 'n', 'bf:carrier': 'nc', 'bf:issuance': 'mono',
  },
  uriSet: URIS,
});

/** The MARC fields that carry the description (005 is the export time). */
const described = (r: MarcRecord) => toMrk(r).split('\n').filter((l) => l && !l.startsWith('=005'));

test('round trip: Moon → .mrc → import → Moon → MARC gives the same record', () => {
  const marc = bibframeToMarc(source(), { recordId: 'm1', now: NOW });
  for (const bytes of [toIso2709(marc), new TextEncoder().encode(toMarcXml([marc])), new TextEncoder().encode(toMrk(marc))]) {
    const [read] = readMarcFile(bytes);
    const back = marcToBibframe(read);
    const again = bibframeToMarc(buildW3CJsonLd({ workData: back.work, instanceData: back.instance, itemData: back.item, uriSet: URIS }), { recordId: 'm1', now: NOW });
    assert.deepEqual(described(again), described(marc));
  }
});

test('a Koha-style record: ISBD punctuation, 260, 082 slashes, subdivided subjects', () => {
  // Built with marcjs, an independent MARC library, as another system would write it.
  const rec = new MarcjsRecord();
  rec.leader = '00000cam a2200000 a 4500';
  rec.append(['001', 'koha-77'], ['008', '990101s1999    iq a          000 0 ara d'],
    ['020', '  ', 'a', '9953-0-0000-4 (pbk.)'],
    ['082', '04', 'a', '892.7/1'],
    ['100', '1 ', 'a', 'Jawahiri, Muhammad Mahdi,', 'd', '1899-1997.', 'e', 'author.'],
    ['245', '10', 'a', 'Diwan al-Jawahiri /', 'c', 'Muhammad Mahdi al-Jawahiri.'],
    ['260', '  ', 'a', 'Baghdad :', 'b', 'Wizarat al-Thaqafa,', 'c', '1999.'],
    ['300', '  ', 'a', '5 v. ;', 'c', '24 cm.'],
    ['650', ' 0', 'a', 'Arabic poetry', 'y', '20th century.'],
    ['856', '40', 'u', 'https://example.net/koha/77']);
  const [read] = readMarcFile(new Uint8Array(Buffer.from(Iso2709.format(rec), 'utf8')));
  const { work, instance, item, title } = marcToBibframe(read);
  assert.equal(title, 'Diwan al-Jawahiri');
  assert.equal(instance['bf:responsibilityStatement'], 'Muhammad Mahdi al-Jawahiri');
  assert.equal(instance['bf:identifiedBy'][0]['rdf:value'], '9953000004', 'ISBN without hyphens and qualifier');
  assert.deepEqual(instance['bf:provisionActivity'][0], {
    '@type': 'bf:Publication',
    'bf:place': [{ '@id': 'http://id.loc.gov/vocabulary/countries/iq', 'rdfs:label': 'Baghdad' }],
    'bf:agent': [{ 'rdfs:label': 'Wizarat al-Thaqafa' }],
    'bf:date': '1999',
  });
  assert.equal(instance['bf:extent'], '5 v.', 'an abbreviation keeps its period');
  assert.equal(instance['bf:dimensions'], '24 cm.');
  assert.equal(work['bf:contribution'][0]['bf:agent']['rdfs:label'], 'Jawahiri, Muhammad Mahdi, 1899-1997', 'LC name heading: comma before the dates');
  assert.deepEqual(work['bf:contribution'][0]['bf:role'], ['author']);
  assert.equal(work['bf:classification'][0]['bf:classificationPortion'], '892.71');
  assert.equal(work['bf:subject'][0]['rdfs:label'], 'Arabic poetry--20th century');
  assert.equal(work['bf:language']['@id'], 'http://id.loc.gov/vocabulary/languages/ara');
  assert.deepEqual(item['bf:electronicLocator'], ['https://example.net/koha/77']);
  // No 336-338 in this older record, so the gate still asks for media and carrier.
  const doc = buildW3CJsonLd({ workData: work, instanceData: instance, uriSet: URIS });
  assert.deepEqual(missingForPublish(doc).map((m) => m.field), ['bf:media', 'bf:carrier']);
});

test('a batch file: every record is read', () => {
  const a = bibframeToMarc(source(), { recordId: 'a', now: NOW });
  const b = { ...a, fields: a.fields.map((f) => (f.tag === '001' ? { tag: '001', data: 'b' } : f)) };
  const bytes = new Uint8Array([...toIso2709(a), ...toIso2709(b)]);
  assert.deepEqual(readMarcFile(bytes).map((r) => (r.fields[0] as any).data), ['a', 'b']);
});

test('ISBD punctuation is removed, abbreviations keep their period', () => {
  assert.equal(clean('Baghdad :'), 'Baghdad');
  assert.equal(clean('Title /'), 'Title');
  assert.equal(clean('1999.'), '1999');
  assert.equal(clean('24 cm.'), '24 cm.');
  assert.equal(clean('Smith, J.'), 'Smith, J.');
});
