// Moon → FOLIO from start to finish, the MARC route: real Moon sample records become MARC, the MARC becomes
// quickMARC fields, and they go to a fake FOLIO that checks every request the way FOLIO's quickMARC does
// (mod-quick-marc: baseMarcRecord.yaml, fieldItem.yaml, marcFormat.yaml), then reads the Instance back.
// The data must be good, not just accepted: a coded 008 (language, date, country), an RDA leader, a title.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bibframeToMarc } from '../src/services/marc/bibframeToMarc';
import { sendMarc, toQuickMarc, marcProblems } from '../supabase/functions/server/folioMarc.tsx';
import type { FolioApi } from '../supabase/functions/server/folio.tsx';

const sample = (name: string) => JSON.parse(readFileSync(new URL(`../public/records/${name}.jsonld`, import.meta.url), 'utf8'));
const SAMPLES = ['al-qabasat', 'b125923'];

/** What quickMARC refuses: the schema's required properties, tag pattern, indicator shape, format enum. */
function quickMarcErrors(body: any): string[] {
  const errors: string[] = [];
  for (const k of ['marcFormat', 'leader', 'fields']) if (body?.[k] === undefined) errors.push(`missing ${k}`);
  if (!['BIBLIOGRAPHIC', 'HOLDINGS', 'AUTHORITY'].includes(body?.marcFormat)) errors.push('bad marcFormat');
  if (typeof body?.leader !== 'string' || body.leader.length !== 24) errors.push('leader must be 24 characters');
  for (const f of body?.fields || []) {
    if (!/^[0-9]{3}$/.test(String(f.tag))) errors.push(`bad tag ${f.tag}`);
    if (f.content === undefined || f.content === '' || f.content === null) errors.push(`${f.tag} has no content`);
    if (f.indicators !== undefined) {
      if (!Array.isArray(f.indicators) || f.indicators.length > 2) errors.push(`${f.tag} indicators`);
      for (const i of f.indicators || []) if (typeof i !== 'string' || i.length !== 1) errors.push(`${f.tag} indicator "${i}"`);
    }
    if (/^00/.test(f.tag) && f.indicators) errors.push(`${f.tag} is a control field and has indicators`);
    if (!/^00/.test(f.tag) && (typeof f.content !== 'string' || !/^\$[a-z0-9] /.test(f.content))) errors.push(`${f.tag} content must start with a subfield`);
  }
  if (/^(001|003|005|999)$/.test((body?.fields || []).map((f: any) => f.tag).join('|'))) errors.push('FOLIO assigns 001/003/005/999');
  return errors;
}

function strictFolio() {
  const seen: { path: string; body: any }[] = [];
  const instances: Record<string, any> = {};
  const api: FolioApi = {
    async get(path) {
      const one = path.match(/^\/instance-storage\/instances\/([^?]+)$/);
      if (one) return instances[one[1]] ? { status: 200, json: instances[one[1]] } : { status: 404, json: null };
      if (path.startsWith('/instance-storage/instances?')) return { status: 200, json: { instances: [] } };
      return { status: 404, json: null };
    },
    async post(path, body) {
      seen.push({ path, body });
      const errors = quickMarcErrors(body);
      if (path === '/records-editor/validate') {
        return { status: 200, json: { issues: errors.map((message) => ({ severity: 'error', message })) } };
      }
      if (path === '/records-editor/records') {
        if (errors.length) return { status: 422, json: { errors: errors.map((message) => ({ message })) } };
        // FOLIO builds the Instance from the MARC: the title from 245 $a.
        const t245 = body.fields.find((f: any) => f.tag === '245');
        const title = String(t245?.content || '').match(/\$a ([^$]*)/)?.[1]?.trim() || '';
        instances['i-1'] = { id: 'i-1', hrid: 'in00000000001', source: 'MARC', title };
        return { status: 201, json: { externalId: 'i-1', externalHrid: 'in00000000001' } };
      }
      return { status: 404, json: null };
    },
    async put() { return { status: 404, json: null }; },
  };
  return { api, seen, instances };
}

for (const name of SAMPLES) {
  test(`${name}: Moon's MARC passes quickMARC's checks and is created in FOLIO with its title`, async () => {
    const marc = bibframeToMarc(sample(name), { recordId: name, now: new Date('2026-11-07T10:00:00Z') });
    assert.deepEqual(marcProblems(marc as any), [], 'Moon\'s own checks before sending');
    const q = toQuickMarc(marc as any);
    assert.deepEqual(quickMarcErrors({ marcFormat: 'BIBLIOGRAPHIC', ...q }), []);

    const folio = strictFolio();
    const r: any = await sendMarc(folio.api, marc as any, null, { wait: async () => {} });
    assert.equal(r.status, 'created', r.message);
    assert.equal(r.hrid, 'in00000000001');
    assert.deepEqual(folio.seen.map((s) => s.path), ['/records-editor/validate', '/records-editor/records']);
    assert.ok(folio.instances['i-1'].title, 'FOLIO built an Instance with a title');
    assert.ok(!r.warnings.some((w: string) => /without a title|could not be read back/.test(w)));
  });

  test(`${name}: the data is good, not only accepted (coded 008, RDA leader)`, () => {
    const marc = bibframeToMarc(sample(name), { recordId: name });
    const q = toQuickMarc(marc as any);
    const f008 = q.fields.find((f) => f.tag === '008')!.content;
    assert.match(String(f008.Lang), /^[a-z]{3}$/);
    assert.notEqual(f008.Lang, 'und', 'the language is coded, so FOLIO\'s Instance gets it');
    assert.match(String(f008.DtSt), /^[bcdeikmnpqrstu|\\]$/, 'a MARC type of date');
    assert.match(String(f008.Date1), /^[0-9u|\\]{4}$/);
    const has040rda = marc.fields.some((f: any) => f.tag === '040' && f.subfields?.some(([c, v]: [string, string]) => c === 'e' && v === 'rda'));
    if (has040rda) assert.equal(q.leader[18], 'i', 'RDA record: ISBD punctuation included');
    assert.equal(q.leader.slice(20), '4500');
  });
}
