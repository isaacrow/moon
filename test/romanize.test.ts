import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findRomanizable, addRomanization, romanizeAll } from '../src/services/romanize';

const work = {
  '@id': 'w',
  'bf:title': { '@type': 'bf:Title', 'bf:mainTitle': 'القبسات', 'bf:subtitle': ['في الحكمة', 'fī al-ḥikmah'] },
  'bf:contribution': [{ 'bf:agent': { 'rdfs:label': 'الميرداماد، محمد باقر' } }],
  'bf:summary': { 'rdfs:label': 'نبذة' },
  'bf:note': { 'bf:noteType': 'x', 'rdfs:comment': 'ملاحظة' },
  'bf:language': { '@id': 'http://id.loc.gov/vocabulary/languages/ara' },
};

test('finds Arabic titles and names that have no Latin partner yet', () => {
  const c = findRomanizable(work, 'work');
  assert.deepEqual(c.map((x) => [x.field, x.arabic]), [
    ['mainTitle', 'القبسات'],
    ['label', 'الميرداماد، محمد باقر'],
  ]);
  assert.deepEqual(c[0].path, ['bf:title', 'bf:mainTitle']);
  assert.deepEqual(c[1].path, ['bf:contribution', 0, 'bf:agent', 'rdfs:label']);
});

test('adds the romanization beside the Arabic value without touching the original', () => {
  const c = findRomanizable(work, 'work');
  const next = addRomanization(work, c[0].path, 'Al-Qabasāt');
  assert.deepEqual(next['bf:title']['bf:mainTitle'], ['القبسات', 'Al-Qabasāt']);
  assert.equal(work['bf:title']['bf:mainTitle'], 'القبسات');
  assert.equal(findRomanizable(next, 'work').some((x) => x.arabic === 'القبسات'), false);
  const inArray = addRomanization({ t: { 'bf:mainTitle': ['أ', 'ب'] } }, ['t', 'bf:mainTitle', 0], 'A');
  assert.deepEqual(inArray.t['bf:mainTitle'], ['أ', 'A', 'ب']);
  assert.deepEqual(addRomanization(work, c[0].path, '  ')['bf:title']['bf:mainTitle'], 'القبسات');
});

test('romanizeAll asks once per distinct text and keeps the order', async () => {
  const calls: string[] = [];
  const orig = globalThis.fetch;
  globalThis.fetch = (async (_u: any, init: any) => {
    const { text } = JSON.parse(init.body);
    calls.push(text);
    return new Response(JSON.stringify({ output: text === 'فشل' ? '' : `R(${text})` }), { status: 200 });
  }) as any;
  try {
    const out = await romanizeAll(['أ', 'ب', 'أ', 'فشل'], 'https://x/trans', {});
    assert.deepEqual(out, ['R(أ)', 'R(ب)', 'R(أ)', '']);
    assert.equal(calls.length, 3);
  } finally {
    globalThis.fetch = orig;
  }
});
