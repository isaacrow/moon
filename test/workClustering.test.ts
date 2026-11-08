// Phase 13 S11: Work clustering, Arabic-aware: normalise, gate, score, resolve, with evidence and a
// cataloguer's decisions that always win.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { titleKey, gateOf, scorePair, clusterPipeline, type ClusterWork } from '../src/services/workClustering';

const w = (id: string, title: string, name?: string, more: Partial<ClusterWork> = {}): ClusterWork =>
  ({ id, title, ...(name ? { primaryCreator: { name } } : {}), ...more });
const ids = (groups: { members: ClusterWork[] }[]) => groups.map((g) => g.members.map((m) => m.id));

test('titles compare without the article on each word, diacritics, hamza or subtitle', () => {
  assert.equal(titleKey('المقدّمة'), titleKey('مقدمة'));
  assert.equal(titleKey('تاريخ الأدب العربي : الجزء الأول'), titleKey('تاريخ ادب عربي'));
  assert.equal(titleKey('Al-Muqaddimah'), titleKey('Muqaddimah'));
  assert.equal(titleKey('The Prophet'), titleKey('Prophet'));
  assert.notEqual(titleKey('الأم'), titleKey('الأمة'));
});

test('the same title by the same person, written two ways, is one Work', () => {
  const a = w('a', 'كتاب العبر', 'ابن خلدون، عبد الرحمن بن محمد، 1332-1406');
  const b = w('b', 'العبر', 'عبد الرحمن بن محمد بن خلدون');
  const c = w('c', 'كتاب العبر', 'د. ابن خلدون، عبد الرحمن بن محمد');
  const p = scorePair(a, c);
  assert.equal(p.verdict, 'same');
  assert.ok(p.evidence.includes('Same title') && p.evidence.some((e) => e.startsWith('Same creator')));
  assert.equal(scorePair(a, b).verdict, 'different', 'a different title is not joined on the name alone');
});

test('a different creator keeps two books of one title apart; no creator is never enough', () => {
  assert.equal(scorePair(w('a', 'ديوان', 'المتنبي'), w('b', 'ديوان', 'أبو تمام')).verdict, 'different');
  const none = scorePair(w('a', 'ديوان'), w('b', 'ديوان'));
  assert.equal(none.verdict, 'unsure');
  assert.ok(none.evidence.includes('Neither record names a creator'));
});

test('manuscripts, generic serials and travel guides are never joined automatically', () => {
  const ms = (id: string) => w(id, 'شرح الألفية', 'ابن عقيل', { instances: [{ carrierType: 'Manuscript' }] });
  assert.equal(gateOf(ms('x')), 'manuscript');
  const p = scorePair(ms('x'), ms('y'));
  assert.equal(p.verdict, 'unsure');
  assert.equal(p.gate, 'manuscript');
  const serial = (id: string) => w(id, 'مجلة', 'جامعة بغداد', { instances: [{ issuance: 'serial' }] });
  assert.equal(gateOf(serial('s')), 'generic-serial');
  assert.equal(gateOf(w('g', 'Iraq', 'Lonely Planet', { genreForm: ['Guidebooks'] })), 'travel-guide');
  assert.equal(gateOf(w('b', 'مجلة', 'جامعة بغداد')), undefined, 'a book called مجلة is not a serial');
});

test('a hub or a translation link joins records whose titles differ', () => {
  const ar = w('ar', 'ألف ليلة وليلة', undefined, { expressionOfHub: { uri: 'h:1001', label: 'Alf layla' } });
  const en = w('en', 'The Arabian Nights', undefined, { expressionOfHub: { uri: 'h:1001' } });
  const tr = w('tr', 'Les Mille et une nuits', undefined, { relatedWorks: [{ predicate: 'bf:translationOf', targetUri: 'https://mooon.site/resource/work/ar' }] });
  const { groups } = clusterPipeline([ar, en, tr]);
  assert.deepEqual(ids(groups), [['ar', 'en', 'tr']]);
  assert.ok(groups[0].evidence.some((e) => e.startsWith('Same hub')));
  assert.equal(groups[0].confidence, 1);
});

test('a cataloguer can take a group apart and join what Moon was unsure of', () => {
  const works = [w('a', 'المقدمة', 'ابن خلدون'), w('b', 'مقدمة', 'ابن خلدون'), w('c', 'ديوان'), w('d', 'ديوان')];
  const auto = clusterPipeline(works);
  assert.deepEqual(ids(auto.groups), [['a', 'b'], ['c'], ['d']]);
  assert.deepEqual(auto.unsure.map((p) => [p.a, p.b]), [['c', 'd']], 'the unsure pair waits for review');
  const decided = clusterPipeline(works, [
    { a: 'a', b: 'b', verdict: 'different' },
    { a: 'd', b: 'c', verdict: 'same', by: 'ali' },
  ]);
  assert.deepEqual(ids(decided.groups), [['a'], ['b'], ['c', 'd']]);
  assert.ok(decided.groups[2].evidence.includes('Joined by a cataloguer (ali)'));
  assert.deepEqual(decided.unsure, [], 'decided pairs leave the queue');
});

test('a "different" decision also stops a join through a third record', () => {
  const works = [w('a', 'المقدمة', 'ابن خلدون'), w('b', 'مقدمة', 'ابن خلدون'), w('c', 'The Muqaddimah', 'Ibn Khaldūn', {
    relatedWorks: [{ predicate: 'bf:translationOf', targetUri: 'work/a' }, { predicate: 'bf:translationOf', targetUri: 'work/b' }],
  })];
  const { groups } = clusterPipeline(works, [{ a: 'a', b: 'b', verdict: 'different' }]);
  assert.equal(groups.length, 2);
  assert.ok(!groups.some((g) => g.members.some((m) => m.id === 'a') && g.members.some((m) => m.id === 'b')));
});

test('decisions are stored one per pair, newest wins, and can be cleared', async () => {
  const { applyDecision, parseDecisions } = await import('../supabase/functions/server/workDecisions.tsx');
  let r = applyDecision([], { a: 'x1', b: 'x2', verdict: 'same' }, 'ali', 't1');
  r = applyDecision(r.list, { a: 'x2', b: 'x1', verdict: 'different' }, 'sara', 't2');
  assert.deepEqual(r.list, [{ a: 'x2', b: 'x1', verdict: 'different', by: 'sara', at: 't2' }]);
  assert.deepEqual(applyDecision(r.list, { a: 'x1', b: 'x2', verdict: 'clear' }, 'ali', 't3').list, []);
  assert.ok(applyDecision([], { a: 'x', b: 'x', verdict: 'same' }, 'ali', 't').error);
  assert.ok(applyDecision([], { a: 'x', b: '<script>', verdict: 'same' }, 'ali', 't').error);
  assert.deepEqual(parseDecisions('[{"a":"p","b":"q","verdict":"maybe"}]'), []);
});
