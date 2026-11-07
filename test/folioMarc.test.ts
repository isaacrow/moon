// Moon → FOLIO as MARC: the record goes to quickMARC in its shape, FOLIO keeps MARC + Instance, a second send
// updates the same record, and the FOLIO password Moon stores is sealed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toQuickMarc, books008, marcProblems, sendMarc, type MarcIn } from '../supabase/functions/server/folioMarc.tsx';
import { seal, unseal, settingsProblems, publicSettings } from '../supabase/functions/server/folioSettings.tsx';
import type { FolioApi } from '../supabase/functions/server/folio.tsx';

const F008 = '261106s2023    iq ab         000 0 ara d';
const MARC: MarcIn = {
  leader: '00000nam a2200000 c 4500',
  fields: [
    { tag: '001', data: 'moon-1' }, { tag: '005', data: '20261106' }, { tag: '008', data: F008 },
    { tag: '020', ind1: ' ', ind2: ' ', subfields: [['a', '9789953000000']] },
    { tag: '100', ind1: '1', ind2: ' ', subfields: [['a', 'ابن خلدون،'], ['d', '1332-1406'], ['0', 'http://id.loc.gov/authorities/names/n50052785']] },
    { tag: '245', ind1: '1', ind2: '0', subfields: [['a', 'المقدمة'], ['c', 'كلفة 5$ للنسخة']] },
    { tag: '500', ind1: ' ', ind2: ' ', subfields: [['a', '  ']] },
  ],
};

test('MARC becomes quickMARC fields: FOLIO numbers it, blanks are \\, $ is escaped, the 008 is named', () => {
  const q = toQuickMarc(MARC);
  assert.equal(q.leader.length, 24);
  assert.ok(!q.fields.some((f) => /^(001|005)$/.test(f.tag)), 'FOLIO assigns 001 and 005');
  assert.ok(!q.fields.some((f) => f.tag === '500'), 'an empty field is left out');
  const f100 = q.fields.find((f) => f.tag === '100')!;
  assert.deepEqual(f100.indicators, ['1', '\\']);
  assert.equal(f100.content, '$a ابن خلدون، $d 1332-1406 $0 http://id.loc.gov/authorities/names/n50052785');
  assert.match(q.fields.find((f) => f.tag === '245')!.content, /5\{dollar\}/);
  const f008 = q.fields.find((f) => f.tag === '008')!.content;
  assert.equal(f008.Type, 'a');
  assert.equal(f008.BLvl, 'm');
  assert.equal(f008.Date1, '2023');
  assert.equal(f008.Ctry, 'iq\\');
  assert.deepEqual(f008.Ills, ['a', 'b', '\\', '\\']);
  assert.equal(f008.Lang, 'ara');
  assert.equal(f008.Srce, 'd');
  assert.deepEqual(Object.keys(books008(MARC.leader, F008)).length, 20);
});

test('what quickMARC would refuse is said before sending', () => {
  assert.deepEqual(marcProblems(MARC), []);
  assert.ok(marcProblems({ ...MARC, fields: MARC.fields.filter((f) => f.tag !== '245') }).some((p) => p.includes('245')));
  assert.ok(marcProblems({ ...MARC, fields: MARC.fields.map((f) => (f.tag === '008' ? { ...f, data: 'short' } : f)) }).some((p) => p.includes('008')));
  assert.ok(marcProblems({ leader: 'x', fields: [] } as any).length >= 2);
});

/** A fake FOLIO with quickMARC and Inventory. */
function fakeFolio(opts: { async?: boolean; isbnHit?: boolean; issues?: any[]; noValidate?: boolean } = {}) {
  const calls: { method: string; path: string; body?: any }[] = [];
  const instances: Record<string, any> = {};
  let polls = 0;
  const api: FolioApi = {
    async get(path) {
      calls.push({ method: 'GET', path });
      if (path.startsWith('/records-editor/records/status')) {
        polls++;
        return { status: 200, json: polls < 2 ? { status: 'IN_PROGRESS' } : { status: 'CREATED', externalId: 'inst-1' } };
      }
      if (path.startsWith('/records-editor/records?externalId=')) {
        return { status: 200, json: { parsedRecordId: 'pr-1', leader: 'x', fields: [{ tag: '001', content: 'in00001' }, { tag: '999', content: '$i inst-1', indicators: ['f', 'f'] }] } };
      }
      const one = path.match(/^\/instance-storage\/instances\/([^?]+)$/);
      if (one) return instances[one[1]] ? { status: 200, json: instances[one[1]] } : { status: 404, json: null };
      if (path.startsWith('/instance-storage/instances?')) return { status: 200, json: { instances: opts.isbnHit ? [{ id: 'other', hrid: 'in9', title: 'Other' }] : [] } };
      return { status: 404, json: null };
    },
    async post(path, body) {
      calls.push({ method: 'POST', path, body });
      // FOLIO's own MARC check (quickMARC); older FOLIO has none (404).
      if (path === '/records-editor/validate') return opts.noValidate ? { status: 404, json: null } : { status: 200, json: { issues: opts.issues || [] } };
      instances['inst-1'] = { id: 'inst-1', hrid: 'in00001', source: 'MARC', _version: 3, title: 'Title' };
      return { status: 201, json: opts.async ? { qmRecordId: 'qm-1', status: 'NEW' } : { externalId: 'inst-1' } };
    },
    async put(path, body) { calls.push({ method: 'PUT', path, body }); return { status: 202, json: null }; },
  };
  return { api, calls, instances };
}
const noWait = async () => {};

