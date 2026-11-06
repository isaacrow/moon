// Entities relate through the records that use them; OPAC visits are counted without keeping who visited.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { relatedFrom, resolveRelated } from '../supabase/functions/server/entityRelations.tsx';
import { visitFrom, visitorKey, isBot, visitDay } from '../supabase/functions/server/opacVisits.tsx';

const IBN_KHALDUN_MOON = 'https://mooon.site/resource/agent/ibn-khaldun';
const IBN_KHALDUN_LC = 'http://id.loc.gov/authorities/names/n50052785';
const TABARI_LC = 'http://id.loc.gov/authorities/names/n80032741';
const HISTORY = 'http://id.loc.gov/authorities/subjects/sh85061212';

const record = (contributors: any[], subjects: any[], publisher?: any, place?: any) => ({
  '@graph': [
    { '@id': 'w', '@type': 'bf:Work', 'bf:contribution': contributors.map((agent) => ({ '@type': 'bf:Contribution', 'bf:agent': agent })), 'bf:subject': subjects },
    { '@id': 'i', '@type': 'bf:Instance', 'bf:provisionActivity': [{ '@type': 'bf:Publication', ...(publisher ? { 'bf:agent': publisher } : {}), ...(place ? { 'bf:place': place } : {}) }] },
  ],
});
const person = (id: string | null, label: string) => ({ ...(id ? { '@id': id } : {}), '@type': ['bf:Agent', 'bf:Person'], 'rdfs:label': label });
const topic = (id: string, label: string) => ({ '@id': id, '@type': 'bf:Topic', 'rdfs:label': label });
const org = (label: string) => ({ '@type': ['bf:Agent', 'bf:Organization'], 'rdfs:label': label });
const place = (label: string) => ({ '@type': 'bf:Place', 'rdfs:label': label });

const records = [
  { id: 'r1', document: record([person(IBN_KHALDUN_LC, 'Ibn Khaldūn'), person(TABARI_LC, 'Ṭabarī')], [topic(HISTORY, 'History')], org('Dar al-Kutub'), place('Beirut')) },
  { id: 'r2', document: record([person(IBN_KHALDUN_MOON, 'ابن خلدون')], [topic(HISTORY, 'History'), topic('http://id.loc.gov/authorities/subjects/sh85068390', 'Islamic philosophy')], org('Dar al-Kutub'), place('Beirut')) },
  { id: 'r3', document: record([person(TABARI_LC, 'Ṭabarī')], [person(IBN_KHALDUN_LC, 'Ibn Khaldūn')]) },
  { id: 'r4', document: record([person(TABARI_LC, 'Ṭabarī')], [topic(HISTORY, 'History')]) },
];

test('an entity\'s relations come from every record that uses it, by Moon or LC address', () => {
  const rel = relatedFrom([IBN_KHALDUN_MOON, IBN_KHALDUN_LC], records);
  const find = (relation: string, label: string) => rel.find((r) => r.relation === relation && r.label === label);
  assert.equal(find('wrote-about', 'History')?.count, 2, 'History, in r1 and r2');
  assert.equal(find('worked-with', 'Ṭabarī')?.count, 1);
  assert.equal(find('written-about-by', 'Ṭabarī')?.count, 1, 'r3 is about Ibn Khaldūn, by Ṭabarī');
  assert.equal(find('published-by', 'Dar al-Kutub')?.count, 2, 'an unlinked publisher is grouped by its name');
  assert.equal(find('published-in', 'Beirut')?.count, 2);
  assert.ok(!rel.some((r) => r.uri === IBN_KHALDUN_LC || r.uri === IBN_KHALDUN_MOON), 'never related to itself');
  assert.equal(rel[0].count, 2, 'most records in common first');
  assert.ok(!rel.some((r) => r.records.includes('r4')), 'a record that does not use it adds nothing');
});

test('publishers are based in the places they publish in; places know their publishers', () => {
  const pubRecords = records.slice(0, 2);
  const linked = pubRecords.map((r) => ({ ...r, document: JSON.parse(JSON.stringify(r.document).replace('"rdfs:label":"Beirut"', '"@id":"http://id.loc.gov/authorities/names/n79018818","rdfs:label":"Beirut"')) }));
  const rel = relatedFrom(['http://id.loc.gov/authorities/names/n79018818'], linked);
  assert.ok(rel.some((r) => r.relation === 'publishers-here' && r.label === 'Dar al-Kutub'));
  assert.ok(rel.some((r) => r.relation === 'published-here' && r.label === 'Ibn Khaldūn'));
});

test('related headings resolve to Moon entities, and an LC and a Moon address of one entity fold together', async () => {
  const rows = relatedFrom([TABARI_LC], records);
  const coauthors = rows.filter((r) => r.relation === 'worked-with');
  assert.equal(coauthors.length, 1, 'only r1 has a co-author');
  const topics = relatedFrom([HISTORY], records).filter((r) => r.relation === 'written-about-by');
  assert.equal(topics.length, 3, 'Ibn Khaldūn by LC, by Moon, and Ṭabarī');
  const resolved = await resolveRelated(topics, async (uri) => (uri === IBN_KHALDUN_LC ? { id: 'ibn-khaldun', label: 'ابن خلدون' } : null));
  const ibn = resolved.find((r) => r.entityId === 'ibn-khaldun');
  assert.equal(resolved.length, 2, 'the two Ibn Khaldūn rows are one');
  assert.equal(ibn?.count, 2);
  assert.equal(ibn?.uri, IBN_KHALDUN_MOON, 'Moon\'s address is kept');
});

test('a visit is checked, and searches are counted however they are typed', () => {
  assert.deepEqual(visitFrom({ kind: 'search', ref: '  Ibn   KHALDUN ' }), { kind: 'search', ref: 'ibn khaldun', path: 'search|ibn khaldun' });
  assert.deepEqual(visitFrom({ kind: 'home', ref: 'anything' }), { kind: 'home', ref: '', path: 'home|' });
  assert.equal(visitFrom({ kind: 'work', ref: '' }), null);
  assert.equal(visitFrom({ kind: 'admin', ref: 'x' }), null);
  assert.equal(visitFrom(null), null);
  assert.equal(visitFrom({ kind: 'work', ref: 'x'.repeat(500) })?.ref.length, 200);
});

test('robots are not counted; a visitor\'s key hides who they are and changes every day', async () => {
  assert.ok(isBot('Mozilla/5.0 (compatible; Googlebot/2.1)'));
  assert.ok(isBot(''));
  assert.ok(!isBot('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1'));
  const a = await visitorKey('1.2.3.4', 'ua', '2026-11-06', 's');
  assert.match(a, /^[0-9a-f]{32}$/);
  assert.ok(!a.includes('1.2.3.4'));
  assert.equal(a, await visitorKey('1.2.3.4', 'ua', '2026-11-06', 's'), 'same reader, same day: one visitor');
  assert.notEqual(a, await visitorKey('1.2.3.4', 'ua', '2026-11-07', 's'), 'next day: a new key');
  assert.equal(visitDay(new Date('2026-11-06T22:30:00Z')), '2026-11-07', 'days are Baghdad days');
});
