// Moon's profiles as DCTAP tables, the form LC's profile editor Dancer uses — and LC's own Marva table from
// Dancer (test/fixtures/dctap/lc-marva-sample.csv: three shapes of the "marva-default" workspace) read back.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { profileToDctap, dctapToProfile, parseCsv, toCsv, compact, expand, DCTAP_COLUMNS } from '../supabase/functions/server/dctap.tsx';
import { PROFILES } from '../supabase/functions/server/profiles.tsx';
import { shapesFromProfile } from '../supabase/functions/server/publishGate.tsx';

test('every Moon profile goes to DCTAP and comes back the same', () => {
  for (const [key, p] of Object.entries(PROFILES)) {
    const back = dctapToProfile(profileToDctap(p), { id: p.Profile.id, title: p.Profile.title, description: p.Profile.description });
    // Compared as JSON: the generated profiles carry keys set to undefined, which no file can hold.
    assert.deepEqual(back, JSON.parse(JSON.stringify(p)), key);
    // And so do the SHACL shapes the publish gate enforces.
    assert.equal(shapesFromProfile(back), shapesFromProfile(p), key);
  }
});

test('the table has Dancer\'s columns, a shape named on its first row only, and prefixed names', () => {
  const rows = parseCsv(profileToDctap(PROFILES.monograph || Object.values(PROFILES)[0]));
  assert.deepEqual(rows[0].slice(0, 17), [...DCTAP_COLUMNS].slice(0, 17));
  const shapeRows = rows.slice(1).filter((r) => r[0]);
  const first = shapeRows[0];
  assert.match(first[2], /^bf:/);
  // The row after a shape's first row leaves shapeID empty, as Dancer writes it.
  const i = rows.indexOf(first);
  assert.equal(rows[i + 1][0], '');
  assert.ok(rows.slice(1).every((r) => /^(bf|bflc|rdfs|madsrdf):/.test(r[3]) || r[3].startsWith('http')));
  assert.ok(rows.some((r) => r[DCTAP_COLUMNS.indexOf('moonPropertyLabelAr')]), 'Arabic labels are kept in Moon\'s own column');
});

test('LC\'s own Marva table from Dancer is read', () => {
  const lc = dctapToProfile(readFileSync('test/fixtures/dctap/lc-marva-sample.csv', 'utf8'), { id: 'lc:marva-default', title: 'LC Marva' });
  const ids = lc.Profile.resourceTemplates.map((t) => t.id);
  assert.deepEqual(ids.sort(), ['lc:RT:bf2:Agent:bfPerson', 'lc:RT:bf2:Hub:Hub', 'lc:RT:bf2:Monograph:Work'].sort());
  const hub = lc.Profile.resourceTemplates.find((t) => t.id === 'lc:RT:bf2:Hub:Hub')!;
  assert.equal(hub.resourceURI, 'http://id.loc.gov/ontologies/bibframe/Hub');
  const primary = hub.propertyTemplates.find((p) => p.propertyLabel === 'Primary Contributor')!;
  assert.equal(primary.propertyURI, 'http://id.loc.gov/ontologies/bibframe/contribution');
  assert.equal(primary.type, 'resource');
  assert.deepEqual(primary.valueConstraint.valueTemplateRefs, ['lc:RT:bf2:Hub:PrimaryContribution']);
  const person = lc.Profile.resourceTemplates.find((t) => t.id === 'lc:RT:bf2:Agent:bfPerson')!;
  const sameAs = person.propertyTemplates.find((p) => p.propertyURI === 'http://www.w3.org/2002/07/owl#sameAs')!;
  assert.equal(sameAs.type, 'lookup');
  assert.deepEqual(sameAs.valueConstraint.useValuesFrom, ['http://preprod.id.loc.gov/authorities/names']);
  const work = lc.Profile.resourceTemplates.find((t) => t.id === 'lc:RT:bf2:Monograph:Work')!;
  assert.ok(work.propertyTemplates.length > 10, `${work.propertyTemplates.length} Work properties`);
  // Moon's own export of what it read is a table Dancer reads again, with the same shapes.
  const again = dctapToProfile(profileToDctap(lc), { id: 'lc:marva-default', title: 'LC Marva' });
  assert.deepEqual(again.Profile.resourceTemplates.map((t) => t.propertyTemplates.length), lc.Profile.resourceTemplates.map((t) => t.propertyTemplates.length));
});

test('CSV cells with commas, quotes, line breaks and Arabic survive', () => {
  const rows = [['a,b', 'say "hi"', 'line\nbreak', 'العنوان، الفرعي', ' padded ']];
  assert.deepEqual(parseCsv(toCsv(rows)), rows);
  assert.equal(compact('http://id.loc.gov/ontologies/bibframe/title'), 'bf:title');
  assert.equal(expand('bf:title'), 'http://id.loc.gov/ontologies/bibframe/title');
  assert.equal(expand('http://example.org/x'), 'http://example.org/x');
  assert.throws(() => dctapToProfile('a,b\n1,2', { id: 'x', title: 'x' }), /propertyID/);
});
