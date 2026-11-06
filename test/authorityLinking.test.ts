// Every name and subject in a saved record ends up linked to an authority.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findUnlinked, linkAuthorities } from '../supabase/functions/server/authorityLinking.tsx';

const record = () => ({
  '@graph': [
    { '@id': 'https://mooon.site/resource/work/r1', '@type': 'bf:Work',
      'bf:contribution': [
        { 'bf:agent': { '@id': 'http://id.loc.gov/authorities/names/n85043844', 'rdfs:label': 'Mīr Dāmād' } },
        { 'bf:agent': { 'rdfs:label': ['Muḥammad al-Jawāhirī', 'محمد مهدي الجواهري'] } },
        { 'bf:agent': 'علي الوردي' },
        { 'bf:agent': { label: 'Old local pick', uri: '', source: 'Local' } },
      ],
      'bf:subject': [
        { '@id': 'http://id.loc.gov/authorities/subjects/sh85068382', 'rdfs:label': 'Islamic philosophy' },
        'الشعر العربي',
        { '@type': 'bf:Place', 'rdfs:label': 'كربلاء' },
        { '@type': 'bf:Person', 'rdfs:label': 'المتنبي' },
        { '@id': 'https://moonlib.org/authority/old', 'rdfs:label': 'Placeholder link' },
      ] },
    { '@id': 'https://mooon.site/resource/instance/r1', '@type': 'bf:Instance',
      'bf:provisionActivity': { '@type': 'bf:Publication',
        'bf:agent': { 'rdfs:label': 'دار الكتب' },
        'bf:place': [{ '@id': 'http://id.loc.gov/vocabulary/countries/iq', 'rdfs:label': 'Baghdad' }, 'النجف'] } },
  ],
});

test('finds every unlinked name, subject, publisher and place, and only those', () => {
  const found = findUnlinked(record()).map((t) => `${t.where}:${t.kind}:${t.label}`);
  assert.deepEqual(found, [
    'contributor:agent:محمد مهدي الجواهري',
    'contributor:agent:علي الوردي',
    'contributor:agent:Old local pick',
    'subject:topic:الشعر العربي',
    'subject:place:كربلاء',
    'subject:agent:المتنبي',
    'subject:topic:Placeholder link',
    'publisher:agent:دار الكتب',
    'place of publication:place:النجف',
  ]);
  const both = findUnlinked(record())[0];
  assert.deepEqual(both.variants, ['Muḥammad al-Jawāhirī'], 'the other script is kept as a variant');
});

test('links them all; the same name twice is one entry; a failing lookup leaves that one unlinked', async () => {
  const doc = record();
  (doc['@graph'][0] as any)['bf:subject'].push('الشعر العربي'); // the same topic again
  const added: string[] = [];
  const n = await linkAuthorities(doc, async ({ kind, label }) => {
    if (label === 'المتنبي') throw new Error('database down');
    added.push(`${kind}:${label}`);
    return { authority: { id: `id${added.length}`, kind } };
  }, (a) => `https://mooon.site/resource/${a.kind}/${a.id}`);
  assert.equal(added.filter((a) => a === 'topic:الشعر العربي').length, 1, 'one lookup for a name used twice');
  assert.equal(n, 9, 'every target but the failed one, including the repeat');
  const work: any = doc['@graph'][0];
  assert.equal(work['bf:contribution'][2]['bf:agent']['@id'], 'https://mooon.site/resource/agent/id2', 'plain text became a linked node');
  assert.equal(work['bf:contribution'][2]['bf:agent']['rdfs:label'], 'علي الوردي');
  assert.equal(work['bf:contribution'][3]['bf:agent'].uri, work['bf:contribution'][3]['bf:agent']['@id'], 'a picked entry gets the address too');
  assert.equal(work['bf:subject'][0]['@id'], 'http://id.loc.gov/authorities/subjects/sh85068382', 'LC links are kept');
  assert.equal(work['bf:subject'][3]['@id'], undefined, 'the failed lookup stays unlinked');
  assert.match(work['bf:subject'][4]['@id'], /mooon\.site\/resource\/topic\//, 'a placeholder link is replaced');
  const inst: any = doc['@graph'][1];
  assert.equal(inst['bf:provisionActivity']['bf:place'][0]['@id'], 'http://id.loc.gov/vocabulary/countries/iq');
  assert.match(inst['bf:provisionActivity']['bf:place'][1]['@id'], /\/place\//);
});
