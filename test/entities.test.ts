// Phase 10: a Moon entity described in LC's two parts (the thing, and its MADS authority data).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { entityNodes, entityClass, madsClass, agentTypeOf, isEntityKind, entityPageParams, ENTITY_KINDS } from '../supabase/functions/server/entityDocument.tsx';

const BASE = 'https://mooon.site/resource';

test('every kind and agent type gets LC\'s BIBFRAME and MADS classes', () => {
  assert.deepEqual([...ENTITY_KINDS], ['agent', 'place', 'topic', 'hub', 'genre', 'period']);
  const agents: Array<[string, string, string]> = [
    ['person', 'bf:Person', 'madsrdf:PersonalName'],
    ['family', 'bf:Family', 'madsrdf:FamilyName'],
    ['organization', 'bf:Organization', 'madsrdf:CorporateName'],
    ['meeting', 'bf:Meeting', 'madsrdf:ConferenceName'],
    ['jurisdiction', 'bf:Jurisdiction', 'madsrdf:Geographic'],
  ];
  for (const [t, bf, mads] of agents) {
    assert.equal(entityClass('agent', { agentType: t }), bf);
    assert.equal(madsClass('agent', { agentType: t }), mads);
  }
  assert.equal(agentTypeOf({}), 'person', 'an agent with no type is a person');
  assert.equal(agentTypeOf({ agentType: 'robot' }), 'person');
  assert.equal(entityClass('genre'), 'bf:GenreForm');
  assert.equal(entityClass('period'), 'bf:Temporal');
  assert.equal(madsClass('hub'), 'madsrdf:NameTitle');
  assert.ok(isEntityKind('period') && !isEntityKind('work'));
});

test('a person: the thing at its address, the MADS authority at #authority, linked both ways', () => {
  const [thing, auth] = entityNodes({
    id: 'ali-al-wardi-3f9a1c2e', kind: 'agent', label: 'الوردي، علي، 1913-1995',
    variants: ['Wardi, Ali, 1913-1995'], sameAs: ['http://id.loc.gov/authorities/names/n80000001'],
    note: 'Iraqi sociologist', data: { agentType: 'person', birthDate: '1913', deathDate: '1995' },
  }, BASE);
  const uri = `${BASE}/agent/ali-al-wardi-3f9a1c2e`;
  assert.equal(thing['@id'], uri);
  assert.deepEqual(thing['@type'], ['bf:Person']);
  assert.equal(thing['madsrdf:birthDate'], '1913');
  assert.deepEqual(thing['madsrdf:isIdentifiedByAuthority'], { '@id': `${uri}#authority` });
  assert.equal(auth['@id'], `${uri}#authority`);
  assert.deepEqual(auth['@type'], ['madsrdf:Authority', 'madsrdf:PersonalName']);
  assert.equal(auth['madsrdf:authoritativeLabel'], 'الوردي، علي، 1913-1995');
  assert.deepEqual(auth['madsrdf:identifiesRWO'], { '@id': uri });
  assert.deepEqual(auth['madsrdf:hasVariant'], [{ '@type': ['madsrdf:Variant', 'madsrdf:PersonalName'], 'madsrdf:variantLabel': 'Wardi, Ali, 1913-1995' }]);
  assert.deepEqual(auth['madsrdf:hasExactExternalAuthority'], [{ '@id': 'http://id.loc.gov/authorities/names/n80000001' }]);
  assert.equal(auth['madsrdf:editorialNote'], 'Iraqi sociologist');
});

test('a period carries its date range as EDTF; a genre its source vocabulary', () => {
  const [period] = entityNodes({ id: 'abbasid-1a2b3c4d', kind: 'period', label: 'Abbasid period', variants: [], sameAs: [], data: { start: '750', end: '1258' } }, BASE);
  assert.deepEqual(period['@type'], ['bf:Temporal']);
  assert.deepEqual(period['bf:date'], { '@value': '750/1258', '@type': 'http://id.loc.gov/datatypes/edtf/EDTF' });
  const [genre] = entityNodes({ id: 'novels-1a2b3c4d', kind: 'genre', label: 'Novels', variants: [], sameAs: [], data: { source: 'http://id.loc.gov/vocabulary/genreFormSchemes/lcgft' } }, BASE);
  assert.deepEqual(genre['bf:source'], { '@id': 'http://id.loc.gov/vocabulary/genreFormSchemes/lcgft' });
});

test('a hub keeps its access point, title, creator and expressions', () => {
  const [hub, auth] = entityNodes({
    id: 'muqaddima-1a2b3c4d', kind: 'hub', label: 'Ibn Khaldūn, 1332-1406. Muqaddimah', variants: [], sameAs: [],
    data: { title: 'Muqaddimah', creator: 'Ibn Khaldūn, 1332-1406' },
  }, BASE, ['https://mooon.site/resource/work/w1']);
  assert.equal(hub['bflc:aap'], 'Ibn Khaldūn, 1332-1406. Muqaddimah');
  assert.equal(hub['bf:title']['bf:mainTitle'], 'Muqaddimah');
  assert.equal(hub['bf:contribution']['bf:agent']['rdfs:label'], 'Ibn Khaldūn, 1332-1406');
  assert.deepEqual(hub['bf:hasExpression'], [{ '@id': 'https://mooon.site/resource/work/w1' }]);
  assert.deepEqual(auth['@type'], ['madsrdf:Authority', 'madsrdf:NameTitle']);
});

test('an entity address in a browser goes to its OPAC page, or a search for kinds without one', () => {
  assert.deepEqual(entityPageParams('agent', 'Ali', 'u'), ['person', 'Ali']);
  assert.deepEqual(entityPageParams('hub', 'H', 'https://x/hub/1'), ['hub', 'https://x/hub/1']);
  assert.deepEqual(entityPageParams('genre', 'Novels', 'u'), ['q', 'Novels']);
});
