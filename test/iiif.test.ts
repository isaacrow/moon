// IIIF manifests (Presentation 2 and 3, in the shapes real libraries publish) become pages with image addresses.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseManifest, findManifest, looksLikeManifest } from '../src/services/iiif';

const v2 = {
  '@context': 'http://iiif.io/api/presentation/2/context.json',
  '@id': 'https://iiif.example.org/ms-123/manifest', '@type': 'sc:Manifest',
  label: 'القبسات — مخطوطة', attribution: 'Courtesy of the library',
  sequences: [{ '@type': 'sc:Sequence', canvases: [
    { '@id': 'c1', '@type': 'sc:Canvas', label: '1و', images: [{ resource: { '@id': 'https://img.example.org/ms-123/f1/full/full/0/default.jpg',
      service: { '@context': 'http://iiif.io/api/image/2/context.json', '@id': 'https://img.example.org/ms-123/f1' } } }] },
    { '@id': 'c2', '@type': 'sc:Canvas', label: '1ظ', images: [{ resource: { '@id': 'https://img.example.org/ms-123/f2.jpg' } }] },
  ] }],
};

const v3 = {
  '@context': 'http://iiif.io/api/presentation/3/context.json',
  id: 'https://iiif.example.org/book/manifest.json', type: 'Manifest',
  label: { ar: ['ديوان الجواهري'], en: ['Diwan al-Jawahiri'] },
  requiredStatement: { label: { en: ['Attribution'] }, value: { en: ['Digitised by the University of Baghdad'] } },
  rights: 'http://creativecommons.org/licenses/by/4.0/',
  items: [{ id: 'p1', type: 'Canvas', label: { none: ['i'] }, items: [{ type: 'AnnotationPage', items: [{ type: 'Annotation', motivation: 'painting',
    body: { id: 'https://img.example.org/book/p1/full/max/0/default.jpg', type: 'Image',
      service: [{ id: 'https://img.example.org/book/p1/', type: 'ImageService3' }] } }] }] }],
};

test('Presentation 2: pages, labels, Image API sizes, plain images, attribution', () => {
  const m = parseManifest(v2)!;
  assert.equal(m.label, 'القبسات — مخطوطة');
  assert.deepEqual(m.pages.map((p) => p.label), ['1و', '1ظ']);
  assert.equal(m.pages[0].image(800), 'https://img.example.org/ms-123/f1/full/800,/0/default.jpg');
  assert.equal(m.pages[0].thumb, 'https://img.example.org/ms-123/f1/full/200,/0/default.jpg');
  assert.equal(m.pages[1].image(800), 'https://img.example.org/ms-123/f2.jpg', 'no image service: the file itself');
  assert.equal(m.attribution, 'Courtesy of the library');
});

test('Presentation 3: language maps, image service with a trailing slash, rights', () => {
  const m = parseManifest(v3)!;
  assert.equal(m.label, 'ديوان الجواهري');
  assert.equal(m.pages[0].label, 'i');
  assert.equal(m.pages[0].image(1000), 'https://img.example.org/book/p1/full/1000,/0/default.jpg');
  assert.equal(m.attribution, 'Digitised by the University of Baghdad');
  assert.equal(m.rights, 'http://creativecommons.org/licenses/by/4.0/');
});

test('not a manifest: null, and links that do not look like manifests are not fetched', async () => {
  assert.equal(parseManifest({ type: 'Collection', items: [] }), null);
  assert.equal(parseManifest({ type: 'Manifest', items: [] }), null, 'a manifest with no pages');
  assert.equal(looksLikeManifest('https://example.org/scan.pdf'), false);
  assert.equal(looksLikeManifest('http://iiif.example.org/manifest'), false, 'https only, as browsers require on mooon.site');
  const fetched: string[] = [];
  const fakeFetch = (async (url: string) => {
    fetched.push(url);
    if (url.includes('broken')) throw new Error('CORS');
    return { ok: true, json: async () => (url.includes('book') ? v3 : { type: 'Collection' }) };
  }) as unknown as typeof fetch;
  const m = await findManifest(['https://example.org/scan.pdf', 'https://broken.example/iiif/manifest', 'https://iiif.example.org/coll/manifest', 'https://iiif.example.org/book/manifest.json'], fakeFetch);
  assert.equal(m?.label, 'ديوان الجواهري');
  assert.deepEqual(fetched, ['https://broken.example/iiif/manifest', 'https://iiif.example.org/coll/manifest', 'https://iiif.example.org/book/manifest.json']);
});
