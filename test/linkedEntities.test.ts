// OPAC entity pages: place names grouped across scripts and ISBD punctuation, Wikidata info cards from
// saved real responses (test/fixtures/wikidata), and BIBFRAME relationships resolved both ways.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { placeName, placesOf, worksAtPlace, wikidataQid, parseInfoCard, relationsOf, clusterWorks } from '../src/opac/linkedEntities';

const fixture = (q: string) => JSON.parse(readFileSync(new URL(`./fixtures/wikidata/${q}.json`, import.meta.url), 'utf8'));
const work = (id: string, title: string, places: string[], extra: any = {}): any =>
  ({ id, uri: `https://mooon.site/resource/work/${id}`, canonicalMoonUri: '', title, instances: places.map((p, i) => ({ id: `${id}-${i}`, publicationPlace: p })), ...extra });

test('place names: city only, no ISBD punctuation, no country, no brackets', () => {
  assert.equal(placeName('بغداد، العراق'), 'بغداد');
  assert.equal(placeName('London ; Portland, Ore.'), 'London');
  assert.equal(placeName('al-Dawrah, Iraq : Directorate'), 'al-Dawrah');
  assert.equal(placeName('[Beirut] :'), 'Beirut');
  assert.equal(placeName(undefined), '');
});

test('places: one entry per city, counted by Work, unknown places left out', () => {
  const works = [work('a', 'A', ['بغداد، العراق']), work('b', 'B', ['بغداد :', 'بيروت، لبنان']), work('c', 'C', ['[S.l.]'])];
  assert.deepEqual(placesOf(works), [{ name: 'بغداد', count: 2 }, { name: 'بيروت', count: 1 }]);
  assert.deepEqual(worksAtPlace(works, 'بغداد').map(w => w.id), ['a', 'b']);
  assert.deepEqual(worksAtPlace(works, ''), []);
});

test('Wikidata id from sameAs links', () => {
  assert.equal(wikidataQid([undefined, 'http://viaf.org/viaf/1', 'https://www.wikidata.org/wiki/Q4121866']), 'Q4121866');
  assert.equal(wikidataQid(['http://www.wikidata.org/entity/Q1530']), 'Q1530');
  assert.equal(wikidataQid(['Q42']), 'Q42');
  assert.equal(wikidataQid(['https://example.org/Q42x']), undefined);
});

test('info card for a person: Arabic label and description, Commons image, full dates', () => {
  const c = parseInfoCard(fixture('Q4121866'), 'Q4121866', 'ar')!;
  assert.equal(c.label, 'محمد مهدي الجواهري');
  assert.ok(c.description);
  assert.equal(c.born, '1899-07-26');
  assert.equal(c.died, '1997-07-27');
  assert.match(c.image!, /^https:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\/.+\?width=320$/);
  assert.equal(c.url, 'https://www.wikidata.org/wiki/Q4121866');
  assert.equal(parseInfoCard(fixture('Q4121866'), 'Q4121866', 'en')!.label, 'Muhammad Mahdi Al-Jawahiri');
});

test('info card for a place: coordinates, no person dates; a missing item gives nothing', () => {
  const c = parseInfoCard(fixture('Q1530'), 'Q1530', 'ar')!;
  assert.equal(c.label, 'بغداد');
  assert.ok(c.coordinates && Math.abs(c.coordinates.lat - 33.3) < 0.1);
  assert.equal(c.born, undefined);
  assert.equal(parseInfoCard({ entities: { Q1: { id: 'Q1', missing: '' } } }, 'Q1', 'ar'), null);
  assert.equal(parseInfoCard({}, 'Q1', 'ar'), null);
});

test('a wrong Q-number shows no card: a city is not a person, a poet is not a place', () => {
  assert.equal(parseInfoCard(fixture('Q1530'), 'Q1530', 'ar', 'person'), null);
  assert.equal(parseInfoCard(fixture('Q4121866'), 'Q4121866', 'ar', 'place'), null);
  assert.ok(parseInfoCard(fixture('Q4121866'), 'Q4121866', 'ar', 'person'));
  assert.ok(parseInfoCard(fixture('Q1530'), 'Q1530', 'ar', 'place'));
});

test('related Works: resolved by URI or title, and shown on the other Work too', () => {
  const original = work('orig', 'القبسات', []);
  const translation = work('tr', 'Al-Qabasat (English)', [], {
    relatedWorks: [{ predicate: 'bf:translationOf', predicateLabel: 'Translation of', targetTitle: 'x', targetUri: 'https://mooon.site/resource/work/orig' }],
  });
  const commentary = work('cm', 'شرح القبسات', [], {
    relatedWorks: [{ predicate: 'bf:relatedTo', predicateLabel: 'Related to', targetTitle: 'القبسات' }, { predicate: 'bf:relatedTo', predicateLabel: 'Related to', targetTitle: 'Not here' }],
  });
  const all = [original, translation, commentary];
  assert.equal(relationsOf(translation, all).outgoing[0].workId, 'orig');
  const cm = relationsOf(commentary, all).outgoing;
  assert.equal(cm[0].workId, 'orig');
  assert.equal(cm[1].workId, undefined, 'a Work not in the catalogue stays plain text');
  assert.deepEqual(relationsOf(original, all).incoming.map(x => x.work.id).sort(), ['cm', 'tr']);
});

test('Work-first results: editions, hubs and translations become one result, order kept', () => {
  const wardi = { name: 'علي الوردي', nameEnglish: 'Ali al-Wardi' };
  const all = [
    work('e2', 'مهزلة العقل البشري', [], { primaryCreator: wardi }),
    work('x', 'شظايا ورماد', [], { primaryCreator: { name: 'نازك الملائكة' } }),
    work('e1', 'مُهزلة العقل البشريّ : دراسة', [], { primaryCreator: { name: 'د. علي الوردي' } }),
    work('en', 'The Mockery of the Human Mind', [], {
      primaryCreator: { name: 'Ali al-Wardi' },
      relatedWorks: [{ predicate: 'bf:translationOf', predicateLabel: 'Translation of', targetTitle: '', targetUri: 'https://mooon.site/resource/work/e2' }],
    }),
    work('h1', 'ألف ليلة وليلة', [], { expressionOfHub: { uri: 'https://mooon.site/resource/hub/1001', label: 'Alf layla' } }),
    work('h2', 'The Thousand and One Nights', [], { expressionOfHub: { uri: 'https://mooon.site/resource/hub/1001', label: 'Alf layla' } }),
    work('q1', 'ديوان', []),
    work('q2', 'ديوان', []),
  ];
  const c = clusterWorks(all);
  assert.deepEqual(c.map(g => g.members.map(w => w.id)), [['e2', 'e1', 'en'], ['x'], ['h1', 'h2'], ['q1'], ['q2']]);
  assert.equal(c[0].lead.id, 'e2', 'the best-placed record leads');
  assert.deepEqual(clusterWorks([]), []);
});
