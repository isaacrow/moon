// Phase 13 S18, step 1: each outside link on an entity says where it came from, in both languages; a
// machine match shows its confidence and who accepted it; links from before have no source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeLinkSource, sourcesByLink, type LinkSource } from '../src/app/utils/linkSource';

const at = '2026-11-07T20:00:00Z';
const LC = 'http://id.loc.gov/authorities/names/n50052785';
const WD = 'http://www.wikidata.org/entity/Q9294';

test('a machine match says so, with its confidence and who accepted it', () => {
  const s: LinkSource = { uri: LC, addedBy: 'isaac', addedAt: at, method: 'reconcile', confidence: 0.98, evidence: 'same name, same dates' };
  assert.equal(describeLinkSource(s, false), 'Moon match 98% · accepted by isaac · 7 Nov 2026');
  assert.match(describeLinkSource(s, true), /^مطابقة مون 98% · قبلها isaac · /);
});

test('a person, an import report and a record', () => {
  assert.equal(describeLinkSource({ uri: WD, addedBy: 'mara', addedAt: at, method: 'person' }, false), 'Added by mara · 7 Nov 2026');
  assert.equal(describeLinkSource({ uri: WD, addedBy: 'mara', addedAt: at, method: 'import' }, false), 'From an import report · mara · 7 Nov 2026');
  assert.equal(describeLinkSource({ uri: WD, addedBy: 'mara', addedAt: at, method: 'record' }, false), 'From a record · mara · 7 Nov 2026');
});

test('each link gets its source; one added before sources were kept has none', () => {
  const out = sourcesByLink([LC, WD], [{ uri: WD, addedBy: 'mara', addedAt: at, method: 'person' }]);
  assert.deepEqual(out.map((x) => [x.uri, x.source?.addedBy ?? null]), [[LC, null], [WD, 'mara']]);
});
