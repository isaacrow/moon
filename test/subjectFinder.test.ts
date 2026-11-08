// Phase 13 S16: subjects suggested from the nearest records (no AI): Arabic-aware words, rare words weigh more.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { words, buildIndex, nearest, suggestSubjects, finderRecordOf, type FinderRecord } from '../supabase/functions/server/subjectFinder.tsx';

const recs: FinderRecord[] = [
  { id: 'a', title: 'تاريخ بغداد', text: 'الخطيب البغدادي تاريخ العلماء في بغداد', subjects: [{ label: 'بغداد (العراق) -- تاريخ', uri: 'http://id.loc.gov/authorities/subjects/sh1' }, { label: 'علماء' }] },
  { id: 'b', title: 'بغداد في العصر العباسي', text: 'دراسة في تاريخ مدينة بغداد', subjects: [{ label: 'بغداد (العراق) -- تاريخ', uri: 'http://id.loc.gov/authorities/subjects/sh1' }, { label: 'العصر العباسي' }] },
  { id: 'c', title: 'ديوان المتنبي', text: 'شعر عربي قديم', subjects: [{ label: 'الشعر العربي' }] },
  { id: 'd', title: 'Baghdad: the city in verse', text: 'poems about Baghdad history', subjects: [{ label: 'Baghdad (Iraq) -- Poetry' }] },
];

test('words: Arabic folded, the article and stop words gone', () => {
  assert.deepEqual(words('تأريخ بَغْداد في العصر العبّاسي'), ['تاريخ', 'بغداد', 'عصر', 'عباسي']);
  assert.deepEqual(words('Al-Baghdadi and the City'), ['baghdadi', 'city']);
});

test('nearest records and their subjects, best first; what the draft has is left out', () => {
  const index = buildIndex(recs);
  const near = nearest(index, 'تاريخ بغداد في العصر العباسي');
  assert.equal(near[0].r.id, 'b');
  assert.ok(!near.some((x) => x.r.id === 'c'), 'a book sharing no words is not near');
  const s = suggestSubjects(index, 'تاريخ بغداد في العصر العباسي');
  assert.equal(s[0].label, 'بغداد (العراق) -- تاريخ');
  assert.deepEqual(s[0].records.map((x) => x.id).sort(), ['a', 'b']);
  assert.ok(s.some((x) => x.label === 'العصر العباسي'));
  const without = suggestSubjects(index, 'تاريخ بغداد', [{ label: 'x', uri: 'http://id.loc.gov/authorities/subjects/sh1' }]);
  assert.ok(!without.some((x) => x.uri === 'http://id.loc.gov/authorities/subjects/sh1'));
  assert.deepEqual(suggestSubjects(index, 'تاريخ بغداد', [], 'a').flatMap((x) => x.records.map((r) => r.id)).includes('a'), false, 'the record itself is not its own neighbour');
});

test('records read from BIBFRAME', () => {
  const r = finderRecordOf({ id: 'x', title: 'T', document: { '@graph': [
    { '@type': 'bf:Work', 'bf:title': { 'bf:mainTitle': 'تاريخ بغداد' }, 'bf:summary': { 'rdfs:label': 'كتاب عن بغداد' },
      'bf:contribution': { 'bf:agent': { 'rdfs:label': 'الخطيب البغدادي' } },
      'bf:subject': [{ '@id': 'http://id.loc.gov/authorities/subjects/sh1', '@type': 'bf:Topic', 'rdfs:label': 'بغداد' }] },
  ] } });
  assert.match(r.text, /تاريخ بغداد .*كتاب عن بغداد .*الخطيب البغدادي/);
  assert.deepEqual(r.subjects, [{ label: 'بغداد', uri: 'http://id.loc.gov/authorities/subjects/sh1', type: 'bf:Topic' }]);
});
