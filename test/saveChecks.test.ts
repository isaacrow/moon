// Phase 13 S17: the checks before a save, in three levels and plain words. A full record passes; a record
// without a title must be fixed; missing core data asks first; what would make it better is only noted.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { saveChecks, checksText } from '../src/services/saveChecks';

const full = {
  work: {
    'bf:title': { '@type': 'bf:Title', 'bf:mainTitle': 'الوعد الحق' },
    'bf:content': { '@id': 'http://id.loc.gov/vocabulary/contentTypes/txt' },
    'bf:language': { '@id': 'http://id.loc.gov/vocabulary/languages/ara' },
    'bf:contribution': { 'bf:agent': { '@id': 'https://mooon.site/resource/agent/taha-husayn', 'rdfs:label': 'حسين، طه، 1889-1973' } },
    'bf:subject': { '@type': 'bf:Topic', 'rdfs:label': 'Islam -- History -- Fiction' },
    'bf:classification': { '@type': 'bf:ClassificationLcc', 'bf:classificationPortion': 'PJ7828' },
  },
  instance: {
    'bf:title': [{ '@type': 'bf:Title', 'bf:mainTitle': 'الوعد الحق' }, { '@type': 'bf:Title', 'bf:mainTitle': 'al-Waʻd al-ḥaqq' }],
    'bf:media': { '@id': 'http://id.loc.gov/vocabulary/mediaTypes/n' },
    'bf:carrier': { '@id': 'http://id.loc.gov/vocabulary/carriers/nc' },
    'bf:provisionActivity': { '@type': 'bf:Publication', 'bf:agent': { 'rdfs:label': 'الهيئة المصرية العامة للكتاب' }, 'bf:date': '1995' },
    'bf:extent': { '@type': 'bf:Extent', 'rdfs:label': '180 صفحة' },
    'bf:identifiedBy': { '@type': 'bf:Isbn', 'rdf:value': '9789770144084' },
  },
};

test('a full record passes every check', () => {
  assert.deepEqual(saveChecks(full.work, full.instance), []);
});

test('no title: must be fixed', () => {
  const r = saveChecks({ ...full.work, 'bf:title': undefined }, { ...full.instance, 'bf:title': [] });
  assert.deepEqual(r.filter((c) => c.level === 'must').map((c) => c.field), ['title']);
});

test('missing core data asks first; what would make it better is a note', () => {
  const r = saveChecks({ 'bf:title': { 'bf:mainTitle': 'الوعد الحق' } }, {});
  const by = (l: string) => r.filter((c) => c.level === l).map((c) => c.field);
  assert.deepEqual(by('must'), []);
  assert.deepEqual(by('should'), ['content', 'media', 'carrier', 'language', 'date', 'publisher', 'extent', 'contribution']);
  assert.deepEqual(by('note'), ['subject', 'classification', 'identifiedBy', 'title']);
  assert.match(checksText(r.filter((c) => c.level === 'note'), true), /^• لا موضوع/);
});

test('an unlinked name is a note, with how many', () => {
  const r = saveChecks({ ...full.work, 'bf:contribution': [{ 'bf:agent': { 'rdfs:label': 'محمود، أنيس' } }] }, full.instance);
  assert.deepEqual(r.map((c) => [c.level, c.en]), [['note', '1 name(s) not linked to an entity.']]);
});

test('Moon\'s sample records: no "must" problem', () => {
  for (const name of ['al-qabasat', 'b125923']) {
    const g = JSON.parse(readFileSync(new URL(`../public/records/${name}.jsonld`, import.meta.url), 'utf8'))['@graph'];
    const work = g.find((n: any) => [].concat(n['@type']).includes('bf:Work'));
    const instance = g.find((n: any) => [].concat(n['@type']).includes('bf:Instance'));
    assert.deepEqual(saveChecks(work, instance).filter((c) => c.level === 'must'), [], name);
  }
});
