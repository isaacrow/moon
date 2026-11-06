// The MARC editor knows every MARC 21 bibliographic field and its subfields, guides the Leader and 008 code
// by code, and more fields travel MARC → BIBFRAME → MARC.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MARC_FIELDS, ALL_FIELD_TAGS, fieldDef, searchFields, subfieldName } from '../src/services/marc/marcDictionary';
import { check008, new008, f008Positions, setPosition, getPosition, LEADER_POSITIONS, F008_BOOKS } from '../src/services/marc/marcFixedFields';
import { BOOK_TEMPLATE, parseMarcText, checkMarc, marcTextToBibframe, fieldName } from '../src/services/marc/marcEditing';
import { bibframeToMarc } from '../src/services/marc/bibframeToMarc';
import { buildW3CJsonLd } from '../src/services/w3cJsonLdBuilder';
import { mintUriSet } from '../src/services/uriMintingService';

test('every MARC 21 bibliographic field is known, with its subfields and indicators', () => {
  assert.ok(ALL_FIELD_TAGS.length > 180, `${ALL_FIELD_TAGS.length} fields`);
  assert.ok(ALL_FIELD_TAGS.every((t) => /^\d{3}$/.test(t)));
  for (const tag of ['020', '041', '082', '100', '245', '246', '264', '300', '336', '490', '502', '504', '505', '520', '546', '600', '650', '655', '700', '773', '830', '856']) {
    assert.ok(MARC_FIELDS[tag], `${tag} is listed`);
  }
  assert.equal(subfieldName('245', 'c'), 'Statement of responsibility');
  assert.equal(subfieldName('650', 'x'), 'General subdivision');
  assert.equal(subfieldName('100', '0'), 'Authority record control number or URI');
  assert.equal(subfieldName('245', 'z'), '', 'not a subfield of 245');
  assert.equal(fieldDef('650')!.ind2, '0', 'a new 650 starts as LCSH');
  assert.equal(fieldDef('245')!.repeatable, false);
  assert.equal(fieldDef('949')!.en, 'Local field', '9XX fields are local');
  assert.equal(fieldName('773', true), 'مدخل المادة المضيفة', 'names beyond the short list, in Arabic too');
});

test('a field is found by its tag or by a word of its name, in English or Arabic', () => {
  assert.equal(searchFields('505')[0].tag, '505');
  assert.equal(searchFields('50')[0].tag, '500');
  assert.ok(searchFields('contents').some((d) => d.tag === '505'));
  assert.ok(searchFields('ملاحظة').some((d) => d.tag === '500'));
  assert.ok(searchFields('series').some((d) => d.tag === '490'));
  assert.deepEqual(searchFields(''), []);
});

test('only fields MARC 21 lets appear once are flagged when repeated', () => {
  const twice = (tag: string) => checkMarc(parseMarcText(`LDR 00000nam\\a2200000\\i\\4500\n245 10 $a T\n${tag} ## $a x\n${tag} ## $a y`).record)
    .some((i) => i.level === 'error' && i.tag === tag);
  assert.equal(twice('250'), false, '250 repeats');
  assert.equal(twice('300'), false, '300 repeats');
  assert.equal(twice('040'), true);
  const unknown = checkMarc(parseMarcText('LDR 00000nam\\a2200000\\i\\4500\n245 10 $a T\n399 ## $a x').record);
  assert.ok(unknown.some((i) => i.tag === '399' && i.level === 'warning'), 'a tag MARC 21 does not define is pointed out');
});

test('the 008 is checked position by position against the codes it takes', () => {
  const template008 = parseMarcText(BOOK_TEMPLATE).record.fields.find((f) => f.tag === '008') as { data: string };
  assert.deepEqual(check008(template008.data, '00000nam a2200000 i 4500'), [], 'the book template is valid');
  const fresh = new008({ date1: '2024', country: 'iq', language: 'ara', now: new Date('2026-11-06') });
  assert.equal(fresh.length, 40);
  assert.equal(fresh.slice(0, 15), '261106s2024    ');
  assert.equal(fresh.slice(35, 38), 'ara');
  assert.deepEqual(check008(fresh, '00000nam a2200000 i 4500'), []);
  const bad = setPosition(fresh, F008_BOOKS.find((p) => p.start === 33)!, 'z', 40);
  assert.ok(check008(bad, '00000nam a2200000 i 4500').some((i) => i.en.includes('008/33')), 'literary form z is not a code');
  assert.ok(check008(fresh.slice(0, 38), '00000nam a2200000 i 4500').some((i) => i.en.includes('needs 40')));
  const parsed = parseMarcText(`LDR 00000nam\\a2200000\\i\\4500\n008 ${bad.replace(/ /g, '\\')}\n245 10 $a T`);
  const issues = checkMarc(parsed.record, parsed.lineOf);
  assert.ok(issues.some((i) => i.tag === '008' && i.line === 2), 'the editor shows it on the 008 line');
});