test('first send creates MARC + Instance (FOLIO answering at once, or after polling)', async () => {
  for (const async of [false, true]) {
    const { api, calls } = fakeFolio({ async });
    const r: any = await sendMarc(api, MARC, null, { wait: noWait });
    assert.equal(r.status, 'created');
    assert.equal(r.instanceId, 'inst-1');
    assert.equal(r.hrid, 'in00001');
    assert.equal(calls.find((c) => c.method === 'POST')!.path, '/records-editor/validate', "FOLIO's MARC check comes first");
    const post = calls.find((c) => c.method === 'POST' && c.path === '/records-editor/records')!;
    assert.equal(post.path, '/records-editor/records');
    assert.equal(post.body._actionType, 'create');
    assert.equal(post.body.marcFormat, 'BIBLIOGRAPHIC');
  }
});

test('a second send updates the same record and keeps FOLIO\'s own 001 and 999', async () => {
  const { api, calls, instances } = fakeFolio();
  instances['inst-1'] = { id: 'inst-1', hrid: 'in00001', source: 'MARC', _version: 7 };
  const r: any = await sendMarc(api, MARC, { instanceId: 'inst-1', sentAt: '', hash: '', mode: 'marc' }, { wait: noWait });
  assert.equal(r.status, 'updated');
  const put = calls.find((c) => c.method === 'PUT')!;
  assert.equal(put.path, '/records-editor/records/pr-1');
  assert.equal(put.body._actionType, 'edit');
  assert.equal(put.body.relatedRecordVersion, '7');
  assert.equal(put.body.fields[0].tag, '001');
  assert.equal(put.body.fields.at(-1).tag, '999');
  assert.ok(!calls.some((c) => c.method === 'POST' && c.path === '/records-editor/records'), 'no second record');
});

test("FOLIO's own MARC check: an error stops the send, a warning is passed on, an older FOLIO without it still sends", async () => {
  const bad = fakeFolio({ issues: [{ tag: '245', severity: 'error', message: 'Field is required' }] });
  const r: any = await sendMarc(bad.api, MARC, null, { wait: noWait });
  assert.equal(r.status, 'blocked');
  assert.match(r.message, /245: Field is required/);
  assert.ok(!bad.calls.some((c) => c.path === '/records-editor/records'), 'nothing sent');
  const warn = fakeFolio({ issues: [{ tag: '300', severity: 'warn', message: 'Subfield a is recommended' }] });
  const w: any = await sendMarc(warn.api, MARC, null, { wait: noWait });
  assert.equal(w.status, 'created');
  assert.ok(w.warnings.some((x: string) => /300: Subfield a is recommended/.test(x)));
  assert.equal((await sendMarc(fakeFolio({ noValidate: true }).api, MARC, null, { wait: noWait })).status, 'created');
});

test('same ISBN in FOLIO is offered first; an Instance sent without MARC is not overwritten', async () => {
  const hit = fakeFolio({ isbnHit: true });
  assert.equal((await sendMarc(hit.api, MARC, null, { wait: noWait })).status, 'match');
  assert.equal((await sendMarc(hit.api, MARC, null, { wait: noWait, createAnyway: true })).status, 'created');
  const folioOnly = fakeFolio();
  folioOnly.instances['x'] = { id: 'x', hrid: 'in5', source: 'FOLIO' };
  assert.equal((await sendMarc(folioOnly.api, MARC, { instanceId: 'x', sentAt: '', hash: '' }, { wait: noWait })).status, 'blocked');
});

test('the FOLIO password is sealed, opens only with the server secret, and never goes back to a browser', async () => {
  const sealed = await seal('s3cret-pass', 'server-key');
  assert.ok(!sealed.includes('s3cret'));
  assert.notEqual(sealed, await seal('s3cret-pass', 'server-key'), 'a fresh nonce each time');
  assert.equal(await unseal(sealed, 'server-key'), 's3cret-pass');
  await assert.rejects(unseal(sealed, 'other-key'));
  const shown = publicSettings({ url: 'https://okapi.lib.org', tenant: 'lib', username: 'moon', sealedPassword: sealed });
  assert.equal(shown!.hasPassword, true);
  assert.ok(!JSON.stringify(shown).includes(sealed));
});

test('connection details are checked: https, public address, tenant shape', () => {
  assert.deepEqual(settingsProblems({ url: 'https://okapi.lib.org', tenant: 'fs00001000', username: 'moon' }), []);
  assert.ok(settingsProblems({ url: 'http://okapi.lib.org', tenant: 'x', username: 'm' }).length);
  assert.ok(settingsProblems({ url: 'https://192.168.1.5', tenant: 'x', username: 'm' }).length);
  assert.ok(settingsProblems({ url: 'https://okapi.lib.org', tenant: 'bad tenant!', username: 'm' }).length);
});
