// SRU copy cataloguing: the server only asks listed catalogues, with the term quoted; a real LC response
// (test/fixtures/sru) becomes Moon records, combining characters and 880 Arabic included.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sruTargets, sruUrl, sruSummary, LC_TARGET } from '../supabase/functions/server/sru.tsx';
import { readSruResponse } from '../src/services/sruClient';

const lcXml = readFileSync(new URL('./fixtures/sru/lc-qabasat.xml', import.meta.url), 'utf8');

test('catalogues: LC always, others only from a well-formed setting', () => {
  assert.deepEqual(sruTargets(undefined).map((t) => t.id), ['lc']);
  const t = sruTargets(JSON.stringify([
    { id: 'koha', name: 'University Koha', url: 'https://koha.example.edu/biblios' },
    { id: 'BAD ID', name: 'x', url: 'https://x' },
    { id: 'lc', name: 'impostor', url: 'https://evil.example' },
    { id: 'nourl', name: 'x', url: 'javascript:alert(1)' },
  ]));
  assert.deepEqual(t.map((x) => x.id), ['lc', 'koha']);
  assert.equal(t[0].url, LC_TARGET.url, 'LC cannot be redirected by the setting');
  assert.deepEqual(sruTargets('not json').map((x) => x.id), ['lc']);
});

test('the query is CQL with the term quoted, so a search cannot inject CQL', () => {
  const url = new URL(sruUrl(LC_TARGET, 'isbn', '978-0141439518" or cql.anywhere="x', 1, 50));
  assert.equal(url.origin + url.pathname, 'http://lx2.loc.gov:210/LCDB');
  assert.equal(url.searchParams.get('query'), 'bath.isbn="978-0141439518 or cql.anywhere= x"');
  assert.equal(url.searchParams.get('maximumRecords'), '20', 'capped');
  assert.equal(url.searchParams.get('recordSchema'), 'marcxml');
});

test('a real LC response becomes Moon records', () => {
  assert.equal(sruSummary(lcXml).total, 52);
  const records = readSruResponse(lcXml);
  assert.equal(records.length, 2);
  const titles = JSON.stringify(records[0].work['bf:title']['bf:mainTitle']);
  assert.ok(titles.includes('"Qabasāt"'), `hex entities decoded, composed (NFC), ISBD period removed: ${titles}`);
  assert.ok(/[؀-ۿ]/.test(titles), 'the Arabic from the linked 880 comes too');
  assert.ok(records[0].instance['bf:provisionActivity'], 'publication read from 260');
});

test('a diagnostic is reported', () => {
  const xml = '<zs:searchRetrieveResponse xmlns:zs="http://www.loc.gov/zing/srw/"><zs:numberOfRecords>0</zs:numberOfRecords><zs:diagnostics><diag:diagnostic xmlns:diag="http://www.loc.gov/zing/srw/diagnostic/"><diag:message>Unsupported index</diag:message></diag:diagnostic></zs:diagnostics></zs:searchRetrieveResponse>';
  assert.deepEqual(sruSummary(xml), { total: 0, diagnostic: 'Unsupported index' });
});
