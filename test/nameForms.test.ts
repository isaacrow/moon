// Phase 13 S10: name forms by script. Each form is tagged; a person marks the preferred form per script;
// a book in Arabic script shows and exports the Arabic form (with the romanization in MARC 100 + 880).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formTag, taggedForms, cleanPreferred, displayName, withoutPrivateData, bookScript, withPreferredNames, agentUris } from '../src/services/nameForms';
import { bibframeToMarc } from '../src/services/marc/bibframeToMarc';

const IK = 'https://mooon.site/resource/agent/ibn-khaldun';

test('each form is tagged by its script', () => {
  assert.equal(formTag('ابن خلدون، عبد الرحمن بن محمد'), 'ar');
  assert.equal(formTag('Ibn Khaldūn, ʻAbd al-Raḥmān ibn Muḥammad, 1332-1406'), 'ar-Latn-t-ar-m0-alaloc');
  assert.equal(formTag('Ibn Khaldun'), 'und-Latn');
  assert.equal(formTag('ابن خلدون', 'fa'), 'fa');
  const forms = taggedForms('Ibn Khaldūn, 1332-1406', ['ابن خلدون', 'Ibn Khaldun', 'ابن خلدون'], { arabic: 'ابن خلدون' });
  assert.deepEqual(forms.map((f) => [f.script, f.preferred]), [['latin', false], ['arabic', true], ['latin', false]]);
});

test('a preferred form must be one of the names, in the right script', () => {
  assert.deepEqual(cleanPreferred({ arabic: 'ابن خلدون', latin: 'ابن خلدون' }, 'Ibn Khaldūn', ['ابن خلدون']), { arabic: 'ابن خلدون' });
  assert.deepEqual(cleanPreferred({ arabic: 'ابن رشد' }, 'Ibn Khaldūn', ['ابن خلدون']), {}, 'not a name of this entity');
  assert.deepEqual(cleanPreferred('x', 'a', []), {});
  assert.equal(displayName('Ibn Khaldūn', { arabic: 'ابن خلدون' }, 'arabic'), 'ابن خلدون');
  assert.equal(displayName('Ibn Khaldūn', { arabic: 'ابن خلدون' }, 'latin'), 'Ibn Khaldūn');
});

test('agent records keep no private details', () => {
  const { data, removed } = withoutPrivateData({ birthDate: '1332', email: 'x@y.com', note: 'call +964 770 123 4567', phone: '1', occupation: 'historian', dates: '1332-1406' });
  assert.deepEqual(data, { birthDate: '1332', occupation: 'historian', dates: '1332-1406' });
  assert.deepEqual(removed.sort(), ['email', 'note', 'phone']);
});

const record = (lang: string) => ({ '@graph': [
  { '@id': 'w', '@type': 'bf:Work', 'bf:language': { '@id': `http://id.loc.gov/vocabulary/languages/${lang}` },
    'bf:contribution': { '@type': ['bf:Contribution', 'bf:PrimaryContribution'], 'bf:agent': { '@id': IK, '@type': 'bf:Person', 'rdfs:label': 'ابن خلدون', 'bflc:marcKey': '1000 $aIbn Khaldūn' } } },
  { '@id': 'i', '@type': 'bf:Instance', 'bf:instanceOf': { '@id': 'w' }, 'bf:title': { '@type': 'bf:Title', 'bf:mainTitle': 'المقدمة' } },
] });

test('the book\'s script: Arabic, Persian, Urdu … are Arabic script', () => {
  assert.equal(bookScript(record('ara')), 'arabic');
  assert.equal(bookScript(record('per')), 'arabic');
  assert.equal(bookScript(record('eng')), 'latin');
  assert.deepEqual(agentUris(record('ara')), [IK]);
});

test('in an Arabic book the export gives the romanization in 100 and the Arabic form in its 880', () => {
  const forms = new Map([[IK, { arabic: 'ابن خلدون، عبد الرحمن بن محمد، 732-808 هـ', latin: 'Ibn Khaldūn, ʻAbd al-Raḥmān ibn Muḥammad, 1332-1406' }]]);
  const marc = bibframeToMarc(withPreferredNames(record('ara'), forms) as any, { recordId: 'r1' });
  const f100 = marc.fields.find((f: any) => f.tag === '100')!;
  const f880 = marc.fields.find((f: any) => f.tag === '880' && f.subfields.some(([c, v]: any) => c === '6' && v.startsWith('100')))!;
  assert.equal(f100.subfields.find(([c]: any) => c === 'a')![1], 'Ibn Khaldūn, ʻAbd al-Raḥmān ibn Muḥammad, 1332-1406');
  assert.equal(f880.subfields.find(([c]: any) => c === 'a')![1], 'ابن خلدون، عبد الرحمن بن محمد، 732-808 هـ');
  // In an English book: the romanized preferred form only.
  const en = withPreferredNames(record('eng'), forms);
  assert.equal(en['@graph'][0]['bf:contribution']['bf:agent']['rdfs:label'], 'Ibn Khaldūn, ʻAbd al-Raḥmān ibn Muḥammad, 1332-1406');
  // No preferred forms: the record is unchanged.
  assert.deepEqual(withPreferredNames(record('ara'), new Map()), record('ara'));
});
