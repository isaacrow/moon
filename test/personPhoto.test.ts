// Finding an author's Wikidata item for their real photo: names, headings, LC/VIAF links, and the checks
// that keep a wrong link from showing a stranger's face.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nameTokens, namesAgree, splitHeading, qidFrom, authorityStatement, itemFits, isWriter, withoutTitles } from '../src/opac/personPhoto';

test('names agree across heading order, "al-", diacritics and hamza', () => {
  assert.ok(namesAgree('درويش، محمود، 1941-2008', 'محمود درويش'));
  assert.ok(namesAgree('Darwish, Mahmoud', 'Mahmoud Darwish'));
  assert.ok(namesAgree('Ali al-Wardi', 'Ali Al-Wardi'));
  assert.ok(namesAgree('Ṭāhā Ḥusayn', 'Taha Husayn'));
  assert.ok(!namesAgree('Mir Damad', 'Eberhard, Birgit'));
  assert.deepEqual(nameTokens('د. علي الوردي'), ['علي', 'وردي']);
});

test('LC-style headings give a searchable name and the years', () => {
  assert.deepEqual(splitHeading('درويش، محمود، 1941-2008'), { name: 'محمود درويش', birthYear: '1941', deathYear: '2008' });
  assert.deepEqual(splitHeading('Packer, George, 1960-'), { name: 'George Packer', birthYear: '1960' });
  assert.deepEqual(splitHeading('نجيب محفوظ'), { name: 'نجيب محفوظ' });
  assert.equal(withoutTitles('د. علي الوردي'), 'علي الوردي');
});

test('links: Wikidata items, and the statements that find LC and VIAF links', () => {
  assert.equal(qidFrom('https://www.wikidata.org/wiki/Q207720'), 'Q207720');
  assert.equal(qidFrom('http://id.loc.gov/authorities/names/n85123456'), undefined);
  assert.equal(authorityStatement('http://id.loc.gov/authorities/names/n85123456'), 'P244=n85123456');
  assert.equal(authorityStatement('http://id.loc.gov/rwo/agents/no2003094386'), 'P244=no2003094386');
  assert.equal(authorityStatement('https://viaf.org/viaf/96970432'), 'P214=96970432');
  assert.equal(authorityStatement('https://mooon.site/resource/agent/x'), undefined);
});

const darwish = {
  labels: { ar: { value: 'محمود درويش' }, en: { value: 'Mahmoud Darwish' } },
  aliases: {},
  claims: {
    P31: [{ mainsnak: { datavalue: { value: { id: 'Q5' } } } }],
    P106: [{ mainsnak: { datavalue: { value: { id: 'Q49757' } } } }],
    P569: [{ mainsnak: { datavalue: { value: { time: '+1941-03-13T00:00:00Z' } } } }],
    P570: [{ mainsnak: { datavalue: { value: { time: '+2008-08-09T00:00:00Z' } } } }],
  },
};

test('an item fits only a human with the same name and (when known) the same years', () => {
  assert.ok(itemFits(darwish, { name: 'محمود درويش' }));
  assert.ok(itemFits(darwish, { name: 'محمود درويش', birthYear: '1941', deathYear: '2008' }));
  assert.ok(!itemFits(darwish, { name: 'محمود درويش', birthYear: '1975' }), 'another man of the same name');
  assert.ok(!itemFits(darwish, { name: 'Birgit Eberhard' }), 'a wrong authority link');
  assert.ok(!itemFits({ ...darwish, claims: { ...darwish.claims, P31: [{ mainsnak: { datavalue: { value: { id: 'Q7725634' } } } }] } }, { name: 'محمود درويش' }), 'a book, not a person');
  assert.ok(isWriter(darwish));
});
