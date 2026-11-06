// Hubs from MARC, as LC's marc2bibframe2 builds them (BIBFRAME primer, Appendix A): 130 and 1XX + 240 are
// the work this record expresses; 7XX $t and 730 are related works (or contained works, 2nd indicator 2);
// 8XX are series; 600/610/611 $t and 630 are works as subjects. Each is a bf:Hub with its access point.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMrk } from '../src/services/marc/marcRecord';
import { marcToBibframe } from '../src/services/marc/marcToBibframe';

const MRK = String.raw`=LDR  00000nam a2200000 i 4500
=008  261106s2026\\\\enk\\\\\\\\\\\\000\0\eng\d
=100  1\$aHomer.$0http://id.loc.gov/authorities/names/n78095639
=240  10$aOdyssey.$lEnglish.
=245  14$aThe Odyssey /$cHomer.
=700  12$aPlato.$tRepublic.
=700  1\$iTranslation of:$aHomer.$tIliad.
=700  1\$aFagles, Robert,$eTranslator.
=730  0\$aBible.$pGenesis.
=600  10$aShakespeare, William,$d1564-1616.$tHamlet.
=630  00$aKoran.
=630  00$aKoran$xCommentaries.
=650  \0$aEpic poetry.
=830  \0$aPenguin classics ;$v42.
`;
const { work } = marcToBibframe(parseMrk(MRK)[0]);

test('1XX + 240 is the Hub this work expresses, with LC\'s access point', () => {
  const hub = work['bf:expressionOf'];
  assert.equal(hub['@type'], 'bf:Hub');
  assert.equal(hub['bflc:aap'], 'Homer. Odyssey. English');
  assert.equal(hub['bf:title']['bf:mainTitle'], 'Odyssey. English');
  assert.equal(hub['bf:contribution']['bf:agent']['rdfs:label'], 'Homer');
  assert.equal(hub['bf:contribution']['bf:agent']['@id'], 'http://id.loc.gov/authorities/names/n78095639');
});

test('130 alone is the Hub too', () => {
  const { work: w } = marcToBibframe(parseMrk(String.raw`=LDR  00000nam a2200000 i 4500
=130  0\$aArabian nights.$lEnglish.
=245  10$aThe thousand and one nights.`)[0]);
  assert.equal(w['bf:expressionOf']['bflc:aap'], 'Arabian nights. English');
  assert.equal(w['bf:expressionOf']['bf:contribution'], undefined);
});

test('a 700 with $t is a related work, not a contributor; a plain 700 stays a contributor', () => {
  const names = work['bf:contribution'].map((c: any) => c['bf:agent']['rdfs:label']);
  assert.deepEqual(names, ['Homer', 'Fagles, Robert']);
  const rel = work['bf:relation'];
  const iliad = rel.find((r: any) => r['bf:associatedResource']['bflc:aap'] === 'Homer. Iliad');
  assert.ok(iliad, JSON.stringify(rel.map((r: any) => r['bf:associatedResource']['bflc:aap'])));
  assert.equal(iliad['@type'], 'bf:Relation');
  assert.equal(iliad['bf:relationship']['rdfs:label'], 'Translation of');
  assert.equal(iliad['bf:associatedResource']['@type'], 'bf:Hub');
});

test('second indicator 2 is a contained work; 730 keeps its part', () => {
  assert.equal(work['bf:hasPart'][0]['bflc:aap'], 'Plato. Republic');
  const genesis = work['bf:relation'].find((r: any) => /Bible/.test(r['bf:associatedResource']['bflc:aap']));
  assert.equal(genesis['bf:associatedResource']['bflc:aap'], 'Bible. Genesis');
  assert.equal(genesis['bf:associatedResource']['bf:title']['bf:partName'], 'Genesis');
});

test('8XX is a series Hub with its numbering', () => {
  const series = work['bf:relation'].find((r: any) => r['bf:relationship']?.['@id'] ==='http://id.loc.gov/vocabulary/relationship/series');
  assert.equal(series['bf:associatedResource']['bflc:aap'], 'Penguin classics');
  assert.equal(series['bf:seriesEnumeration'], '42');
});

test('works as subjects are Hubs; a subdivided heading stays one subject', () => {
  const subjects = work['bf:subject'];
  const hamlet = subjects.find((s: any) => s['bflc:aap']?.includes('Hamlet'));
  assert.equal(hamlet['@type'], 'bf:Hub');
  assert.equal(hamlet['bflc:aap'], 'Shakespeare, William, 1564-1616. Hamlet');
  assert.ok(subjects.some((s: any) => s['@type'] === 'bf:Hub' && s['bflc:aap'] === 'Koran'));
  assert.ok(subjects.some((s: any) => s['@type'] === 'bf:Topic' && s['rdfs:label'] === 'Koran--Commentaries'));
  assert.ok(subjects.some((s: any) => s['@type'] === 'bf:Topic' && s['rdfs:label'] === 'Epic poetry'));
});
