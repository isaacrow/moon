// Phase 13 S9: ALA-LC romanization back to Arabic script, for a person to check.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toArabicScript, looksAlaLc } from '../src/services/alaLcToArabic';
import { findArabizable } from '../src/services/romanize';

test('titles and names come back in Arabic script', () => {
  const cases: Array<[string, string]> = [
    ['al-Qabasāt', 'القبسات'],
    ['Kitāb al-ʻibar', 'كتاب العبر'],
    ['al-Muqaddimah', 'المقدمة'],
    ['Ibn Khaldūn', 'ابن خلدون'],
    ['ʻAbd al-Raḥmān', 'عبد الرحمن'],
    ['ʻalá', 'على'],
    ['Bayrūt', 'بيروت'],
    ['Dimashq', 'دمشق'],
    ['Mīr Dāmād', 'مير داماد'],
    ['Shuʼūn', 'شؤون'],
    ['wa-al-nihāyah', 'والنهاية'],
    ['lil-ṭibāʻah', 'للطباعة'],
    ['Dār al-Kutub al-ʻIlmīyah', 'دار الكتب العلمية'],
    ['Taʼrīkh Baghdād', 'تأريخ بغداد'],
    ['Muḥammad', 'محمد'],
    ['Mahzalat al-ʻaql al-basharī', 'مهزلة العقل البشري'],
  ];
  for (const [latin, arabic] of cases) assert.equal(toArabicScript(latin), arabic, latin);
});

test('punctuation becomes Arabic; plain English is not taken for ALA-LC', () => {
  assert.equal(toArabicScript('Ibn Khaldūn, ʻAbd al-Raḥmān'), 'ابن خلدون، عبد الرحمن');
  assert.ok(looksAlaLc('al-Qabasāt'));
  assert.ok(!looksAlaLc('The Muqaddimah'));
  assert.ok(!looksAlaLc('القبسات'));
});

test('romanized values without their Arabic are found, in the romanized properties only', () => {
  const work = {
    'bf:title': { 'bf:mainTitle': 'Kitāb al-ʻibar' },
    'bf:summary': 'Taʼrīkh …',
    'bf:contribution': { 'bf:agent': { 'rdfs:label': ['Ibn Khaldūn', 'ابن خلدون'] } },
  };
  const found = findArabizable(work, 'work');
  assert.deepEqual(found.map((f) => [f.field, f.latin]), [['mainTitle', 'Kitāb al-ʻibar']]);
});
