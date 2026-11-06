// MARC export: the binary .mrc and the MARCXML are read back by an independent MARC library (marcjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { buildW3CJsonLd } from '../src/services/w3cJsonLdBuilder';
import { bibframeToMarc } from '../src/services/marc/bibframeToMarc';
import { toIso2709, toMarcXml, toMrk } from '../src/services/marc/marcRecord';

const require = createRequire(import.meta.url);
const Iso2709 = require('marcjs/lib/Iso2709');
const Marcxml = require('marcjs/lib/Marcxml');

const URIS = { work: 'https://mooon.site/resource/work/m1', instance: 'https://mooon.site/resource/instance/m1',
  item: 'https://mooon.site/resource/item/m1-1', expression: 'https://mooon.site/resource/expression/m1-1', admin: 'https://mooon.site/resource/admin/m1' };

const doc = () => buildW3CJsonLd({
  workData: {
    'bf:title': { 'bf:mainTitle': 'القبسات', 'bf:subtitle': 'في الحكمة' },
    'bf:contribution': [
      { '@type': ['bf:Contribution', 'bf:PrimaryContribution'], 'bf:agent': { '@id': 'http://id.loc.gov/authorities/names/n85043844', '@type': 'bf:Person', 'rdfs:label': 'Mīr Dāmād, Muḥammad Bāqir ibn Muḥammad, -1631' }, 'bf:role': 'aut' },
      { 'bf:agent': { '@type': 'bf:Person', 'rdfs:label': 'Mohaghegh, Mehdi' }, 'bf:role': 'edt' },
    ],
    'bf:language': 'ara', 'bf:content': 'txt',
    'bf:subject': [{ '@id': 'http://id.loc.gov/authorities/subjects/sh85068382', 'rdfs:label': 'Islamic philosophy' }, 'فلسفة'],
    'bf:genreForm': { '@id': 'http://id.loc.gov/authorities/genreForms/gf2014026085', 'rdfs:label': 'Manuscripts' },
    'bf:classification': { lcc: 'B753.D363 Q33 1977' },
    'bf:summary': 'On time & creation <in Arabic>.',
  },
  instanceData: {
    'bf:responsibilityStatement': 'Mīr Dāmād',
    'bf:identifiedBy': [{ type: 'Isbn', value: '9789953000000' }, { type: 'Lccn', value: '2016496993' }],
    'bf:provisionActivity': { '@type': 'bf:Publication', 'bf:place': { '@id': 'http://id.loc.gov/vocabulary/countries/ir', 'rdfs:label': 'Tehran' }, 'bf:agent': 'Tehran University Press', 'bf:date': '1977' },
    'bf:extent': '544 pages', 'bf:dimensions': '24 cm',
    'bf:media': 'n', 'bf:carrier': 'nc', 'bf:issuance': 'mono',
    'bf:seriesStatement': 'Wisdom series ; 7',
  },
  itemData: { 'bf:electronicLocator': 'https://example.net/scan/1' },
  uriSet: URIS,
});

const record = () => bibframeToMarc(doc(), { recordId: 'm1', now: new Date('2026-11-05T10:00:00Z') });
// marcjs data fields: [tag, indicators, code, value, code, value, ...]
const sub = (r: any, tag: string, code: string) => r.fields.filter((f: any) => f[0] === tag).map((f: any) => {
  for (let i = 2; i < f.length; i += 2) if (f[i] === code) return f[i + 1];
  return undefined;
});

test('binary .mrc (ISO 2709) is read back by marcjs with the same fields', () => {
  const bytes = toIso2709(record());
  assert.equal(bytes[bytes.length - 1], 0x1d, 'record terminator');
  assert.equal(Number(new TextDecoder().decode(bytes.slice(0, 5))), bytes.length, 'leader/00-04 is the byte length');
  const parsed = Iso2709.parse(Buffer.from(bytes));
  assert.equal(parsed.leader.slice(5, 10), 'nam a', 'new, language material, monograph, UTF-8');
  const tags = parsed.fields.map((f: any) => f[0]);
  assert.deepEqual(tags, [...tags].sort(), 'fields are in tag order');
  assert.deepEqual(sub(parsed, '245', 'a'), ['القبسات'], 'Arabic survives the byte offsets (UTF-8)');
  assert.deepEqual(sub(parsed, '020', 'a'), ['9789953000000']);
  assert.deepEqual(sub(parsed, '100', '0'), ['http://id.loc.gov/authorities/names/n85043844']);
  assert.deepEqual(sub(parsed, '100', '4'), ['aut']);
  assert.deepEqual(sub(parsed, '700', '4'), ['edt']);
  assert.deepEqual(sub(parsed, '050', 'a'), ['B753.D363']);
  assert.deepEqual(sub(parsed, '264', 'c'), ['1977']);
  assert.deepEqual(sub(parsed, '338', 'b'), ['nc']);
  assert.deepEqual(sub(parsed, '650', '0'), ['http://id.loc.gov/authorities/subjects/sh85068382', undefined]);
});

test('008 carries the date entered, the year, the place code and the language', () => {
  const f008 = (record().fields.find((f: any) => f.tag === '008') as any).data as string;
  assert.equal(f008.length, 40);
  // Date entered = the record's creation date (yymmdd), not the export day.
  const created = doc()['@graph'].find((n: any) => n['@type'] === 'bf:AdminMetadata')['bf:creationDate'][0]['@value'];
  assert.equal(f008.slice(0, 6), created.replace(/-/g, '').slice(2, 8));
  assert.equal(f008.slice(6, 11), 's1977');
  assert.equal(f008.slice(15, 18), 'ir ', 'place comes from the record, not a fixed default');
  assert.equal(f008.slice(35, 38), 'ara');
});

test('MARCXML is well formed, escaped, and parses to the same record', () => {
  const xml = toMarcXml([record()]);
  assert.match(xml, /xmlns="http:\/\/www\.loc\.gov\/MARC21\/slim"/);
  assert.match(xml, /On time &amp; creation &lt;in Arabic&gt;\./);
  const recordXml = xml.slice(xml.indexOf('<record>'), xml.indexOf('</record>') + 9);
  const parsed = Marcxml.parse(recordXml);
  assert.deepEqual(sub(parsed, '245', 'a'), ['القبسات']);
  assert.deepEqual(sub(parsed, '264', 'b'), ['Tehran University Press']);
});

test('MarcEdit text uses its conventions', () => {
  const mrk = toMrk(record());
  assert.match(mrk, /^=LDR {2}\d{5}nam\\a22\d{5}\\c\\4500$/m);
  assert.match(mrk, /^=245 {2}10\$aالقبسات\$bفي الحكمة\$cMīr Dāmād$/m);
  assert.match(mrk, /^=650 {2}\\0\$aIslamic philosophy\$0http:\/\/id\.loc\.gov\/authorities\/subjects\/sh85068382$/m);
});
