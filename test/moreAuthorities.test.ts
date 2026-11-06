// FAST, ORCID and ISNI as authority sources, against saved real responses (test/fixtures/authorities).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseFast, parseOrcid, searchFAST, searchORCID } from '../src/services/moreAuthorities';
import { parseIsni, isniSearchUrl } from '../supabase/functions/server/isni.tsx';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/authorities/${name}`, import.meta.url), 'utf8');

test('FAST: one result per heading, FAST URIs, the alternative form that matched', () => {
  const r = parseFast(JSON.parse(fixture('fast.json')), 'Topic');
  const uris = r.map((x) => x.uri);
  assert.equal(new Set(uris).size, uris.length, 'no heading twice');
  const phil = r.find((x) => x.uri === 'http://id.worldcat.org/fast/1730358')!;
  assert.equal(phil.label, 'Islamic philosophy');
  assert.equal(phil.source, 'FAST');
  const alt = r.find((x) => x.label === 'Muslim philosophers');
  assert.equal(alt?.description, 'Islamic philosophers → Muslim philosophers');
});

test('ORCID: names, orcid.org URIs, institutions', () => {
  const r = parseOrcid(JSON.parse(fixture('orcid.json')));
  assert.ok(r.length > 0);
  assert.match(r[0].uri, /^https:\/\/orcid\.org\/\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/);
  assert.equal(r[0].source, 'ORCID');
  assert.ok(r[0].label.includes('Hassan'));
});

test('ISNI: number, isni.org URI, "Surname, Forename", dates and sources', () => {
  const r = parseIsni(fixture('isni.xml'));
  assert.ok(r.length > 0);
  assert.equal(r[0].isni, '0000000499115413');
  assert.equal(r[0].uri, 'https://isni.org/isni/0000000499115413');
  assert.equal(r[0].label, 'Jawāhirī, Kifāḥ Muḥammad Mahdī');
  assert.equal(r[0].dates, '1941-');
  assert.ok(r[0].sources.includes('LCNACO'));
  assert.equal(new URL(isniSearchUrl('al-"Jawahiri"')).searchParams.get('query'), 'pica.nw="al- Jawahiri"', 'the name is quoted, never CQL');
});

test('a source that is down gives no results instead of an error', async () => {
  const down = (async () => { throw new Error('offline'); }) as unknown as typeof fetch;
  assert.deepEqual(await searchFAST('islam', 'topic', down), []);
  assert.deepEqual(await searchORCID('hassan', down), []);
  assert.deepEqual(await searchFAST('x', 'topic', down), [], 'too short to search');
});
