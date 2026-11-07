// The 008 fills itself from what the cataloguer has entered, and never overrides what they set by hand.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMarcText, BOOK_TEMPLATE } from '../src/services/marc/marcEditing';
import { autoFill008, derive008, gregorianYears, changedPositions } from '../src/services/marc/marc008Auto';
import { check008 } from '../src/services/marc/marcFixedFields';

const NOW = new Date('2026-11-06T10:00:00Z');
const rec = (lines: string) => parseMarcText(`LDR 00000nam\\a2200000\\i\\4500\n${lines}`).record;
const at = (v: string, start: number, len = 1) => v.slice(start, start + len);

test('Hijri years in an imprint are skipped; the Gregorian year is taken', () => {
  assert.deepEqual(gregorianYears('1445هـ، 2023م'), ['2023']);
  assert.deepEqual(gregorianYears('١٤٤٥ هـ / ٢٠٢٣ م'), ['2023']);
  assert.deepEqual(gregorianYears('[2010?]'), ['2010']);
  assert.deepEqual(gregorianYears('1398 [1978]'), ['1978']);
});

test('an Arabic book from Baghdad fills date, place, language, illustrations, index and contents', () => {
  const r = rec(`245 10 $a تاريخ بغداد / $c الخطيب البغدادي.
264 #1 $a بغداد : $b دار الشؤون الثقافية، $c ١٤٤٥ هـ، ٢٠٢٣ م.
300 ## $a 450 صفحة : $b إيضاحات، خرائط ; $c 24 سم
504 ## $a يتضمن مراجع وكشافات.
650 #0 $a بغداد $x تاريخ.`);
  const { value, changed } = autoFill008('', r, new Set(), NOW);
  assert.equal(value.length, 40);
  assert.equal(at(value, 0, 6), '261106', 'date entered, today');
  assert.equal(at(value, 6), 's');
  assert.equal(at(value, 7, 4), '2023');
  assert.equal(at(value, 15, 3), 'iq ');
  assert.equal(at(value, 18, 4), 'ab  ', 'illustrations, maps');
  assert.equal(at(value, 24, 4), 'b   ', 'bibliographies');
  assert.equal(at(value, 29), '0');
  assert.equal(at(value, 31), '1', 'index present');
  assert.equal(at(value, 33), '0', 'not fiction');
  assert.equal(at(value, 35, 3), 'ara');
  assert.ok(changed.length >= 8);
  assert.deepEqual(check008(value, '00000nam a2200000 i 4500').filter((i) => !/008\/(22|23|28|30|32|34|38|39)/.test(i.en)), [], 'the codes it writes are valid');
});

test('copyright and questionable dates, novels, conferences, theses and biography', () => {
  const novel = derive008(rec(`245 10 $a Season of migration
264 #1 $a Beirut : $b Dar, $c 2015.
264 #4 $c ©2014
650 #0 $a Sudan $v Fiction.
655 #7 $a Novels. $2 lcgft`));
  const get = (fs: ReturnType<typeof derive008>, start: number) => fs.find((f) => f.start === start)?.value;
  assert.equal(get(novel, 6), 't');
  assert.equal(get(novel, 11), '2014');
  assert.equal(get(novel, 15), 'le ');
  assert.equal(get(novel, 33), 'f');
  assert.equal(get(novel, 35), 'eng');

  const conf = derive008(rec(`245 10 $a Proceedings
264 #1 $a [Cairo] : $b X, $c [2001?]
502 ## $a Thesis (Ph.D.)
111 2# $a Conference on Arabic
600 10 $a Ibn Khaldun $v Biography.`));
  assert.equal(get(conf, 6), 'q');
  assert.equal(get(conf, 15), 'ua ');
  assert.equal(get(conf, 29), '1');
  assert.ok(get(conf, 24)?.includes('m'));
  assert.equal(get(conf, 34), 'b');
});

test('what the cataloguer set by hand stays; the book template fills cleanly', () => {
  const r = rec(`245 10 $a كتاب
264 #1 $a النجف : $b مطبعة، $c 1990.`);
  const first = autoFill008('', r, new Set(), NOW).value;
  const mine = first.slice(0, 15) + 'le ' + first.slice(18);
  const keep = new Set(changedPositions(first, mine));
  assert.deepEqual([...keep], [15, 16]);
  assert.equal(at(autoFill008(mine, r, keep, NOW).value, 15, 3), 'le ', 'the hand-set place stays');
  assert.equal(autoFill008(first, r, new Set(), NOW).changed.length, 0, 'nothing changes twice');

  const tpl = parseMarcText(BOOK_TEMPLATE).record;
  const f008 = (tpl.fields.find((f) => f.tag === '008') as { data: string }).data;
  const filled = autoFill008(f008, tpl, new Set(), NOW).value;
  assert.equal(filled.length, 40);
  assert.deepEqual(check008(filled, tpl.leader), []);
});