test('008/18-34 are coded for books; other material keeps them as one box', () => {
  assert.ok(f008Positions('00000nam a2200000 i 4500').some((p) => p.start === 33 && p.codes));
  assert.ok(f008Positions('00000ntm a2200000 i 4500').some((p) => p.start === 33), 'manuscripts are books in 008');
  const map = f008Positions('00000nem a2200000 i 4500');
  assert.ok(map.some((p) => p.start === 18 && p.length === 17 && !p.codes), 'a map keeps 18-34 as typed');
  const leader = '00000nam a2200000 i 4500';
  const type = LEADER_POSITIONS.find((p) => p.start === 6)!;
  assert.equal(getPosition(setPosition(leader, type, 't', 24), type), 't');
  assert.equal(setPosition(leader, type, 't', 24).length, 24);
});

test('notes, numbers, languages, titles and index terms go MARC → BIBFRAME → MARC', () => {
  const text = `LDR 00000nam\\a2200000\\i\\4500
008 ${new008({ date1: '2010', country: 'iq', language: 'ara', now: new Date('2026-11-06') }).replace(/ /g, '\\')}
024 7# $a 10.1000/xyz123 $2 doi
035 ## $a (OCoLC)123456789
041 0# $a ara $a eng
043 ## $a a-iq---
245 10 $a كتاب التجربة / $c مؤلف.
246 31 $a Book of the test
502 ## $a أطروحة (دكتوراه) $b دكتوراه $c جامعة بغداد $d 2009.
504 ## $a يتضمن مراجع (صفحة 200-210).
505 0# $a المقدمة -- الفصل الأول -- الخاتمة.
506 ## $a متاح للقراءة داخل المكتبة.
540 ## $a لا يجوز النسخ.
546 ## $a النص بالعربية مع ملخص بالإنجليزية.
588 ## $a الوصف من صفحة العنوان.
648 #7 $a القرن العشرون
653 ## $a التراث العراقي`;
  const { bibframe, issues } = marcTextToBibframe(text);
  assert.deepEqual(issues.filter((i) => i.level === 'error'), []);
  const w = bibframe!.work, inst = bibframe!.instance;
  assert.equal(w['bf:language'].length, 2);
  assert.equal(w['bf:geographicCoverage'][0]['@id'], 'http://id.loc.gov/vocabulary/geographicAreas/a-iq');
  assert.ok(inst['bf:identifiedBy'].some((i: any) => i['@type'] === 'bf:Doi' && i['rdf:value'] === '10.1000/xyz123'));
  assert.ok(inst['bf:identifiedBy'].some((i: any) => i['@type'] === 'bf:Local' && i['bf:assigner']['rdfs:label'] === 'OCoLC'));
  assert.equal(w['bf:dissertation'][0]['bf:grantingInstitution']['rdfs:label'], 'جامعة بغداد');
  assert.match(w['bf:tableOfContents'][0]['rdfs:label'], /الفصل الأول/);
  assert.ok(w['bf:subject'].some((s: any) => s['@type'] === 'bf:Temporal'));

  const graph = buildW3CJsonLd({ workData: bibframe!.work, instanceData: bibframe!.instance, uriSet: mintUriSet('marcfields1') as any });
  const back = bibframeToMarc(graph as any, { recordId: 'marcfields1' });
  const field = (tag: string) => back.fields.find((f) => f.tag === tag) as any;
  const sub = (tag: string, code: string) => (field(tag)?.subfields || []).find(([c]: string[]) => c === code)?.[1];
  assert.deepEqual(field('041')?.subfields, [['a', 'ara'], ['a', 'eng']]);
  assert.equal(sub('024', 'a'), '10.1000/xyz123');
  assert.equal(sub('024', '2'), 'doi');
  assert.equal(sub('035', 'a'), '(OCoLC)123456789');
  assert.equal(sub('043', 'a'), 'a-iq---');
  assert.equal(sub('246', 'a'), 'Book of the test');
  assert.equal(field('246')?.ind2, '1', 'a parallel title');
  assert.equal(sub('502', 'c'), 'جامعة بغداد');
  assert.match(sub('504', 'a') || '', /مراجع/);
  assert.match(sub('505', 'a') || '', /الفصل الأول/);
  assert.match(sub('506', 'a') || '', /داخل المكتبة/);
  assert.match(sub('540', 'a') || '', /النسخ/);
  assert.match(sub('546', 'a') || '', /بالعربية/);
  assert.match(sub('588', 'a') || '', /صفحة العنوان/);
  assert.equal(sub('648', 'a'), 'القرن العشرون');
  assert.equal(sub('653', 'a'), 'التراث العراقي');
  assert.ok(!back.fields.some((f) => f.tag === '500'), 'typed notes are not turned into general notes');
});
