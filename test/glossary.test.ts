// Phase 13 S22: the glossary and its MARC fields from the real mapping.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GLOSSARY, glossaryEntry, marcFieldsFor } from '../src/services/glossary';

test('every entry has both languages, unique keys, plain length', () => {
  assert.equal(new Set(GLOSSARY.map((g) => g.key.toLowerCase())).size, GLOSSARY.length);
  for (const g of GLOSSARY) {
    assert.ok(g.ar && g.en && g.defAr && g.defEn, g.key);
    assert.ok(g.defEn.length <= 220 && g.defAr.length <= 220, `${g.key} is short`);
  }
  assert.equal(glossaryEntry('bf:mainTitle')?.en, 'Main title');
  assert.equal(glossaryEntry('http://id.loc.gov/ontologies/bibframe/Instance')?.ar, 'الطبعة (الإصدار)');
  assert.equal(glossaryEntry('nothing'), undefined);
});

test('MARC fields come from the converter table', () => {
  const table = JSON.parse(readFileSync(new URL('../public/marc-where.json', import.meta.url), 'utf8'));
  assert.ok(marcFieldsFor('mainTitle', table).some((x) => x.startsWith('245 $a')));
  assert.ok(marcFieldsFor('extent', table).some((x) => x.startsWith('300')));
  assert.deepEqual(marcFieldsFor('noSuchProperty', table), []);
});

test('public/glossary.json is current (run: npx tsx scripts/glossary-json.mts)', () => {
  assert.deepEqual(JSON.parse(readFileSync(new URL('../public/glossary.json', import.meta.url), 'utf8')), JSON.parse(JSON.stringify(GLOSSARY)));
});
