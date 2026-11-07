// Hijri dates: conversion checked against known dates, and date statements read in every calendar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hijriToGregorian, gregorianToHijri, hijriYearSpan, hijriCenturyOf, readDate, bothCalendars } from '../src/services/hijri';

test('tabular conversion matches known dates (within the calendar\'s day or two)', () => {
  // 1 Muharram 1 AH = 16 July 622 (Julian) = 19 July 622 proleptic Gregorian.
  assert.equal(hijriToGregorian(1, 1, 1), '0622-07-19');
  // 1 Muharram 1445 = 19 July 2023 (Umm al-Qura); tabular gives 19 or 20 July.
  assert.match(hijriToGregorian(1445, 1, 1), /^2023-07-(18|19|20)$/);
  // 1 Ramadan 1444 = 23 March 2023.
  assert.match(hijriToGregorian(1444, 9, 1), /^2023-03-2[2-4]$/);
  const back = gregorianToHijri('2023-07-25');
  assert.equal(back.year, 1445);
  assert.equal(back.month, 1);
  for (const [y, m, d] of [[1400, 1, 1], [1445, 12, 29], [808, 9, 15]]) {
    const g = hijriToGregorian(y, m, d);
    assert.deepEqual(gregorianToHijri(g), { year: y, month: m, day: d }, `${y}-${m}-${d} round trip`);
  }
});

test('a Hijri year runs across one or two Gregorian years; centuries AH', () => {
  assert.deepEqual(hijriYearSpan(1445), [2023, 2024]);
  assert.deepEqual(hijriYearSpan(1398), [1977, 1978]);
  assert.equal(hijriCenturyOf(2023), 15);
  assert.equal(hijriCenturyOf(1406), 9, 'Ibn Khaldun died in 808 AH, 9th century AH');
});

test('date statements are read in whatever calendar they use', () => {
  assert.deepEqual(readDate('١٤٤٥ هـ، ٢٠٢٣ م'), { hijri: 1445, solarHijri: undefined, gregorian: 2023, from: 2023, to: 2023, edtf: '2023' });
  const h = readDate('1445هـ');
  assert.equal(h.hijri, 1445);
  assert.deepEqual([h.from, h.to, h.edtf], [2023, 2024, '[2023,2024]']);
  const solar = readDate('1402 ش');
  assert.equal(solar.solarHijri, 1402);
  assert.deepEqual([solar.from, solar.to], [2023, 2024]);
  assert.equal(readDate('1402 هـ.ش').solarHijri, 1402, 'هـ.ش is solar, not lunar');
  assert.equal(readDate('1402 هـ.ش').hijri, undefined);
  const assumed = readDate('بيروت : دار، ١٣٩٨');
  assert.equal(assumed.hijri, 1398);
  assert.equal(assumed.assumed, true);
  assert.equal(readDate('1398 [1978]').gregorian, 1978, 'a bracketed Gregorian equivalent wins');
  assert.equal(readDate('2015.').edtf, '2015');
  assert.equal(readDate('كتب سنة 645 هـ').hijri, 645);
  assert.deepEqual([readDate('645 AH').from, readDate('645 AH').to], [1247, 1248]);
  assert.equal(readDate('').from, undefined);
});

test('shown in both calendars', () => {
  assert.equal(bothCalendars(readDate('1445 هـ')), '1445 هـ / 2023–2024 م');
  assert.equal(bothCalendars(readDate('2023'), false), '1444 AH / 2023 CE');
  assert.equal(bothCalendars(readDate('1402 ش')), '1402 هـ.ش / 2023–2024 م');
});

import { parseMarcText } from '../src/services/marc/marcEditing';
import { derive008 } from '../src/services/marc/marc008Auto';
import { workYearOf, valuesOf, valueLabel } from '../src/opac/facets';

test('the 008 codes a Hijri-only imprint as one of two Gregorian years', () => {
  const rec = (c: string) => parseMarcText(String.raw`LDR 00000nam\a2200000\i\4500` + `\n245 10 $a كتاب\n264 #1 $a النجف : $b مطبعة، $c ${c}`).record;
  const get = (c: string, start: number) => derive008(rec(c)).find((f) => f.start === start)?.value;
  assert.deepEqual([get('1445 هـ.', 6), get('1445 هـ.', 7), get('1445 هـ.', 11)], ['q', '2023', '2024']);
  assert.deepEqual([get('1445 هـ، 2023 م.', 6), get('1445 هـ، 2023 م.', 7)], ['s', '2023'], 'a Gregorian year given wins');
  assert.equal(get('1402 ش', 7), '2023');
});

test('the OPAC reads Hijri years right and browses by century AH', () => {
  const w = (publicationYear: string) => ({ id: 'w', title: 'x', instances: [{ publicationYear }] });
  assert.equal(workYearOf(w('1420 هـ')), 1999, 'not the Gregorian year 1420');
  assert.equal(workYearOf(w('2015')), 2015);
  assert.deepEqual(valuesOf(w('1420 هـ'), 'century'), ['15']);
  assert.deepEqual(valuesOf(w('1375 هـ'), 'century'), ['14']);
  assert.deepEqual(valuesOf(w('1950'), 'century'), ['14']);
  assert.match(valueLabel('century', '14'), /14/);
});
