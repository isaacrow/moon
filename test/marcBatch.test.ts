// Saving a whole MARC file: every record becomes its own linked Moon record, duplicates are skipped,
// one failure does not stop the rest, and each saved record passes through the same BIBFRAME producer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importMarcBatch, toMoonRecord } from '../src/services/marc/marcBatch';
import { marcToBibframe } from '../src/services/marc/marcToBibframe';
import type { MarcRecord } from '../src/services/marc/marcRecord';
import { buildW3CJsonLd } from '../src/services/w3cJsonLdBuilder';

const marc = (id: string, title: string, isbn: string): MarcRecord => ({
  leader: '00000nam a2200000 c 4500',
  fields: [
    { tag: '001', data: id },
    { tag: '008', data: '991231s1999    iq ||||||||||||||||| ara d' },
    { tag: '020', ind1: ' ', ind2: ' ', subfields: [['a', isbn]] },
    { tag: '245', ind1: '0', ind2: '0', subfields: [['a', `${title} /`]] },
    { tag: '336', ind1: ' ', ind2: ' ', subfields: [['a', 'text'], ['b', 'txt'], ['2', 'rdacontent']] },
  ],
});

test('each MARC record becomes its own Moon record with linked Work and Instance URIs', () => {
  const rec = toMoonRecord(marcToBibframe(marc('k1', 'Diwan', '9789953000000')), 'abc123', 'ali', 'koha.mrc');
  assert.equal(rec.work['@id'], 'https://mooon.site/resource/work/abc123');
  assert.equal(rec.instance['bf:instanceOf']['@id'], rec.work['@id']);
  assert.equal(rec.work['bf:hasInstance']['@id'], rec.instance['@id']);
  assert.equal(rec.metadata.catalogerId, 'ali');
  assert.match(rec.metadata.resourceType, /koha\.mrc/);
  // It builds into valid BIBFRAME like any editor record.
  const doc = buildW3CJsonLd({ workData: rec.work, instanceData: rec.instance, uriSet: rec.metadata.uriSet });
  assert.ok(doc['@graph'].some((n: any) => n['@id'] === rec.work['@id']));
});

test('a batch saves new records, skips duplicates and reports failures without stopping', async () => {
  const records = [marc('k1', 'Diwan', '1111111111'), marc('k2', 'Already here', '2222222222'), marc('k3', 'Server says no', '3333333333'), marc('k4', 'Last one', '4444444444')]
    .map(marcToBibframe);
  const saved: any[] = [];
  const progress: number[] = [];
  let n = 0;
  const result = await importMarcBatch(records, {
    cataloger: 'ali', fileName: 'koha.mrc', newId: () => `id${++n}`,
    findDuplicates: async (r) => (r.work['bf:title']['bf:mainTitle'] === 'Already here' ? [{ title: 'Already here (2019)' }] : []),
    save: async (r) => {
      if (r.work['bf:title']['bf:mainTitle'] === 'Server says no') throw new Error('Sign in to save records');
      saved.push(r);
      return { id: r.metadata.recordId, status: 'pending-review' };
    },
    onProgress: (done) => progress.push(done),
  });
  assert.deepEqual(result.saved.map((s) => s.title), ['Diwan', 'Last one']);
  assert.deepEqual(result.duplicates, [{ title: 'Already here', existing: 'Already here (2019)' }]);
  assert.deepEqual(result.failed, [{ title: 'Server says no', error: 'Sign in to save records' }]);
  assert.deepEqual(progress, [1, 2, 3, 4]);
  assert.equal(new Set(saved.map((r) => r.work['@id'])).size, 2, 'every saved record has its own URI');
});
