// Phase 13 S18, step 2: Moon's own values sit apart from what LC or Wikidata said, so refreshing from the
// source updates and adds what came from it, and never overwrites what a cataloguer typed or changed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { refreshFromSource, layerFrom, originOf, type ImportedLayer } from '../src/services/entityLayers';
import type { EntityForm } from '../src/app/utils/entityForm';

const LC = 'http://id.loc.gov/authorities/names/n50052785';
const WD = 'http://www.wikidata.org/entity/Q9294';
const form = (over: Partial<EntityForm> = {}): EntityForm => ({
  kind: 'agent', agentType: 'person', label: 'ابن خلدون، 1332-1406', variants: '', sameAs: LC, note: '', details: {}, ...over,
});
const layer = (over: Partial<ImportedLayer> = {}): ImportedLayer => ({ at: '2026-11-01T00:00:00Z', label: 'Ibn Khaldūn, 1332-1406', variants: [], details: {}, ...over });

test('a first copy adds the source\'s name and forms and its empty details; Moon\'s own name stays', () => {
  const next = layer({ variants: ['Ibn Khaldoun'], details: { birthDate: '1332', deathDate: '1406' } });
  const r = refreshFromSource(form({ details: { occupation: 'مؤرخ' } }), undefined, next);
  assert.equal(r.form.label, 'ابن خلدون، 1332-1406');
  assert.deepEqual(r.form.variants.split('\n'), ['Ibn Khaldoun', 'Ibn Khaldūn, 1332-1406']);
  assert.deepEqual(r.form.details, { occupation: 'مؤرخ', birthDate: '1332', deathDate: '1406' });
});

test('a refresh updates a value only while it is still the source\'s; an edited value is kept as Moon\'s own', () => {
  const old = layer({ details: { birthDate: '1332', deathDate: '1406', birthPlace: 'Tunis' } });
  const next = layer({ details: { birthDate: '1332-05-27', deathDate: '1406-03-17', birthPlace: 'Tunis (Tunisia)' } });
  // The cataloguer changed the death date; the birth date and place are still the source's.
  const r = refreshFromSource(form({ details: { birthDate: '1332', deathDate: '1406 (808 هـ)', birthPlace: 'Tunis' } }), old, next);
  assert.equal(r.form.details.birthDate, '1332-05-27');
  assert.equal(r.form.details.birthPlace, 'Tunis (Tunisia)');
  assert.equal(r.form.details.deathDate, '1406 (808 هـ)', 'own value never overwritten');
  assert.ok(r.changes.some((c) => c.kind === 'kept-own' && c.field === 'deathDate' && c.was === '1406-03-17'));
});

test('name forms the source dropped go only if it alone gave them; the cataloguer\'s own forms stay', () => {
  const old = layer({ variants: ['Ibn Khaldoun', 'Ibn Haldun'] });
  const next = layer({ variants: ['Ibn Khaldoun'] });
  const wikidata = layer({ label: 'Ibn Khaldun', variants: ['Ibn Haldun'] });
  const current = form({ variants: ['Ibn Khaldoun', 'Ibn Haldun', 'ابن خلدون الحضرمي', 'Ibn Khaldūn, 1332-1406'].join('\n') });
  const alone = refreshFromSource(current, old, next);
  assert.ok(!alone.form.variants.split('\n').includes('Ibn Haldun'), 'dropped by its only source');
  assert.ok(alone.form.variants.split('\n').includes('ابن خلدون الحضرمي'), 'own form kept');
  const shared = refreshFromSource(current, old, next, [wikidata]);
  assert.ok(shared.form.variants.split('\n').includes('Ibn Haldun'), 'Wikidata still gives it');
});

test('a detail the source no longer has is removed only if it was the source\'s', () => {
  const old = layer({ details: { birthPlace: 'Tunis', occupation: 'historian' } });
  const next = layer({ details: {} });
  const r = refreshFromSource(form({ details: { birthPlace: 'Tunis', occupation: 'مؤرخ وقاض' } }), old, next);
  assert.equal(r.form.details.birthPlace, undefined);
  assert.equal(r.form.details.occupation, 'مؤرخ وقاض');
});

test('each value says where it came from', () => {
  const layers = { [LC]: layer({ variants: ['Ibn Khaldoun'], details: { birthDate: '1332' } }), [WD]: layer({ label: 'Ibn Khaldun' }) };
  assert.equal(originOf('variants', 'Ibn Khaldoun', layers), LC);
  assert.equal(originOf('variants', 'Ibn Khaldun', layers), WD);
  assert.equal(originOf('birthDate', '1332', layers), LC);
  assert.equal(originOf('birthDate', '1332-05-27', layers), null, 'changed: Moon\'s own');
  assert.equal(originOf('variants', 'ابن خلدون الحضرمي', layers), null);
});

test('a layer keeps only real values', () => {
  const l = layerFrom({ kind: 'agent', agentType: 'person', label: ' X ', variants: ['a', ' a', ''], sameAs: [], note: '', details: { birthDate: ' 1332 ', x: '' }, data: {}, sources: ['lc'] }, 'T');
  assert.deepEqual(l, { at: 'T', label: 'X', variants: ['a'], details: { birthDate: '1332' } });
});
