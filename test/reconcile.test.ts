// Phase 12, step 5: Moon's entities matched to LC, VIAF and Wikidata. Real LC and Wikidata records (fixtures)
// stand in for the services: sure matches are found, a different person with the same name is not taken,
// and the links a match brings include every outside address its records carry.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reconcileEntity, headingKey, lifeYears, type ReconcileDeps } from '../src/services/reconcile';
import { fetchOutsideEntity } from '../src/services/entityImport';

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/entity-import/${name}`, import.meta.url), 'utf8'));
const IBN_KHALDUN_LC = 'http://id.loc.gov/authorities/names/n50052785';

/** LC and Wikidata as the fixtures answer them. */
function deps(found: { lc?: any[]; wd?: any[] } = {}): ReconcileDeps & { asked: string[] } {
  const asked: string[] = [];
  const fetchJson = async (url: string) => {
    const lc = url.match(/id\.loc\.gov\/authorities\/(\w+)\/(\w+)\.json$/);
    if (lc) return fixture(`lc-${lc[1]}-${lc[2]}.json`);
    const u = new URL(url);
    if (u.searchParams.get('props') === 'labels') return { entities: {} };
    const ids = u.searchParams.get('ids') || '';
    return fixture(`wd-${ids}.json`);
  };
  return {
    asked,
    searchLc: async (q, scheme) => { asked.push(`lc:${scheme}:${q}`); return found.lc || []; },
    searchWikidata: async (q) => { asked.push(`wd:${q}`); return found.wd || []; },
    romanize: async (q) => ({ 'ابن خلدون': 'Ibn Khaldūn', 'بغداد': 'Baghdād' } as Record<string, string>)[q] || '',
    details: (uri) => fetchOutsideEntity(uri, { fetchJson }),
  };
}

test('headings compare without qualifiers, in either script; dates are read from data or the heading', () => {
  assert.equal(headingKey('Baghdad (Iraq)'), headingKey('Baghdad'));
  assert.equal(headingKey('بغداد (عراق)'), headingKey('بغداد'));
  assert.deepEqual(lifeYears('Ibn Khaldūn, 1332-1406'), { born: 1332, died: 1406 });
  assert.deepEqual(lifeYears('x', { birthDate: '1332-05-27' }), { born: 1332, died: undefined });
});

test('an Arabic-named person is found in LC by romanization and linked surely, with Wikidata, VIAF and FAST', async () => {
  const d = deps({
    lc: [{ label: 'Ibn Khaldūn, 1332-1406', uri: IBN_KHALDUN_LC, source: 'LOC' }],
    wd: [{ label: 'Ibn Khaldun', uri: 'http://www.wikidata.org/entity/Q9294', source: 'Wikidata' }],
  });
  const r = await reconcileEntity({ id: 'ibn-khaldun-1', kind: 'agent', label: 'ابن خلدون، 1332-1406', variants: [] }, d);
  assert.ok(d.asked.includes('lc:names:Ibn Khaldūn'), 'LC searched with the romanized name');
  assert.ok(r.sure, 'a sure match');
  assert.equal(r.candidates.length, 1, 'LC and Wikidata records of one person are one candidate');
  for (const u of [IBN_KHALDUN_LC, 'http://www.wikidata.org/entity/Q9294', 'http://viaf.org/viaf/41841661', 'http://id.worldcat.org/fast/17753']) {
    assert.ok(r.sure!.links.includes(u), `brings ${u}`);
  }
  assert.ok(r.sure!.reasons.includes('same dates'));
});

test('a person with the same name but other dates is not taken', async () => {
  const r = await reconcileEntity({ id: 'x', kind: 'agent', label: 'Ibn Khaldūn, 1700-1760' },
    deps({ lc: [{ label: 'Ibn Khaldūn, 1332-1406', uri: IBN_KHALDUN_LC, source: 'LOC' }] }));
  assert.equal(r.sure, null);
  assert.ok(!r.candidates.length || r.candidates[0].reasons.includes('different dates'));
});

test('places and subjects match by heading, and a place is not matched to a subject', async () => {
  const place = await reconcileEntity({ id: 'baghdad', kind: 'place', label: 'بغداد' },
    deps({ lc: [{ label: 'Baghdad (Iraq)', uri: 'http://id.loc.gov/authorities/names/n80006292', source: 'LOC' }] }));
  assert.ok(place.sure, 'بغداد = Baghdad (Iraq) through LC\'s Arabic form');
  const topic = await reconcileEntity({ id: 'philo', kind: 'topic', label: 'Islamic philosophy' },
    deps({ lc: [{ label: 'Islamic philosophy', uri: 'http://id.loc.gov/authorities/subjects/sh85100934', source: 'LOC' }] }));
  assert.ok(topic.sure);
  const wrongKind = await reconcileEntity({ id: 'p', kind: 'agent', label: 'Islamic philosophy' },
    deps({ lc: [{ label: 'Islamic philosophy', uri: 'http://id.loc.gov/authorities/subjects/sh85100934', source: 'LOC' }] }));
  assert.equal(wrongKind.candidates.length, 0, 'a subject is not a person');
});

test('a name known only by its short form waits for review', async () => {
  const r = await reconcileEntity({ id: 'k', kind: 'agent', label: 'ابن خلدون' },
    deps({ lc: [{ label: 'Ibn Khaldūn, 1332-1406', uri: IBN_KHALDUN_LC, source: 'LOC' }] }));
  assert.ok(r.candidates.length >= 1, 'offered');
  assert.equal(r.sure, null, 'no dates to confirm it: a person decides');
});

test('a subject keeps its subdivisions: "Islamic philosophy" is not "Islamic philosophy--Early works to 1800"', () => {
  assert.notEqual(headingKey('Islamic philosophy', 'topic'), headingKey('Islamic philosophy--Early works to 1800', 'topic'));
  assert.equal(headingKey('Islam -- Doctrines', 'topic'), headingKey('Islam--Doctrines', 'topic'));
  assert.notEqual(headingKey('Daʻwah (Islam)', 'topic'), headingKey('Islam', 'topic'));
});

import { linksAcross, linkKey } from '../src/services/reconcile';

test('an entity linked to one source gets the links that source itself lists (sure, not guessed)', async () => {
  const d = deps();
  const across = await linksAcross({ kind: 'agent', sameAs: [IBN_KHALDUN_LC] }, d.details);
  const got = across.map((a) => a.uri);
  for (const u of ['http://www.wikidata.org/entity/Q9294', 'http://viaf.org/viaf/41841661', 'http://id.worldcat.org/fast/17753']) {
    assert.ok(got.some((g) => linkKey(g) === linkKey(u)), `brings ${u}`);
  }
  assert.ok(!got.some((g) => linkKey(g) === linkKey(IBN_KHALDUN_LC)), 'not its own link again');
  assert.ok(across.every((a) => a.from === IBN_KHALDUN_LC));
  const already = await linksAcross({ kind: 'agent', sameAs: [IBN_KHALDUN_LC, ...got.map((u) => u.replace('http://', 'https://'))] }, d.details);
  assert.equal(already.length, 0, 'links it already has, in another form, are not added again');
  assert.deepEqual(await linksAcross({ kind: 'place', sameAs: [IBN_KHALDUN_LC] }, d.details), [], 'a person\'s record gives a place nothing');
});
