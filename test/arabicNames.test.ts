// Arabic names: parts found in Arabic script and in LC romanization, forms written differently recognized as
// one person, and different people sharing a nisba not taken as one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseArabicName, nameKeys, sameNameScore, nameVariants, foldArabic } from '../src/services/arabicNames';

test('the parts of an Arabic name', () => {
  const p = parseArabicName('أبو زيد عبد الرحمن بن محمد بن خلدون الحضرمي');
  assert.equal(p.kunya, 'أبو زيد');
  assert.equal(p.ism, 'عبد الرحمن');
  assert.deepEqual(p.nasab, ['محمد', 'خلدون']);
  assert.deepEqual(p.nisba, ['الحضرمي']);
  const t = parseArabicName('نصير الدين محمد بن محمد الطوسي، 597-672 هـ');
  assert.equal(t.laqab, 'الدين');
  assert.equal(t.dates, '597-672 هـ');
  assert.deepEqual(t.nisba, ['الطوسي']);
});

test('LC\'s inverted romanized form', () => {
  const p = parseArabicName('Ibn Khaldūn, ʻAbd al-Raḥmān ibn Muḥammad, 1332-1406');
  assert.equal(p.entry, 'Ibn Khaldūn');
  assert.equal(p.ism, 'ʻAbd al-Raḥmān');
  assert.deepEqual(p.nasab, ['Muḥammad']);
  assert.equal(p.dates, '1332-1406');
  assert.equal(p.script, 'latin');
  const g = parseArabicName('Ghazzālī, 1058-1111');
  assert.equal(g.entry, undefined, 'a one-element heading is not inverted');
  assert.equal(g.ism, 'Ghazzālī');
});

test('forms written differently are one person', () => {
  assert.equal(sameNameScore('عبد الرحمن بن محمد بن خلدون', 'عبدالرحمن ابن محمد ابن خلدون'), 1, 'ابن/بن and عبد الرحمن/عبدالرحمن');
  assert.equal(sameNameScore('عَبْد الرَّحْمٰن بن مُحَمَّد', 'عبد الرحمن بن محمد'), 1, 'diacritics');
  assert.equal(sameNameScore('ابن خلدون', 'ابن خلدون، عبد الرحمن بن محمد، 1332-1406'), 0.85, 'known-by element');
  assert.equal(sameNameScore('Ibn Khaldun', 'Ibn Khaldūn, ʻAbd al-Raḥmān ibn Muḥammad, 1332-1406'), 0.85);
  assert.equal(sameNameScore('Abdul Rahman ibn Muhammad', 'ʻAbd al-Raḥmān ibn Muḥammad'), 1, 'Abdul / ʻAbd al-');
  assert.equal(sameNameScore('أبو حامد الغزالي', 'أبي حامد الغزالي'), 0.7, 'kunya case form and nisba');
});

test('different people who share a nisba are not taken as one', () => {
  assert.ok(sameNameScore('الخطيب البغدادي', 'عبد القاهر البغدادي') <= 0.3);
  assert.equal(sameNameScore('محمد بن الحسن الطوسي', 'محمد بن يعقوب الكليني'), 0);
});

test('variants an entity should carry', () => {
  const v = nameVariants('ابن خلدون، عبد الرحمن بن محمد');
  assert.ok(v.includes('عبد الرحمن بن محمد'));
  assert.ok(v.includes('ابن خلدون'));
  assert.ok(v.includes('عبد الرحمن ابن محمد'));
  assert.ok(v.some((x) => x === foldArabic(x)), 'a form without hamza or diacritics');
  const r = nameVariants('Ibn Khaldūn, ʻAbd al-Raḥmān ibn Muḥammad');
  assert.ok(r.includes('ʻAbd al-Raḥmān ibn Muḥammad'));
  assert.ok(r.some((x) => /^Abd Al-Rahman Ibn Muhammad$/i.test(x)), 'plain letters');
  assert.ok(nameKeys('ابن خلدون').length >= 2);
});

import { rankByName } from '../src/services/authoritySearch';

test('search results: Moon first, then the best name match, in each result\'s own script', () => {
  const ranked = rankByName([
    { label: 'Khaldūn, Sāṭiʻ', uri: 'http://id.loc.gov/authorities/names/n1', source: 'LOC' },
    { label: 'Ibn Khaldūn, ʻAbd al-Raḥmān ibn Muḥammad, 1332-1406', uri: 'http://id.loc.gov/authorities/names/n50052785', source: 'LOC' },
    { label: 'خلدون الحصري', uri: 'http://www.wikidata.org/entity/Q2', source: 'Wikidata' },
    { label: 'ابن خلدون', uri: 'https://mooon.site/resource/agent/ibn-khaldun', source: 'Moon' },
  ], 'ابن خلدون', 'Ibn Khaldūn');
  assert.equal(ranked[0].source, 'Moon');
  assert.equal(ranked[1].uri, 'http://id.loc.gov/authorities/names/n50052785', 'LC\'s Ibn Khaldūn before other Khalduns');
});
