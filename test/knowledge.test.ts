// Phase 13 S14: OPAC knowledge pages from the catalogue's own records.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { whoOf, isThem, aboutPerson, teachersAndStudents, personPlaces, shelfKey, shelfNeighbours, subjectsAlongside } from '../src/opac/knowledge';

const ik = whoOf({ nameArabic: 'ابن خلدون، عبد الرحمن بن محمد', name: 'Ibn Khaldūn', uri: 'https://mooon.site/resource/agent/ik' });

test('a person is recognised by address or by a sure form of the name', () => {
  assert.ok(isThem(ik, 'x', 'https://mooon.site/resource/agent/ik'));
  assert.ok(isThem(ik, 'ابن خلدون'));
  assert.ok(isThem(ik, 'ibn khaldun'));
  assert.ok(!isThem(ik, 'ابن رشد'));
});

const works = [
  { id: 'by', title: 'المقدمة', primaryCreator: { nameArabic: 'ابن خلدون' }, instances: [{ publicationPlace: 'بيروت :', callNumber: 'D16.7 .I2 1981' }] },
  { id: 'about', title: 'فلسفة ابن خلدون', subjects: [{ label: 'ابن خلدون، عبد الرحمن بن محمد -- نقد وتفسير' }], instances: [{ publicationPlace: '[القاهرة]', callNumber: 'D16.7 .I3' }] },
  { id: 'ms', title: 'شرح', instances: [{ callNumber: 'D16.8' }], holdingItems: [{ events: [
    { kind: 'ijazah', place: { label: 'تونس' }, participants: [{ role: 'teacher', label: 'محمد بن إبراهيم الآبلي' }, { role: 'student', label: 'ابن خلدون، عبد الرحمن' }] },
    { kind: 'sama', participants: [{ role: 'teacher', label: 'ابن خلدون', uri: 'https://mooon.site/resource/agent/ik' }, { role: 'listener', label: 'المقريزي' }, { role: 'listener', label: 'المقريزي' }] },
    { kind: 'ownership', participants: [{ role: 'owner', label: 'ابن خلدون' }, { role: 'owner', label: 'Someone' }] },
  ] }] },
  { id: 'other', title: 'Other', classificationDdc: '892.7', instances: [{}] },
  { id: 'nomark', title: 'No mark', instances: [{}] },
];

test('works about the person, teachers and students from the notes, places', () => {
  assert.deepEqual(aboutPerson(ik, works).map((w) => w.id), ['about']);
  const { teachers, students } = teachersAndStudents(ik, works);
  assert.deepEqual(teachers.map((x) => [x.label, x.kind]), [['محمد بن إبراهيم الآبلي', 'ijazah']]);
  assert.deepEqual(students.map((x) => x.label), ['المقريزي'], 'once each; owners are not students');
  assert.deepEqual(personPlaces(ik, [works[0]], works).map((p) => p.label), ['بيروت', 'تونس']);
});

test('the shelf: real call numbers in order, none made up', () => {
  assert.ok(shelfKey('PJ7755 .A5') < shelfKey('PJ7755.2'));
  assert.ok(shelfKey('PJ7755.2') < shelfKey('PJ7756'));
  assert.ok(shelfKey('D16.7 .I2') < shelfKey('D16.8'));
  assert.ok(shelfKey('892.7') < shelfKey('892.71'));
  assert.deepEqual(shelfNeighbours(works[1], works, 2).map((w) => w.id), ['by', 'ms']);
  assert.deepEqual(shelfNeighbours(works[4], works), [], 'a book with no call number has no shelf');
});

test('subjects given together', () => {
  const ws = [
    { id: 'a', title: 'a', subjects: [{ label: 'تاريخ' }, { label: 'العراق' }] },
    { id: 'b', title: 'b', subjects: [{ label: 'تاريخ' }, { label: 'العراق' }, { label: 'بغداد' }] },
    { id: 'c', title: 'c', subjects: [{ label: 'شعر' }] },
  ];
  assert.deepEqual(subjectsAlongside('تاريخ', ws), [{ label: 'العراق', count: 2 }, { label: 'بغداد', count: 1 }]);
});
