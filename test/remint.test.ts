import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plan, apply, BASE_URI } from '../scripts/remint.mjs';

const rec = {
  '@context': 'http://id.loc.gov/ontologies/bibframe/',
  '@graph': [
    { '@id': 'http://example.org/work/1789642441889', '@type': 'bf:Work',
      'bf:title': { '@id': 'http://moon.local/node/t1', '@type': 'bf:Title', 'bf:mainTitle': 'القبسات' },
      'bf:language': { '@id': 'http://id.loc.gov/vocabulary/languages/ara' },
      'bf:hasInstance': { '@id': 'http://example.org/instance/1789642441889' } },
    { '@id': 'http://example.org/instance/1789642441889', '@type': ['bf:Instance', 'bf:Print'],
      'bf:instanceOf': { '@id': 'http://example.org/work/1789642441889' },
      'bf:carrier': { '@id': 'http://id.loc.gov/vocabulary/carriers/nc' } },
    { '@id': 'http://moon.local/item/x', '@type': 'bf:Item', 'bf:itemOf': { '@id': 'http://example.org/instance/1789642441889' } },
    { '@id': 'http://moon.local/node/t1', '@type': 'bf:Title', 'bf:mainTitle': 'القبسات' },
  ],
};

test('Work, Instance and Item get resolvable URIs; inner placeholders become blank nodes', () => {
  const m = plan('record-1789649846891', rec);
  assert.equal(m.get('http://example.org/work/1789642441889'), `${BASE_URI}/work/record-1789649846891`);
  assert.equal(m.get('http://example.org/instance/1789642441889'), `${BASE_URI}/instance/record-1789649846891`);
  assert.equal(m.get('http://moon.local/item/x'), `${BASE_URI}/item/record-1789649846891-1`);
  assert.equal(m.get('http://moon.local/node/t1'), '_:b1');
  assert.equal(m.has('http://id.loc.gov/vocabulary/languages/ara'), false);
});

test('references change with the ids, LC links are untouched, the input is not modified', () => {
  const before = JSON.stringify(rec);
  const out = apply(rec, plan('r1', rec));
  assert.equal(JSON.stringify(rec), before);
  const [work, inst, item, title] = out['@graph'];
  assert.equal(inst['bf:instanceOf']['@id'], work['@id']);
  assert.equal(work['bf:hasInstance']['@id'], inst['@id']);
  assert.equal(item['bf:itemOf']['@id'], inst['@id']);
  assert.equal(work['bf:title']['@id'], title['@id']);
  assert.equal(inst['bf:carrier']['@id'], 'http://id.loc.gov/vocabulary/carriers/nc');
  assert.equal(work['bf:title']['bf:mainTitle'], 'القبسات');
  assert.equal(out['@context'], rec['@context']);
});

test('a record already under the base URI needs nothing', () => {
  const done = apply(rec, plan('r1', rec));
  assert.equal(plan('r1', done).size, 0);
});

test('a second Work-typed placeholder does not take the same URI', () => {
  const two = { '@graph': [{ '@id': 'http://moon.local/work/a', '@type': 'bf:Work' }, { '@id': 'http://moon.local/work/b', '@type': 'bf:Work' }] };
  const m = plan('r1', two);
  assert.equal(m.get('http://moon.local/work/a'), `${BASE_URI}/work/r1`);
  assert.equal(m.get('http://moon.local/work/b'), '_:b1');
});
