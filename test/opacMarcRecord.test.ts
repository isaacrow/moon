// A record catalogued in MARC is a BIBFRAME record in the OPAC like any other: its title, author (with the
// authority link picked while cataloguing), contributors with their roles, subjects and publication show
// as they would for a record made in the BIBFRAME forms — in Arabic when the MARC has the Arabic (880).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeForOpac } from '../src/opac/normalizeGraph';

(globalThis as any).localStorage ??= { getItem: () => null, setItem: () => {}, removeItem: () => {} };
(globalThis as any).window ??= globalThis;

const B = '\\';
const MARC = [
  `LDR 00000nam${B}a2200000${B}i${B}4500`,
  '008 ' + '261106s2023    iq            000 0 ara d'.replace(/ /g, B),
  '020 ## $a 9789922000000',
  '100 0# $6 880-01 $a Ibn Khaldūn, $d 1332-1406, $e author. $0 http://id.loc.gov/authorities/names/n50052785',
  '245 10 $6 880-02 $a Muqaddimat Ibn Khaldūn / $c Ibn Khaldūn.',
  '264 #1 $6 880-03 $a Baghdād : $b Dār al-Shuʼūn al-Thaqāfīyah, $c 2023.',
  '300 ## $a 450 pages ; $c 24 cm',
  '650 #0 $a Islamic philosophy. $0 http://id.loc.gov/authorities/subjects/sh85100934',
  '700 1# $a ʻAlī, Ḥusayn, $e editor. $0 https://mooon.site/resource/agent/husayn-ali-1',
  '880 0# $6 100-01/(3/r $a ابن خلدون، $d 1332-1406',
  '880 10 $6 245-02/(3/r $a مقدمة ابن خلدون / $c ابن خلدون.',
  '880 #1 $6 264-03/(3/r $a بغداد : $b دار الشؤون الثقافية، $c 2023.',
].join('\n');

async function opacWorkFromMarc() {
  const { marcTextToBibframe } = await import('../src/services/marc/marcEditing');
  const { wolfMoonOpacService } = await import('../src/services/wolfMoonOpacService');
  const { bibframe } = marcTextToBibframe(MARC);
  const work = { ...bibframe!.work, '@id': 'https://mooon.site/resource/work/m1' };
  const instance = { ...bibframe!.instance, '@id': 'https://mooon.site/resource/instance/m1', 'bf:instanceOf': { '@id': work['@id'] } };
  // As a save stores it: the editor's Work and Instance in the record's @graph.
  return (wolfMoonOpacService as any).parseBibframeDocumentToOpacWork({ id: 'm1', title: '', document: { '@graph': [work, instance] } });
}

test('a MARC-catalogued record reads in the OPAC with its title, author, links and publication', async () => {
  const w = await opacWorkFromMarc();
  assert.ok(w, 'the record is in the OPAC');
  assert.equal(w.title, 'مقدمة ابن خلدون', 'the Arabic title (880), not the raw pair');
  assert.match(w.primaryCreator.name, /ابن خلدون/);
  assert.ok(w.primaryCreator.authorityLinks.includes('http://id.loc.gov/authorities/names/n50052785'), 'the LC link picked while cataloguing');
  const editor = w.contributors.find((c: any) => /ʻAlī/.test(c.name));
  assert.equal(editor.role, 'editor');
  assert.deepEqual(editor.authorityLinks, ['https://mooon.site/resource/agent/husayn-ali-1']);
  assert.equal(w.subjects[0].uri, 'http://id.loc.gov/authorities/subjects/sh85100934');
  const i = w.instances[0];
  assert.deepEqual([i.publicationPlace, i.publisher, i.publicationYear, i.isbn, i.extent], ['بغداد', 'دار الشؤون الثقافية', '2023', '9789922000000', '450 pages']);
});

test('the shape the OPAC reads: two scripts give the Arabic and keep the other, lists give the main one', () => {
  const [n] = normalizeForOpac([{
    '@id': 'x', 'bf:title': [{ '@type': ['bf:VariantTitle'], 'bf:mainTitle': 'v' }, { '@type': 'bf:Title', 'bf:mainTitle': [{ '@value': 'Kitāb' }, { '@value': 'كتاب' }] }],
    'bf:provisionActivity': [{ '@type': 'bf:Manufacture' }, { '@type': 'bf:Publication', 'bf:date': '2001' }],
    'bf:extent': ['1 v.', '2 maps'],
  }]);
  assert.equal(n['bf:title']['bf:mainTitle'], 'كتاب');
  assert.equal(n['bf:title']['moon:otherScript']['bf:mainTitle'], 'Kitāb');
  assert.equal(n['bf:provisionActivity']['bf:date'], '2001');
  assert.equal(n.extent, '1 v. ; 2 maps');
});
