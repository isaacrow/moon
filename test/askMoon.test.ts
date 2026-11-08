// Phase 13 S15: Ask Moon answers only from Moon's records, cites them, and says when it has nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { askMoon, digest, languageOf, underCap, dayKey, type AskDeps, type AskRecord } from '../supabase/functions/server/askMoon.tsx';

const rec = (id: string, title: string): AskRecord => ({ id, title, url: `https://mooon.site/opac.html?work=${id}`, creator: 'علي الوردي', year: '1955' });

const deps = (over: Partial<AskDeps> = {}): AskDeps => ({
  plan: async () => ({ language: 'ar', queries: ['الوردي', 'مهزلة العقل'], ideal: { titles: [], people: ['علي الوردي'], subjects: [] } }),
  search: async (q) => (q === 'الوردي' ? [rec('a', 'مهزلة العقل البشري'), rec('b', 'وعاظ السلاطين')] : [rec('a', 'مهزلة العقل البشري')]),
  answer: async () => ({ found: true, answer: 'في الفهرس كتابان للوردي [a] و[b]، و[zzz].', cited: ['a', 'b', 'zzz'] }),
  ...over,
});

test('an answer from the records, cited, with how Moon searched; made-up ids dropped', async () => {
  const r = await askMoon('ما كتب علي الوردي؟', deps());
  assert.equal(r.noSource, false);
  assert.deepEqual(r.sources.map((s) => s.id), ['a', 'b']);
  assert.deepEqual(r.searched, ['الوردي', 'مهزلة العقل']);
  assert.ok(!r.answer.includes('[zzz]'));
  assert.ok(r.answer.includes('[a]'));
});

test('no records, or no answer in them: Moon says so and points to the library', async () => {
  const empty = await askMoon('Who won the 1998 World Cup?', deps({ plan: async () => null, search: async () => [] }));
  assert.equal(empty.noSource, true);
  assert.equal(empty.language, 'en');
  assert.match(empty.answer, /librarian/);
  assert.deepEqual(empty.searched, ['Who won the 1998 World Cup?'], 'without a plan, the question itself is searched');
  const notFound = await askMoon('سؤال', deps({ answer: async () => ({ found: false, answer: '', cited: [] }) }));
  assert.equal(notFound.noSource, true);
  const failed = await askMoon('سؤال', deps({ answer: async () => { throw new Error('down'); } }));
  assert.equal(failed.noSource, true, 'a failure is a polite answer');
});

test('helpers', () => {
  assert.equal(languageOf('ما هذا'), 'ar');
  assert.equal(languageOf('what'), 'en');
  assert.match(digest({ ...rec('a', 'T'), subjects: ['x', 'y'], summary: 's' }), /^\[a\] T — by علي الوردي — \(1955\) — subjects: x; y — summary: s$/);
  assert.ok(underCap(199, 200));
  assert.ok(!underCap(200, 200));
  assert.equal(dayKey(new Date('2026-11-08T23:00:00Z')), 'ask-count:2026-11-08');
});

test('a record\'s facts come from its BIBFRAME document', async () => {
  const { askRecordOf } = await import('../supabase/functions/server/askMoon.tsx');
  const r = askRecordOf({ id: 'r1', title: 'مهزلة العقل البشري', document: { '@graph': [
    { '@id': 'w', '@type': 'bf:Work', 'bf:contribution': { 'bf:agent': { 'rdfs:label': 'الوردي، علي' } }, 'bf:subject': [{ 'rdfs:label': 'علم الاجتماع' }],
      'bf:language': { '@id': 'http://id.loc.gov/vocabulary/languages/ara' }, 'bf:summary': { 'rdfs:label': 'نقد' } },
    { '@id': 'i', '@type': 'bf:Instance', 'bf:provisionActivity': { 'bf:date': '1955' } },
  ] } });
  assert.deepEqual(r, { id: 'r1', title: 'مهزلة العقل البشري', url: 'https://mooon.site/opac.html?work=r1', creator: 'الوردي، علي', year: '1955', subjects: ['علم الاجتماع'], summary: 'نقد', language: 'ara' });
});
