import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeIsbn, toAsciiDigits, mergeIsbnResults, lookupIsbnEverywhere } from '../src/services/isbnLookup';
import { finishForExport } from '../src/services/bibframeNormalizer';

// ---------------------------------------------------------------- ISBN

test('ISBN: Arabic-Indic and Eastern Arabic-Indic digits are read as digits', () => {
  assert.equal(toAsciiDigits('٩٧٨٩٩٥٣٦٨٦٠٠٤'), '9789953686004');
  assert.equal(toAsciiDigits('۹۷۸۹۹۵۳۶۸۶۰۰۴'), '9789953686004');
  const info = normalizeIsbn('ردمك ٩٧٨-٩٩٥٣-٦٨-٦٠٠-٤');
  assert.equal(info.valid, true);
  assert.equal(info.isbn13, '9789953686004');
});

test('ISBN: hyphens, spaces and an "ISBN" prefix are ignored; both forms are derived', () => {
  const ten = normalizeIsbn('ISBN 0-451-52493-4');
  assert.equal(ten.valid, true);
  assert.equal(ten.isbn10, '0451524934');
  assert.equal(ten.isbn13, '9780451524935');

  const thirteen = normalizeIsbn('978-0-451-52493-5');
  assert.equal(thirteen.valid, true);
  assert.equal(thirteen.isbn10, '0451524934');
});

test('ISBN: X check digit, 979 prefixes and bad check digits', () => {
  assert.equal(normalizeIsbn('0-8044-2957-X').valid, true);
  const n979 = normalizeIsbn('979-10-90636-07-1');
  assert.equal(n979.valid, true);
  assert.equal(n979.isbn10, undefined, '979 ISBNs have no ISBN-10 form');
  assert.equal(normalizeIsbn('978-0-451-52493-6').problem, 'checksum');
  assert.equal(normalizeIsbn('12345').problem, 'length');
  assert.equal(normalizeIsbn('').problem, 'empty');
});

test('ISBN: each field comes from the first source that has it, and the source is recorded', () => {
  const merged = mergeIsbnResults([
    { source: 'Open Library', data: { title: 'مزرعة الحيوان', authors: ['George Orwell'], publisher: 'المركز الثقافي العربي', pages: 146 } as any },
    { source: 'Google Books', data: { title: 'Animal Farm', authors: [], date: '2014', language: 'ara' } as any },
  ])!;
  assert.equal(merged.title, 'مزرعة الحيوان');
  assert.equal(merged.sources.title, 'Open Library');
  assert.deepEqual(merged.authors, ['George Orwell']);
  assert.equal(merged.date, '2014');
  assert.equal(merged.sources.date, 'Google Books');
  assert.equal(merged.language, 'ara');
  assert.deepEqual(merged.foundIn, ['Open Library', 'Google Books']);
  assert.equal(mergeIsbnResults([{ source: 'Open Library', data: null }]), null);
});

test('ISBN: lookup cleans source punctuation, maps Google languages to MARC codes, survives a down source', async () => {
  const fakeFetch = (async (url: string) => {
    if (url.includes('openlibrary.org') && url.includes('jscmd=data')) {
      return new Response(JSON.stringify({ 'ISBN:9789953686004': {
        title: 'مزرعة الحيوان : رواية', authors: [{ name: 'George Orwell' }],
        publishers: [{ name: 'المركز الثقافي العربي،' }], publish_places: [{ name: 'Beirut :' }],
        publish_date: '٢٠١٤', number_of_pages: 146,
      } }));
    }
    if (url.includes('openlibrary.org')) {
      return new Response(JSON.stringify({ 'ISBN:9789953686004': { details: { languages: [{ key: '/languages/ara' }] } } }));
    }
    return new Response('rate limited', { status: 429 }); // Google Books down
  }) as typeof fetch;

  const { isbn, record, unreachable } = await lookupIsbnEverywhere('٩٧٨٩٩٥٣٦٨٦٠٠٤', fakeFetch);
  assert.equal(isbn.valid, true);
  assert.deepEqual(unreachable, ['Google Books']);
  assert.ok(record);
  assert.equal(record!.title, 'مزرعة الحيوان', '"Title : subtitle" is split');
  assert.equal(record!.subtitle, 'رواية');
  assert.equal(record!.publisher, 'المركز الثقافي العربي');
  assert.equal(record!.place, 'Beirut');
  assert.equal(record!.date, '2014', 'Arabic-Indic year read as 2014');
  assert.equal(record!.language, 'ara');
  assert.equal(record!.isbn13, '9789953686004');
});

