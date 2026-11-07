// Phase 13 S18: field templates have an owner and a version. Only the owner or the Super Admin changes or
// removes one; a save from an older copy never undoes a newer change; a template someone else added is
// never removed by a save that did not know it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyTemplateSave, type Template } from '../supabase/functions/server/templatePolicy.tsx';

const NOW = '2026-11-07T12:00:00Z';
const mara = { username: 'mara', admin: false };
const ali = { username: 'ali', admin: false };
const isaac = { username: 'isaac', admin: true };
const base: Template[] = [{ id: 't1', name: 'Arabic book', fields: ['title'], owner: 'mara', version: 2 }];

test('a new template belongs to whoever saved it, version 1', () => {
  const r = applyTemplateSave(base, [...base, { id: 't2', name: 'Thesis', fields: ['dissertation'] }], ['t1'], ali, NOW);
  const t2 = r.templates.find((t) => t.id === 't2')!;
  assert.deepEqual([t2.owner, t2.version, t2.updatedBy], ['ali', 1, 'ali']);
  assert.deepEqual(r.refused, []);
});

test('the owner changes it: next version, the earlier one kept; someone else is refused', () => {
  const changed = [{ ...base[0], fields: ['title', 'extent'] }];
  const mine = applyTemplateSave(base, changed, ['t1'], mara, NOW);
  assert.equal(mine.templates[0].version, 3);
  assert.equal(mine.templates[0].owner, 'mara');
  assert.deepEqual(mine.previous.map((t) => t.version), [2]);
  const theirs = applyTemplateSave(base, changed, ['t1'], ali, NOW);
  assert.deepEqual(theirs.templates, base, 'unchanged');
  assert.deepEqual(theirs.refused, [{ id: 't1', name: 'Arabic book', reason: 'not-owner' }]);
  assert.equal(applyTemplateSave(base, changed, ['t1'], isaac, NOW).templates[0].version, 3, 'the Super Admin may');
});

test('a save from an older copy does not undo a newer change', () => {
  const r = applyTemplateSave(base, [{ ...base[0], fields: ['old'], version: 1 }], ['t1'], mara, NOW);
  assert.deepEqual(r.templates, base);
  assert.equal(r.refused[0].reason, 'stale');
});

test('an unchanged template stays as it is (same version)', () => {
  const r = applyTemplateSave(base, [{ ...base[0] }], ['t1'], ali, NOW);
  assert.deepEqual(r.templates, base);
  assert.deepEqual(r.refused, []);
});

test('removing: only a template the saver knew and may change; another\'s new template survives', () => {
  const stored: Template[] = [...base, { id: 't3', name: 'Added meanwhile', owner: 'ali', version: 1 }];
  const removed = applyTemplateSave(stored, [], ['t1'], mara, NOW);
  assert.deepEqual(removed.templates.map((t) => t.id), ['t3'], 'mara removed her own; ali\'s new one stays');
  const notHers = applyTemplateSave(stored, [base[0]], ['t1', 't3'], mara, NOW);
  assert.deepEqual(notHers.templates.map((t) => t.id).sort(), ['t1', 't3']);
  assert.equal(notHers.refused[0].reason, 'not-owner');
});

test('templates from before owners existed may be changed by anyone signed in, and get an owner then', () => {
  const legacy: Template[] = [{ id: 'old', name: 'Legacy', fields: [] }];
  const r = applyTemplateSave(legacy, [{ id: 'old', name: 'Legacy', fields: ['title'] }], ['old'], ali, NOW);
  assert.deepEqual([r.templates[0].owner, r.templates[0].version], ['ali', 2]);
});
