// Phase 13 S17: MARC → Moon → MARC gives the same MARC back. Names keep their parts ($a $d …) and subjects
// their subdivisions ($x $z $v $y) through bflc:marcKey, as LC's converter keeps them; fields Moon has no
// BIBFRAME for (773, 041, 340, 561 …) are kept and written back; 300 $b and 490 $v come back in their
// subfields; the kept MARC is not published.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { roundTrip, roundTripReport, toMoonDocument } from '../src/services/marc/marcRoundTrip';
import { toMarcKey, fromMarcKey } from '../src/services/marc/marcKey';
import { finishPublished } from '../supabase/functions/server/publishedOutput.tsx';
import type { MarcRecord } from '../src/services/marc/marcRecord';
import { bibframeToMarc } from '../src/services/marc/bibframeToMarc';

const article: MarcRecord = {
  leader: '00000nab a2200000 i 4500',
  fields: [
    { tag: '001', data: 'b84303' },
    { tag: '008', data: '230108s1962    iq            000 0 ara d' },
    { tag: '041', ind1: '0', ind2: ' ', subfields: [['a', 'ara'], ['b', 'eng']] },
    { tag: '100', ind1: '1', ind2: ' ', subfields: [['a', 'مطلوب، احمد،'], ['d', '1936-2018،'], ['e', 'مؤلف.']] },
    { tag: '245', ind1: '1', ind2: '0', subfields: [['a', 'أثر القرآن في نشأة البلاغة /'], ['c', 'بقلم الأستاذ احمد مطلوب.']] },
    { tag: '264', ind1: ' ', ind2: '1', subfields: [['a', '[بغداد، العراق] :'], ['b', 'مديرية الاذاعة والتلفزيون العامة،'], ['c', '1962.']] },
    { tag: '300', ind1: ' ', ind2: ' ', subfields: [['a', '1 ملف pdf :'], ['b', 'ايضاحيات']] },
    { tag: '490', ind1: '0', ind2: ' ', subfields: [['a', 'منابع الثقافة الاسلامية ؛'], ['v', '7']] },
    { tag: '561', ind1: ' ', ind2: ' ', subfields: [['a', 'وقف على مكتبة العتبة العباسية']] },
    { tag: '650', ind1: ' ', ind2: '4', subfields: [['a', 'القرآن'], ['x', 'بلاغة'], ['z', 'العراق'], ['v', 'مقالات.']] },
    { tag: '651', ind1: ' ', ind2: '4', subfields: [['a', 'الكرادة الشرقية (بغداد، العراق)'], ['x', 'تاريخ'], ['v', 'مقالات.']] },
    { tag: '700', ind1: '1', ind2: ' ', subfields: [['a', 'الهيتي، هادي نعمان،'], ['d', '1942-2015،'], ['e', 'مترجم.']] },
    { tag: '773', ind1: '0', ind2: '0', subfields: [['i', 'متضمن في (عمل) :'], ['t', 'صوت الجمهورية العراقية'], ['g', 'السنة 2، العدد 10 (كانون الثاني 1962)']] },
  ],
};

test('an Arabic article comes back whole: names, subdivided subjects, host item, language codes, extent, series', () => {
  const { back, issues } = roundTrip(article);
  assert.deepEqual(issues, []);
  const f = (tag: string) => back.fields.find((x) => x.tag === tag) as any;
  assert.deepEqual(f('100').subfields.slice(0, 2), [['a', 'مطلوب، احمد،'], ['d', '1936-2018،']]);
  assert.deepEqual(f('650').subfields.map(([c]: string[]) => c), ['a', 'x', 'z', 'v']);
  assert.deepEqual(f('773').subfields, article.fields.find((x) => x.tag === '773')!.subfields as any);
  assert.deepEqual(f('300').subfields.map(([c]: string[]) => c).slice(0, 2), ['a', 'b']);
  assert.deepEqual(f('490').subfields.map(([c]: string[]) => c), ['a', 'v']);
});

test('the report counts what is lost, most often first', () => {
  const without773 = { ...article, fields: article.fields.filter((x) => x.tag !== '773') };
  const r = roundTripReport([article, without773]);
  assert.equal(r.records, 2);
  assert.equal(r.clean, 2);
});

test('marcKey is written as LC writes it, and read back', () => {
  const f = article.fields.find((x) => x.tag === '100') as any;
  const key = toMarcKey({ ...f, subfields: [...f.subfields, ['0', 'http://id.loc.gov/x']] });
  assert.equal(key, '1001 $aمطلوب، احمد،$d1936-2018،$eمؤلف.', 'links ($0) are not part of the key');
  assert.deepEqual(fromMarcKey(key), { tag: '100', ind1: '1', ind2: ' ', subfields: f.subfields });
  assert.equal(fromMarcKey('008 xx'), null);
  assert.equal(fromMarcKey(42), null);
});

test('kept MARC fields stay in Moon and are not published; bflc:marcKey is', () => {
  const doc = toMoonDocument(article);
  const instance = doc['@graph'].find((n: any) => n['moonext:marcField'])!;
  assert.ok(instance['moonext:marcField'].some((k: string) => k.startsWith('773')));
  const published = JSON.stringify(finishPublished(doc));
  assert.ok(!published.includes('moonext:marcField'));
  assert.ok(published.includes('bflc:marcKey'));
});

test('Works named in fields come back: 240 with its name, a related work (700 $t), a work as subject (600 $t)', () => {
  const book: MarcRecord = {
    leader: '00000nam a2200000 i 4500',
    fields: [
      { tag: '100', ind1: '1', ind2: ' ', subfields: [['a', 'Ibn Khaldūn,'], ['d', '1332-1406,'], ['e', 'author.']] },
      { tag: '240', ind1: '1', ind2: '0', subfields: [['a', 'Muqaddimah.'], ['l', 'English']] },
      { tag: '245', ind1: '1', ind2: '4', subfields: [['a', 'The Muqaddimah :'], ['b', 'an introduction to history /']] },
      { tag: '600', ind1: '1', ind2: '0', subfields: [['a', 'Ibn Khaldūn,'], ['d', '1332-1406.'], ['t', 'Muqaddimah.']] },
      { tag: '700', ind1: '1', ind2: '2', subfields: [['a', 'Rosenthal, Franz,'], ['d', '1914-2003.'], ['t', 'Introduction.']] },
    ],
  };
  assert.deepEqual(roundTrip(book).issues, []);
});

test('a kept field is used only while it still says what the record says: an edited ISBN is Moon\'s own', () => {
  const rec: MarcRecord = { leader: '00000nam a2200000 i 4500', fields: [
    { tag: '020', ind1: ' ', ind2: ' ', subfields: [['a', '9789953000000'], ['q', '(paperback)']] },
    { tag: '245', ind1: '0', ind2: '0', subfields: [['a', 'Title']] },
  ] };
  assert.deepEqual(roundTrip(rec).issues, [], '$q comes back');
  const doc = toMoonDocument(rec);
  const inst = doc['@graph'].find((n: any) => n['@type'] === 'bf:Instance') as any;
  inst['bf:identifiedBy'] = [{ '@type': 'bf:Isbn', 'rdf:value': '9781111111111' }]; // edited in Moon
  const back = bibframeToMarc(doc as any, { recordId: 'x' });
  const f020 = back.fields.filter((f) => f.tag === '020') as any[];
  assert.equal(f020.length, 1);
  assert.deepEqual(f020[0].subfields[0], ['a', '9781111111111']);
});
