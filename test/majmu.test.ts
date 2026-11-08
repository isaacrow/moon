// Phase 13 S12: a majmūʿ (one volume, several works) as bf:hasPart, through the editor, MARC and the OPAC.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { containedWorks, withContainedWorks, compilerOf, withCompiler } from '../src/services/majmu';
import { bibframeToMarc } from '../src/services/marc/bibframeToMarc';

const parts = [
  { title: 'رسالة في التوحيد', creator: 'الغزالي', locator: 'ق 1-20' },
  { title: 'الرسالة القشيرية', creator: 'القشيري', creatorUri: 'https://mooon.site/resource/agent/qushayri' },
  { title: 'منظومة في الفرائض' },
];

test('contained works go in and come back out', () => {
  const work = withCompiler(withContainedWorks({ '@type': 'bf:Work', 'bf:contribution': [{ 'bf:agent': { 'rdfs:label': 'x' } }] }, parts), 'محمد بن علي');
  assert.equal(work['bf:hasPart'].length, 3);
  assert.deepEqual(containedWorks(work), parts);
  assert.equal(compilerOf(work), 'محمد بن علي');
  assert.equal(work['bf:contribution'].length, 2, 'the other contributions stay');
  assert.equal(compilerOf(withCompiler(work, '')), '');
  assert.ok(!('bf:hasPart' in withContainedWorks(work, [])));
  assert.deepEqual(containedWorks({ 'bf:hasPart': 'Kitāb' }), [{ title: 'Kitāb' }], 'a plain title counts too');
});

test('MARC export names each contained work', () => {
  const doc = { '@graph': [
    withContainedWorks({ '@id': 'w', '@type': 'bf:Work', 'bf:title': { 'bf:mainTitle': 'مجموع' } }, parts),
    { '@id': 'i', '@type': 'bf:Instance', 'bf:instanceOf': { '@id': 'w' }, 'bf:title': { '@type': 'bf:Title', 'bf:mainTitle': 'مجموع' } },
  ] };
  const marc = bibframeToMarc(doc as any, { recordId: 'm1' });
  const titles = marc.fields.filter((f: any) => /^7[0-4]\d$/.test(f.tag)).map((f: any) => f.subfields.filter(([c]: any) => c === 't' || (f.tag === '740' && c === 'a')).map(([, v]: any) => v).join(''));
  for (const p of parts) assert.ok(titles.some((t: string) => t.includes(p.title)), `${p.title} in ${JSON.stringify(titles)}`);
});
