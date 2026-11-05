import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bookJsonLd, metaDescription, pageCount, year, languageTag, workUri } from '../src/opac/schemaOrg';

const work = {
  id: 'record-ali-1',
  title: 'علي بن أبي طالب',
  subtitle: 'قراءة في المصادر',
  language: 'ara',
  summaryArabic: 'دراسة في المصادر التاريخية.',
  coverUrl: 'https://x.supabase.co/storage/v1/object/public/covers/record-ali-1.jpg?v=1',
  primaryCreator: { name: 'Ali', nameArabic: 'علي الوردي', viafUri: 'https://viaf.org/viaf/1', role: 'author' },
  contributors: [{ nameArabic: 'علي الوردي' }, { nameArabic: 'محمد المترجم', role: 'translator' }],
  subjects: [{ label: 'التاريخ الإسلامي' }, { label: '' }],
  instances: [{ isbn: '9789953000000', publisher: 'دار الساقي', publicationYear: '[2020?]', extent: 'xii، ٣٢٠ صفحة' }],
  document: { '@graph': [{ '@id': 'https://mooon.site/resource/work/record-ali-1', '@type': 'bf:Work' }] },
};

test('a record page is a schema.org Book with its real data', () => {
  const b = bookJsonLd(work);
  assert.equal(b['@context'], 'https://schema.org');
  assert.equal(b['@type'], 'Book');
  assert.equal(b['@id'], 'https://mooon.site/resource/work/record-ali-1');
  assert.equal(b.url, 'https://mooon.site/opac.html?work=record-ali-1');
  assert.equal(b.name, 'علي بن أبي طالب');
  assert.equal(b.alternativeHeadline, 'قراءة في المصادر');
  assert.deepEqual(b.author, { '@type': 'Person', name: 'علي الوردي', sameAs: ['https://viaf.org/viaf/1'] });
  assert.equal(b.contributor.length, 1);
  assert.equal(b.contributor[0].name, 'محمد المترجم');
  assert.equal(b.inLanguage, 'ar');
  assert.deepEqual(b.about, [{ '@type': 'Thing', name: 'التاريخ الإسلامي' }]);
  assert.equal(b.isbn, '9789953000000');
  assert.equal(b.publisher.name, 'دار الساقي');
  assert.equal(b.datePublished, '2020');
  assert.equal(b.numberOfPages, 320);
  assert.equal(b.image, work.coverUrl);
  assert.equal(b.workExample, undefined);
});

test('empty and unknown values are left out', () => {
  const b = bookJsonLd({ id: 'r2', title: 'T', primaryCreator: { nameArabic: 'مؤلف غير معروف' }, language: 'und', instances: [] });
  for (const k of ['author', 'inLanguage', 'about', 'isbn', 'publisher', 'datePublished', 'numberOfPages', 'image', 'description']) {
    assert.equal(k in b, false, k);
  }
  assert.equal(workUri({ id: 'r2' }), 'https://mooon.site/resource/work/r2');
});

test('several editions become workExample', () => {
  const b = bookJsonLd({ ...work, instances: [{ isbn: '1', publicationYear: '1990' }, { isbn: '2', publisher: 'P', extent: '200 p.' }] });
  assert.equal(b.isbn, undefined);
  assert.equal(b.workExample.length, 2);
  assert.equal(b.workExample[1].numberOfPages, 200);
});

test('helpers: pages, years, languages, description', () => {
  assert.equal(pageCount('320 p. ; 24 cm'), 320);
  assert.equal(pageCount('1 online resource'), undefined);
  assert.equal(year('1441 هـ / 2020 م'), '2020');
  assert.equal(year('c1999'), '1999');
  assert.equal(languageTag('http://id.loc.gov/vocabulary/languages/per'), 'fa');
  assert.equal(metaDescription({ id: 'x', title: 'T', primaryCreator: { nameArabic: 'A' }, instances: [{ publisher: 'P', publicationYear: '2001' }] }), 'T، A، P، 2001 — في فهرس مون.');
  assert.ok(metaDescription({ id: 'x', title: 'T', summaryArabic: 'ا'.repeat(300) }).length <= 160);
});
