// Phase 13 S22: "Where is my MARC field?" comes from the converter itself, and the published table is current.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { marcWhereTable } from '../src/services/marc/marcWhere';

const table = marcWhereTable();

test('core fields land where LC puts them', () => {
  const at = (tag: string, code: string) => table.find((f) => f.tag === tag)?.subfields.find((s) => s.code === code)?.places || [];
  assert.ok(at('245', 'a').includes('Instance › bf:title › bf:mainTitle'));
  assert.ok(at('100', 'a').some((p) => p.startsWith('Work › bf:contribution › bf:agent')));
  assert.ok(at('020', 'a').includes('Instance › bf:identifiedBy › rdf:value'));
  assert.ok(at('650', 'a').some((p) => p.startsWith('Work › bf:subject')));
  assert.ok(at('300', 'a').some((p) => p.startsWith('Instance › bf:extent')));
  assert.ok(table.every((f) => ['mapped', 'kept', 'coded', 'none'].includes(f.status)));
});

test('public/marc-where.json is current (run: npx tsx scripts/marc-where.mts)', () => {
  const published = JSON.parse(readFileSync(new URL('../public/marc-where.json', import.meta.url), 'utf8'));
  assert.deepEqual(published, JSON.parse(JSON.stringify(table)));
});
