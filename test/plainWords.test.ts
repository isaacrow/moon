// Phase 13 S13: the OPAC in plain words: what a book is in one line, formats across editions, what sets
// each edition apart, and the "exact words only" switch.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { whatItIs, formatChips, editionLines, exactMatch } from '../src/opac/plainWords';

test('one plain "what it is" line, each fact once', () => {
  assert.equal(whatItIs({ id: 'a', title: 'x', languageLabel: 'العربية (ara)', genreForm: ['شعر'], instances: [{ carrierType: 'volume' }] }), 'كتاب مطبوع · العربية · شعر');
  assert.equal(whatItIs({ id: 'b', title: 'x', language: 'ara', genreForm: ['كتاب', 'العربية', 'شعر', 'شعر'], instances: [] }), 'العربية · شعر', 'a category that repeats the language or says "book" is left out');
  assert.equal(whatItIs({ id: 'c', title: 'x', genreForm: ['مخطوط'], instances: [{ carrierType: 'manuscript' }] }), 'مخطوط');
});

test('format chips across the editions of a Work', () => {
  assert.deepEqual(formatChips([
    { id: 'a', title: 'x', instances: [{ carrierType: 'volume' }] },
    { id: 'b', title: 'x', instances: [{ carrierType: 'online resource' }] },
    { id: 'c', title: 'x', instances: [{ carrierType: 'volume' }] },
  ]), ['كتاب مطبوع', 'مصدر إلكتروني']);
});

test('each edition says only what is different from the others', () => {
  const eds = [
    { id: 'a', title: 'المقدمة', languageLabel: 'العربية', instances: [{ publisher: 'دار الفكر', publicationPlace: 'بيروت :', publicationYear: '1981', carrierType: 'volume' }] },
    { id: 'b', title: 'المقدمة', languageLabel: 'العربية', instances: [{ publisher: 'دار الكتب العلمية', publicationPlace: 'بيروت', publicationYear: '1993', carrierType: 'volume' }] },
    { id: 'c', title: 'The Muqaddimah', languageLabel: 'الإنجليزية', contributors: [{ name: 'Rosenthal, Franz', role: 'translator' }], instances: [{ publisher: 'Princeton University Press', publicationPlace: 'Princeton', publicationYear: '1967', carrierType: 'volume' }] },
  ];
  const lines = editionLines(eds).map((x) => x.line);
  assert.equal(lines[0], 'العربية · بيروت : دار الفكر · 1981', 'the format is the same for all, so it is not said');
  assert.equal(lines[2], 'الإنجليزية · ترجمة Rosenthal, Franz · Princeton : Princeton University Press · 1967');
  assert.equal(editionLines([eds[0], { ...eds[0], id: 'z' }])[1].line, 'الوصف نفسه');
});

test('"exact words only": whole words, the article allowed; close matches are the default', () => {
  const w = { title: 'مهزلة العقل البشري', primaryCreator: { nameArabic: 'علي الوردي', nameEnglish: 'Ali al-Wardi' }, subjects: [{ label: 'علم الاجتماع' }] };
  assert.ok(exactMatch(w, 'العقل'));
  assert.ok(exactMatch(w, 'عقل الوردي'));
  assert.ok(exactMatch(w, 'Wardi'));
  assert.ok(!exactMatch(w, 'عق'), 'part of a word is a close match, not an exact one');
  assert.ok(!exactMatch(w, 'العقل الفلسفي'));
  assert.ok(exactMatch(w, '  '));
});
