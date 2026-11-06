// Phase 10, step 4: linking while cataloguing. Pickers offer Moon's entities first, with an outside result for
// the same thing folded into Moon's entity; every LC-, VIAF- or Wikidata-linked heading a saved record uses
// gets its Moon entity, without the record changing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { foldMoonTwins, linkKey, type AuthorityResult } from '../src/services/authoritySearch';
import { findOutsideLinked, mirrorOutsideLinked, findUnlinked } from '../supabase/functions/server/authorityLinking.tsx';

const LC = 'http://id.loc.gov/authorities/names/n50052785';

test('link spellings compare as the server compares them', () => {
  assert.equal(linkKey('HTTPS://www.wikidata.org/wiki/Q9294/'), linkKey('http://www.wikidata.org/entity/Q9294'));
  assert.equal(linkKey('https://id.loc.gov/authorities/names/n50052785'), linkKey(LC));
  assert.notEqual(linkKey(LC), linkKey('http://id.loc.gov/authorities/names/n50052786'));
});

test('an LC or Wikidata result for something Moon already has folds into Moon\'s entity', () => {
  const results: AuthorityResult[] = [
    { label: 'ابن خلدون', uri: 'https://mooon.site/resource/agent/ibn-khaldun', source: 'Moon', sameAs: [LC, 'http://www.wikidata.org/entity/Q9294'] },
    { label: 'Ibn Khaldūn, 1332-1406', uri: 'https://id.loc.gov/authorities/names/n50052785', source: 'LOC' },
    { label: 'Ibn Khaldun', uri: 'http://www.wikidata.org/entity/Q9294', source: 'Wikidata' },
    { label: 'Ibn Khaldūn, Yaḥyá ibn Muḥammad', uri: 'http://id.loc.gov/authorities/names/nr92029268', source: 'LOC' },
  ];
  assert.deepEqual(foldMoonTwins(results).map((r) => r.source), ['Moon', 'LOC'], 'the brother, a different person, stays');
  assert.equal(foldMoonTwins(results)[1].uri, 'http://id.loc.gov/authorities/names/nr92029268');
});

const record = () => ({
  '@graph': [
    {
      '@id': 'https://mooon.site/resource/work/w1', '@type': 'bf:Work',
      'bf:contribution': [
        { '@type': 'bf:Contribution', 'bf:agent': { '@id': LC, '@type': 'bf:Person', 'rdfs:label': 'Ibn Khaldūn, 1332-1406' } },
        { '@type': 'bf:Contribution', 'bf:agent': { '@type': 'bf:Person', 'rdfs:label': 'محمد علي' } },
        { '@type': 'bf:Contribution', 'bf:agent': { '@id': 'https://mooon.site/resource/agent/x', 'rdfs:label': 'Already Moon' } },
      ],
      'bf:subject': [
        { '@id': 'http://id.loc.gov/authorities/subjects/sh85100934', '@type': 'bf:Topic', 'rdfs:label': 'Islamic philosophy' },
        { '@id': 'http://id.loc.gov/vocabulary/countries/iq', '@type': 'bf:Place', 'rdfs:label': 'Iraq' },
      ],
    },
    {
      '@id': 'https://mooon.site/resource/instance/i1', '@type': 'bf:Instance',
      'bf:provisionActivity': [{
        '@type': 'bf:Publication',
        'bf:agent': { '@id': 'http://www.wikidata.org/entity/Q7210404', 'rdfs:label': 'Penguin Books' },
        'bf:place': { '@id': 'http://id.loc.gov/authorities/names/n80006292', 'rdfs:label': ['Baghdad (Iraq)', 'بغداد (عراق)'] },
      }],
    },
  ],
});

test('outside-linked headings are found with their kind, role and LC link; others are not', () => {
  const found = findOutsideLinked(record());
  assert.deepEqual(found.map((t) => [t.kind, t.where, t.sameAs[0]]), [
    ['agent', 'contributor', LC],
    ['topic', 'subject', 'http://id.loc.gov/authorities/subjects/sh85100934'],
    ['agent', 'publisher', 'http://www.wikidata.org/entity/Q7210404'],
    ['place', 'place of publication', 'http://id.loc.gov/authorities/names/n80006292'],
  ]);
  assert.equal(found[2].data.agentType, 'organization', 'a publisher is an organization');
  assert.equal(found[3].label, 'بغداد (عراق)', 'Arabic script leads, as for plain-text headings');
  assert.deepEqual(found[3].variants, ['Baghdad (Iraq)']);
  // An LC vocabulary (countries) is not an authority file entities link to; plain text is the other linker's job.
  assert.ok(!found.some((t) => t.label === 'Iraq' || t.label === 'محمد علي' || t.label === 'Already Moon'));
});

test('mirroring makes one entity per link, never changes the record, and survives a failing store', async () => {
  const doc = record();
  const before = JSON.stringify(doc);
  const added: any[] = [];
  let calls = 0;
  const n = await mirrorOutsideLinked(doc, async (input) => {
    calls++;
    if (input.kind === 'topic') throw new Error('database down');
    added.push(input);
    return {};
  });
  assert.equal(JSON.stringify(doc), before, 'the record is unchanged');
  assert.equal(calls, 4);
  assert.equal(n, 3, 'the failing one is skipped, the save goes on');
  assert.deepEqual(added.map((a) => a.sameAs), [[LC], ['http://www.wikidata.org/entity/Q7210404'], ['http://id.loc.gov/authorities/names/n80006292']]);
  // The same LC person twice in a record is one lookup.
  const twice = record();
  (twice['@graph'][0] as any)['bf:contribution'].push({ 'bf:agent': { '@id': LC, 'rdfs:label': 'Ibn Khaldun' } });
  let lookups = 0;
  await mirrorOutsideLinked(twice, async (i) => { if (i.sameAs[0] === LC) lookups++; return {}; });
  assert.equal(lookups, 1);
});

test('plain-text names are still the plain-text linker\'s, and outside-linked ones only the mirror\'s', () => {
  const unlinked = findUnlinked(record()).map((t) => t.label);
  assert.ok(unlinked.includes('محمد علي'));
  assert.ok(!unlinked.includes('Ibn Khaldūn, 1332-1406'));
});
