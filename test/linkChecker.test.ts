// Phase 13 S16: suspect links to LC / VIAF / Wikidata are reported, never blocked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nameWords, namesAgree, checkLinks, type CheckEntity, type CachedName } from '../supabase/functions/server/linkChecker.tsx';
import { canonical } from '../supabase/functions/server/labelCache.tsx';

test('name words and agreement, script by script', () => {
  assert.deepEqual(nameWords('الوردي، علي، 1913-1995'), ['وردي']);
  assert.deepEqual(nameWords('Ibn Khaldūn, ʻAbd al-Raḥmān'), ['khaldun', 'rahman']);
  assert.equal(namesAgree(['علي الوردي', 'Wardi, Ali'], ['علي الوردي']), true);
  assert.equal(namesAgree(['Ali Abunimah'], ['علي أبو نعمة']), null, 'different scripts are not judged');
  assert.equal(namesAgree(['Wardi, Ali'], ['Ali Shariati']), false);
});

test('the report: gone, shared links, name mismatches', () => {
  const W = 'http://www.wikidata.org/entity/Q1';
  const L = 'http://id.loc.gov/authorities/names/n1';
  const entities: CheckEntity[] = [
    { id: 'wardi', kind: 'agent', label: 'الوردي، علي', variants: ['Wardi, Ali'], sameAs: ['https://www.wikidata.org/wiki/Q1', L] },
    { id: 'other', kind: 'agent', label: 'علي شريعتي', variants: [], sameAs: [W] },
    { id: 'gone', kind: 'agent', label: 'X', variants: [], sameAs: ['http://id.loc.gov/authorities/names/n9'] },
  ];
  const cache = new Map<string, CachedName>([
    [W, { uri: W, source: 'wikidata', labels: [{ value: 'علي الوردي', lang: 'ar' }, { value: 'Ali al-Wardi', lang: 'en' }] }],
    [L, { uri: L, source: 'lc', labels: [{ value: 'Shariati, Ali, 1933-1977' }] }],
    ['http://id.loc.gov/authorities/names/n9', { uri: 'http://id.loc.gov/authorities/names/n9', source: 'lc', labels: [], missing: true }],
  ]);
  const issues = checkLinks(entities, cache, canonical);
  assert.deepEqual(issues.map((i) => [i.kind, i.entityId]), [
    ['gone', 'gone'],
    ['shared-link', 'wardi'], ['shared-link', 'other'],
    ['name-mismatch', 'wardi'], ['name-mismatch', 'other'],
  ].sort((a, b) => 0) as any);
  const mismatch = issues.find((i) => i.kind === 'name-mismatch' && i.entityId === 'wardi')!;
  assert.equal(mismatch.uri, L);
  assert.match(mismatch.detail, /LC calls it: Shariati/);
});