test('ISBN: an invalid ISBN is never sent to the sources', async () => {
  let called = false;
  const fakeFetch = (async () => { called = true; return new Response('{}'); }) as unknown as typeof fetch;
  const result = await lookupIsbnEverywhere('978-0-451-52493-6', fakeFetch);
  assert.equal(result.isbn.problem, 'checksum');
  assert.equal(called, false);
});

// ---------------------------------------------------------------- Arabic language tags

const recordWith = (title: any, lang = 'ara') => ({
  '@context': 'http://id.loc.gov/ontologies/bibframe/',
  '@graph': [
    { '@id': 'https://mooon.site/resource/work/t1', '@type': 'bf:Work',
      'bf:language': { '@id': `http://id.loc.gov/vocabulary/languages/${lang}` },
      'bf:title': { '@type': 'bf:Title', 'bf:mainTitle': title } },
  ],
});

const mainTitles = (doc: any) => {
  const graph = Array.isArray(doc) ? doc : doc['@graph'];
  return [].concat(graph[0]['bf:title']['bf:mainTitle']);
};

test('Arabic: a title in Arabic script and its romanization are tagged ar-Arab and ar-Latn, like LC records', () => {
  const titles: any[] = mainTitles(finishForExport(recordWith(['القبسات', 'al-Qabasāt'])));
  assert.deepEqual(titles.find(t => t['@value'] === 'القبسات')?.['@language'], 'ar-Arab');
  assert.deepEqual(titles.find(t => t['@value'] === 'al-Qabasāt')?.['@language'], 'ar-Latn');
});

test('Arabic: Persian records use fa-Arab / fa-Latn; a Latin title alone is left untagged', () => {
  const persian: any[] = mainTitles(finishForExport(recordWith(['گلستان', 'Gulistān'], 'per')));
  assert.equal(persian.find(t => t['@value'] === 'Gulistān')?.['@language'], 'fa-Latn');
  const latinOnly: any[] = mainTitles(finishForExport(recordWith('Animal Farm', 'eng')));
  assert.equal(typeof latinOnly[0] === 'string' ? undefined : latinOnly[0]['@language'], undefined);
});

test('LC profile defaults (content, media, carrier, issuance) export as LC vocabulary links with their classes', () => {
  const doc: any = finishForExport({
    '@context': 'http://id.loc.gov/ontologies/bibframe/',
    '@graph': [
      { '@id': 'https://mooon.site/resource/work/d1', '@type': 'bf:Work',
        'bf:content': { '@id': 'http://id.loc.gov/vocabulary/contentTypes/txt', 'rdfs:label': 'text' } },
      { '@id': 'https://mooon.site/resource/instance/d1', '@type': 'bf:Instance',
        'bf:instanceOf': { '@id': 'https://mooon.site/resource/work/d1' },
        'bf:media': { '@id': 'http://id.loc.gov/vocabulary/mediaTypes/n', 'rdfs:label': 'unmediated' },
        'bf:carrier': { '@id': 'http://id.loc.gov/vocabulary/carriers/nc', 'rdfs:label': 'volume' },
        'bf:issuance': { '@id': 'http://id.loc.gov/vocabulary/issuance/mono', 'rdfs:label': 'single unit' } },
    ],
  });
  const graph: any[] = doc['@graph'];
  const work = graph.find(n => [].concat(n['@type']).includes('bf:Work' as never));
  const instance = graph.find(n => [].concat(n['@type']).includes('bf:Instance' as never));
  const one = (v: any) => [].concat(v)[0] as any;
  assert.equal(one(work['bf:content'])['@id'], 'http://id.loc.gov/vocabulary/contentTypes/txt');
  assert.ok([].concat(work['@type']).includes('bf:Text' as never), 'text content makes the Work a bf:Text, as LC does');
  assert.equal(one(instance['bf:media'])['@id'], 'http://id.loc.gov/vocabulary/mediaTypes/n');
  assert.equal(one(instance['bf:carrier'])['@id'], 'http://id.loc.gov/vocabulary/carriers/nc');
  assert.equal(one(instance['bf:issuance'])['@id'], 'http://id.loc.gov/vocabulary/issuance/mono');
});

test('Arabic: an existing language tag is never overwritten', () => {
  const titles: any[] = mainTitles(finishForExport(recordWith(['القبسات', { '@value': 'The Embers', '@language': 'en' }])));
  assert.equal(titles.find(t => t['@value'] === 'The Embers')?.['@language'], 'en');
});
