// Phase 10, step 2: the Entities section's form (fields per kind, and what it sends the server).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detailFields, emptyForm, formFrom, formProblems, payloadFrom, hasArabic } from '../src/app/utils/entityForm';

test('each kind and agent type has LC\'s fields', () => {
  assert.deepEqual(detailFields('agent', 'person').map((f) => f.key), ['birthDate', 'deathDate', 'occupation']);
  assert.deepEqual(detailFields('agent', 'meeting').map((f) => f.key), ['date', 'place']);
  assert.deepEqual(detailFields('period').map((f) => f.key), ['start', 'end']);
  assert.deepEqual(detailFields('hub').map((f) => f.key), ['title', 'creator', 'creatorUri', 'language']);
  assert.deepEqual(detailFields('topic').map((f) => f.key), ['source', 'broader', 'narrower']);
});

test('a stored person round-trips through the form; lists become lines and back', () => {
  const stored = {
    id: 'x', kind: 'agent' as const, label: 'الوردي، علي، 1913-1995', variants: ['Wardi, Ali, 1913-1995'],
    sameAs: ['http://id.loc.gov/authorities/names/n81013463'], note: 'Sociologist',
    data: { agentType: 'person', birthDate: '1913', deathDate: '1995', fromMarc: '100' },
  };
  const f = formFrom(stored);
  assert.equal(f.variants, 'Wardi, Ali, 1913-1995');
  assert.equal(f.details.birthDate, '1913');
  const p = payloadFrom(f, stored.data);
  assert.deepEqual(p, {
    kind: 'agent', label: stored.label, variants: stored.variants, sameAs: stored.sameAs, note: 'Sociologist',
    data: { agentType: 'person', birthDate: '1913', deathDate: '1995', fromMarc: '100' },
  });
});

test('changing a person to an organization drops the person\'s dates, keeps other data', () => {
  const f = formFrom({ kind: 'agent', label: 'Dar al-Saqi', data: { agentType: 'person', birthDate: '1913', fromMarc: '110' } });
  f.agentType = 'organization';
  f.details = { place: 'Beirut' };
  assert.deepEqual(payloadFrom(f, { agentType: 'person', birthDate: '1913', fromMarc: '110' }).data, { agentType: 'organization', place: 'Beirut', fromMarc: '110' });
});

test('other forms: blank lines, repeats and the name itself are left out', () => {
  const f = { ...emptyForm('topic'), label: 'Poetry', variants: 'Verse\n\nVerse\nPoetry\n  Poems  ' };
  assert.deepEqual(payloadFrom(f).variants, ['Verse', 'Poems']);
  assert.equal(payloadFrom(f).data.agentType, undefined, 'only agents have a type');
});

test('problems: a name is needed, links must be links', () => {
  assert.deepEqual(formProblems(emptyForm('genre')), ['name']);
  const f = { ...emptyForm('topic'), label: 'Poetry', sameAs: 'not a link', details: { source: 'lcsh', broader: 'https://a\nnope' } };
  assert.deepEqual(formProblems(f), ['same-as', 'source', 'broader']);
  const ok = { ...emptyForm('topic'), label: 'Poetry', sameAs: 'http://id.loc.gov/authorities/subjects/sh85104395', details: { broader: 'https://mooon.site/resource/topic/lit-1' } };
  assert.deepEqual(formProblems(ok), []);
  assert.deepEqual(payloadFrom(ok).data, { broader: ['https://mooon.site/resource/topic/lit-1'] });
});

test('Arabic is recognised for romanizing', () => {
  assert.ok(hasArabic('علي الوردي'));
  assert.ok(!hasArabic('Ali al-Wardi'));
});
