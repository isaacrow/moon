// Real linking for new books: the author's Wikidata/VIAF/LC/ISNI links, the work's Hub, LC and Dewey classes,
// LCCN and OCLC numbers; and saving turns them into Moon entities that keep those links.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sampleRecord, type SampleBook } from '../src/app/utils/sampleRecords.ts';
import { toServerDocument } from '../src/app/utils/recordStorageBackend.ts';
import { missingForPublish } from '../supabase/functions/server/publishGate.tsx';
import { findUnlinked, linkAuthorities } from '../supabase/functions/server/authorityLinking.tsx';
import { lccFromOpenLibrary, ddcFromOpenLibrary } from '../supabase/functions/server/sampleBooks.tsx';

const book: SampleBook = {
  isbn: '9789953214146', lang: 'ara', title: 'لا أريد لهذه القصيدة أن تنتهي', author: 'Mahmud Darwish',
  responsibility: 'محمود درويش', place: 'بيروت', publisher: 'رياض الريس', date: '2009', extent: '152 صفحة',
  genre: 'شعر', subjects: ['الشعر العربي -- فلسطين'],
  authorFacts: {
    links: ['http://www.wikidata.org/entity/Q207720', 'http://viaf.org/viaf/113381455', 'http://id.loc.gov/authorities/names/n50037926'],
    arabicName: 'محمود درويش', birthDate: '1941', deathDate: '2008',
  },
  openLibrary: { edition: 'https://openlibrary.org/books/OL1M' },
  lccn: '2009123456', oclc: ['123456789'],
  lcc: { classificationPortion: 'PJ7820', itemPortion: '.A7 L3 2009' }, ddc: '892.716',
};

test('Open Library classes become LC and Dewey numbers as BIBFRAME splits them', () => {
  assert.deepEqual(lccFromOpenLibrary('PJ-7862.00000000.H356 H5513 1987'), { classificationPortion: 'PJ7862', itemPortion: '.H356 H5513 1987' });
  assert.deepEqual(lccFromOpenLibrary('DS-0079.65000000.P33 2005'), { classificationPortion: 'DS79.65', itemPortion: '.P33 2005' });
  assert.deepEqual(lccFromOpenLibrary('PJ7820.A7 1990'), { classificationPortion: 'PJ7820', itemPortion: '.A7 1990' });
  assert.equal(lccFromOpenLibrary('nonsense'), undefined);
  assert.equal(ddcFromOpenLibrary('892.716'), '892.716');
  assert.equal(ddcFromOpenLibrary('[E]'), undefined);
});

test('the record carries the author links, a Hub, classes and identifiers, and can be published', () => {
  const doc = toServerDocument(sampleRecord(book, 'isaac'));
  assert.deepEqual(missingForPublish(doc), []);
  const work: any = doc['@graph'].find((n: any) => [].concat(n['@type']).includes('bf:Work' as never));
  const inst: any = doc['@graph'].find((n: any) => [].concat(n['@type']).includes('bf:Instance' as never));
  const agent = work['bf:contribution'][0]['bf:agent'];
  assert.deepEqual(agent['rdfs:label'], ['محمود درويش', 'Mahmud Darwish'], 'Arabic name first for an Arabic book');
  assert.equal(agent['owl:sameAs'].length, 3);
  assert.equal(agent['madsrdf:birthDate'], '1941');
  assert.equal(work['bf:expressionOf']['@type'], 'bf:Hub');
  assert.equal(work['bf:expressionOf']['bflc:aap'], 'محمود درويش. لا أريد لهذه القصيدة أن تنتهي');
  assert.deepEqual(work['bf:classification'].map((c: any) => c['@type']), ['bf:ClassificationLcc', 'bf:ClassificationDdc']);
  assert.deepEqual(inst['bf:identifiedBy'].map((i: any) => i['@type']), ['bf:Isbn', 'bf:Lccn', 'bf:Local']);
});

test('saving links the author (with type, dates and outside links) and the Hub as Moon entities', async () => {
  const doc = toServerDocument(sampleRecord(book, 'isaac'));
  const targets = findUnlinked(doc);
  const author = targets.find((t) => t.where === 'contributor')!;
  assert.equal(author.label, 'محمود درويش');
  assert.deepEqual(author.variants, ['Mahmud Darwish']);
  assert.deepEqual(author.data, { agentType: 'person', birthDate: '1941', deathDate: '2008' });
  assert.equal(author.sameAs.length, 3);
  const hub = targets.find((t) => t.kind === 'hub')!;
  assert.equal(hub.label, 'محمود درويش. لا أريد لهذه القصيدة أن تنتهي');
  assert.equal(hub.data.title, 'لا أريد لهذه القصيدة أن تنتهي');
  assert.equal(hub.data.creator, 'محمود درويش');
  const publisher = targets.find((t) => t.where === 'publisher')!;
  assert.equal(publisher.data.agentType, 'organization', 'a publisher is an organization, not a person');

  const added: any[] = [];
  await linkAuthorities(doc, async (input) => { added.push(input); return { authority: { id: `e${added.length}`, kind: input.kind } }; },
    (a) => `https://mooon.site/resource/${a.kind}/${a.id}`);
  const work: any = doc['@graph'][0];
  assert.match(work['bf:contribution'][0]['bf:agent']['@id'], /\/agent\//);
  assert.match(work['bf:expressionOf']['@id'], /\/hub\//, 'the work points at its Moon hub');
  assert.ok(added.some((a) => a.kind === 'agent' && a.sameAs.includes('http://www.wikidata.org/entity/Q207720')));
});
