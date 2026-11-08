// Phase 13 S19: the LC/Wikidata label cache, refreshed from LC's change feed and Wikidata's modified times.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { outsideUris, canonical, parseLc, parseLcFeed, parseWikidata, refreshPlan, refreshLabels, pickLabel, type CachedLabels } from '../supabase/functions/server/labelCache.tsx';

const TWAIN = 'http://id.loc.gov/authorities/names/n79021164';
const lcJson = [{ '@id': TWAIN, 'http://www.loc.gov/mads/rdf/v1#authoritativeLabel': [
  { '@value': 'Twain, Mark, 1835-1910' }, { '@language': 'und-arab', '@value': 'تواين، مارک' }, { '@value': 'Twain, Mark, 1835-1910' },
] }];

test('addresses: LC and Wikidata only, one form each', () => {
  assert.deepEqual(outsideUris([{ a: 'https://id.loc.gov/authorities/names/n79021164', b: ['https://www.wikidata.org/wiki/Q7245', 'http://viaf.org/viaf/1'], c: 'http://www.wikidata.org/entity/Q7245' }]),
    [TWAIN, 'http://www.wikidata.org/entity/Q7245']);
  assert.equal(canonical('https://id.loc.gov/authorities/subjects/sh85006506/'), 'http://id.loc.gov/authorities/subjects/sh85006506');
});

test('LC labels in every script, once each', () => {
  assert.deepEqual(parseLc(lcJson, TWAIN), [{ value: 'Twain, Mark, 1835-1910' }, { value: 'تواين، مارک', lang: 'und-arab' }]);
  assert.equal(pickLabel(parseLc(lcJson, TWAIN), 'ar'), 'تواين، مارک');
  assert.equal(pickLabel(parseLc(lcJson, TWAIN), 'en'), 'Twain, Mark, 1835-1910');
});

test('LC change feed: what changed since the last run, and whether to read on', () => {
  const page = { next: 'http://id.loc.gov/authorities/names/activitystreams/feed/2', orderedItems: [
    { published: '2026-11-08', object: { id: TWAIN } },
    { published: '2026-11-01', object: { id: 'http://id.loc.gov/authorities/names/n1' } },
  ] };
  const r = parseLcFeed(page, '2026-11-05T00:00:00Z');
  assert.deepEqual([...r.changed.keys()], [TWAIN]);
  assert.equal(r.more, false, 'an older item means the rest is older too');
  assert.equal(parseLcFeed({ ...page, orderedItems: [page.orderedItems[0]] }, '2026-11-05').more, true);
});

test('Wikidata labels and modified times; a deleted item is marked', () => {
  const m = parseWikidata({ entities: { Q7245: { modified: '2026-11-07T10:00:00Z', labels: { ar: { language: 'ar', value: 'مارك توين' } } }, Q9: { id: 'Q9', missing: '' } } });
  assert.deepEqual(m.get('Q7245'), { labels: [{ value: 'مارك توين', lang: 'ar' }], modified: '2026-11-07T10:00:00Z' });
  assert.equal(m.get('Q9')?.missing, true);
});

test('the plan: new, changed at LC, or 30 days old', () => {
  const now = new Date('2026-11-08T12:00:00Z');
  const cached = new Map<string, CachedLabels>([
    [TWAIN, { uri: TWAIN, source: 'lc', labels: [], fetchedAt: '2026-11-01T00:00:00Z' }],
    ['http://id.loc.gov/authorities/names/n2', { uri: 'http://id.loc.gov/authorities/names/n2', source: 'lc', labels: [], fetchedAt: '2026-11-07T00:00:00Z' }],
    ['http://id.loc.gov/authorities/names/n3', { uri: 'http://id.loc.gov/authorities/names/n3', source: 'lc', labels: [], fetchedAt: '2026-09-01T00:00:00Z' }],
  ]);
  const uris = [TWAIN, 'http://id.loc.gov/authorities/names/n2', 'http://id.loc.gov/authorities/names/n3', 'http://id.loc.gov/authorities/names/n4'];
  assert.deepEqual(refreshPlan(uris, cached, new Map([[TWAIN, '2026-11-08']]), now).sort(),
    [TWAIN, 'http://id.loc.gov/authorities/names/n3', 'http://id.loc.gov/authorities/names/n4'].sort());
});

test('a whole run with a fake LC and Wikidata', async () => {
  const asked: string[] = [];
  const fetchJson = async (url: string) => {
    asked.push(url);
    if (url.includes('activitystreams')) return { orderedItems: [{ published: '2026-11-08', object: { id: TWAIN } }] };
    if (url === `${TWAIN}.json`) return lcJson;
    if (url.includes('wikidata') && url.includes('props=info&')) return { entities: { Q7245: { modified: '2026-11-08T00:00:00Z' } } };
    if (url.includes('wikidata')) return { entities: { Q7245: { modified: '2026-11-08T00:00:00Z', labels: { en: { language: 'en', value: 'Mark Twain' } } } } };
    return null;
  };
  const cached = new Map<string, CachedLabels>([['http://www.wikidata.org/entity/Q7245', { uri: 'http://www.wikidata.org/entity/Q7245', source: 'wikidata', labels: [], fetchedAt: '2026-11-07T00:00:00Z', sourceModified: '2026-11-01T00:00:00Z' }]]);
  const r = await refreshLabels([TWAIN, 'http://www.wikidata.org/entity/Q7245'], cached, { fetchJson, now: new Date('2026-11-08T12:00:00Z'), since: '2026-11-07T00:00:00Z' });
  assert.equal(r.wikidataChanged, 1);
  assert.deepEqual(r.rows.map((x) => [x.uri, x.labels[0]?.value]), [[TWAIN, 'Twain, Mark, 1835-1910'], ['http://www.wikidata.org/entity/Q7245', 'Mark Twain']]);
  assert.ok(asked.some((u) => u.includes('/names/activitystreams/feed/1.json')));
});
