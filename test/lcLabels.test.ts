// Access points (bflc:aap) and LC variant title types, as LC's records carry them (BIBFRAME primer),
// and MARC 246 variant titles typed as LC's marc2bibframe2 types them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withLcLabels, accessPoint, bare, variantTypeCode, VARTITLETYPE } from '../supabase/functions/server/lcLabels.tsx';
import { parseMrk } from '../src/services/marc/marcRecord';
import { marcToBibframe } from '../src/services/marc/marcToBibframe';

const W = 'https://mooon.site/resource/work/r1';
const doc = {
  '@graph': [
    {
      '@id': W, '@type': ['bf:Work', 'bf:Text'],
      'bf:title': [
        { '@type': 'bf:Title', 'bf:mainTitle': ['القبسات', 'Qabasāt'] },
        { '@type': 'bf:VariantTitle', 'bf:mainTitle': 'Les étincelles', 'bf:variantType': 'translated title' },
        { '@type': 'bf:VariantTitle', 'bf:mainTitle': 'Spine words', 'bf:variantType': 'something else' },
      ],
      'bf:contribution': [
        { '@type': 'bf:Contribution', 'bf:agent': { 'rdfs:label': 'Muḥaqqiq, Mahdī' }, 'bf:role': { '@id': 'http://id.loc.gov/vocabulary/relators/edt' } },
        { '@type': ['bf:Contribution', 'bf:PrimaryContribution'], 'bf:agent': { '@id': 'http://id.loc.gov/rwo/agents/n85043844' } },
      ],
      'bf:expressionOf': { '@type': 'bf:Hub', 'bf:title': { 'bf:mainTitle': 'Qabasāt. English' } },
    },
    { '@id': 'http://id.loc.gov/rwo/agents/n85043844', '@type': 'bf:Person', 'rdfs:label': ['الميرداماد', 'Mīr Dāmād, Muḥammad Bāqir ibn Muḥammad, -1631.'] },
  ],
};

test('a Work gets "Creator. Title", romanized forms first, punctuation trimmed', () => {
  const out = withLcLabels(doc);
  const work = out['@graph'][0];
  assert.equal(work['bflc:aap'], 'Mīr Dāmād, Muḥammad Bāqir ibn Muḥammad, -1631. Qabasāt');
  // A Hub without a creator: just its title.
  assert.equal(work['bf:expressionOf']['bflc:aap'], 'Qabasāt. English');
});

test('variant titles get LC\'s type when their words match one; others are left as they are', () => {
  const titles = withLcLabels(doc)['@graph'][0]['bf:title'];
  assert.deepEqual(titles[1]['@type'], ['bf:VariantTitle', `${VARTITLETYPE}tra`]);
  assert.equal(titles[1]['bf:variantType'], 'translated title');
  assert.equal(titles[2]['@type'], 'bf:VariantTitle');
  assert.equal(variantTypeCode('عنوان الغلاف'), 'cov');
  assert.equal(variantTypeCode('Spine title'), 'spi');
});

test('an existing access point is kept, the input is untouched, and a work with no creator is just its title', () => {
  const kept = withLcLabels({ '@graph': [{ '@type': 'bf:Work', 'bflc:aap': 'Given. Heading', 'bf:title': { 'bf:mainTitle': 'X' } }] });
  assert.equal(kept['@graph'][0]['bflc:aap'], 'Given. Heading');
  assert.equal((doc['@graph'][0] as any)['bflc:aap'], undefined);
  assert.equal(accessPoint({ 'bf:title': { 'bf:mainTitle': 'Becoming /' } }, new Map()), 'Becoming');
  // An author found by role when there is no primary contribution.
  assert.equal(accessPoint({
    'bf:title': { 'bf:mainTitle': 'Becoming' },
    'bf:contribution': { 'bf:agent': { 'rdfs:label': 'Obama, Michelle, 1964-' }, 'bf:role': 'http://id.loc.gov/vocabulary/relators/aut' },
  }, new Map()), 'Obama, Michelle, 1964-. Becoming');
  assert.equal(bare('Ali b. Abi Talib :'), 'Ali b. Abi Talib');
  assert.equal(bare('First edition.'), 'First edition');
});

test('MARC 246 becomes typed variant titles on the Instance, beside the 245 title', () => {
  const { instance } = marcToBibframe(parseMrk(String.raw`=LDR  00000nam a2200000 i 4500
=245  10$aQabasat.
=246  14$aKitab al-Qabasat
=246  18$aQabasat
=246  31$aThe sparks
=246  3\$iTranslated title:$aLes étincelles`)[0]);
  const titles = instance['bf:title'];
  assert.equal(titles[0]['@type'], 'bf:Title');
  assert.deepEqual(titles[1]['@type'], ['bf:VariantTitle', `${VARTITLETYPE}cov`]);
  assert.deepEqual(titles[2]['@type'], ['bf:VariantTitle', `${VARTITLETYPE}spi`]);
  assert.equal(titles[3]['@type'], 'bf:ParallelTitle');
  assert.equal(titles[4]['bf:variantType'], 'Translated title');
  // Its words give it the LC type when served.
  const served = withLcLabels({ '@graph': [{ '@type': 'bf:Instance', 'bf:title': titles }] });
  assert.ok(served['@graph'][0]['bf:title'][4]['@type'].includes(`${VARTITLETYPE}tra`));
});
