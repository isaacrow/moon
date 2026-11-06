// W3C Reconciliation API over the authority file, as OpenRefine calls it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reconcile, manifest, normalizeName, ReconEntry } from '../supabase/functions/server/reconcile.tsx';

const FILE: ReconEntry[] = [
  { id: 'jawahiri', kind: 'agent', label: 'محمد مهدي الجواهري', variants: ['Jawāhirī, Muḥammad Mahdī, 1899-1997'] },
  { id: 'jawahiri-poet-society', kind: 'agent', label: 'جمعية الجواهري الأدبية', variants: [] },
  { id: 'karbala', kind: 'place', label: 'كربلاء', variants: ['Karbalāʼ (Iraq)'] },
  { id: 'poetry', kind: 'topic', label: 'الشعر العربي', variants: ['Arabic poetry'] },
];
const calls: any[] = [];
const search = async (q: string, kind: any, limit: number) => {
  calls.push({ q, kind, limit });
  const n = normalizeName(q);
  return FILE.filter((e) => (!kind || e.kind === kind) && [e.label, ...e.variants].some((v) => normalizeName(v).includes(n.split(' ')[0])));
};

test('the manifest OpenRefine reads first', () => {
  const m = manifest('https://mooon.site/resource');
  assert.deepEqual(m.versions, ['0.2']);
  assert.equal(m.identifierSpace, 'https://mooon.site/resource/');
  assert.equal(m.view.url, 'https://mooon.site/resource/{{id}}', 'a candidate id opens its authority page');
  assert.deepEqual(m.defaultTypes.map((t) => t.id), ['agent', 'place', 'topic']);
});

test('a batch of queries: exact names match, spellings fold, types filter', async () => {
  const out = await reconcile({
    q0: { query: 'محمد مهدى الجواهرى', type: 'agent' },        // ى for ي: the same name
    q1: { query: 'Karbalāʼ (Iraq)', type: 'place', limit: 3 },   // a variant
    q2: { query: 'الجواهري' },                                    // two candidates, no sure match
    q3: { query: '   ' },
  }, search);
  assert.equal(out.q0.result[0].id, 'agent/jawahiri');
  assert.equal(out.q0.result[0].score, 100);
  assert.equal(out.q0.result[0].match, true, 'the only exact match is linked without asking');
  assert.deepEqual(out.q1.result.map((r) => r.id), ['place/karbala']);
  assert.ok(out.q2.result.length >= 2 && out.q2.result.every((r) => r.match === false));
  assert.deepEqual(out.q3.result, []);
  assert.deepEqual(calls.find((c) => c.q === 'Karbalāʼ (Iraq)'), { q: 'Karbalāʼ (Iraq)', kind: 'place', limit: 3 });
});

test('Arabic name normalization', () => {
  assert.equal(normalizeName('أحمد'), normalizeName('احمد'));
  assert.equal(normalizeName('مدرسة'), normalizeName('مدرسه'));
  assert.equal(normalizeName('Jawāhirī'), 'jawahiri');
});
