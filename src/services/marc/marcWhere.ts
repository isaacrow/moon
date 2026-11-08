/**
 * "Where is my MARC field?" (Phase 13 S22): for every MARC 21 field and subfield, where Moon puts it in
 * BIBFRAME. Not written by hand: each field is put through Moon's own MARC import (marcToBibframe) with a
 * marker in each subfield, and the marker is looked for in what comes out. So the table is always what the
 * converter really does, and a test fails if the published table (public/marc-where.json) falls behind.
 */
import { marcToBibframe } from './marcToBibframe';
import { MARC_FIELDS } from './marcDictionary';
import type { MarcRecord, DataField } from './marcRecord';

export interface SubfieldPlace { code: string; name: string; places: string[] }
export interface FieldPlace {
  tag: string; en: string; ar: string;
  /** mapped: some subfield lands in BIBFRAME; kept: stored as it is (moonext:marcField) and written back on export;
   *  coded: read for coded values (dates, codes) without its words showing; none: not used. */
  status: 'mapped' | 'kept' | 'coded' | 'none';
  subfields: SubfieldPlace[];
}

const BASE_008 = '260101s2020    iq            000 0 ara d';
const LEADER = '00000nam a2200000 i 4500';
const marker = (tag: string, code: string) => `Zq${tag}${code}qZ`;
const SKIP_CODES = /^[0-9]$/; // linkage, control and URI subfields: not text
/** Coded subfields need a real value to be read at all; their place is found by that value. */
const SAMPLES: Record<string, string> = {
  '020a': '9780394740676', '020z': '9780394740683', '022a': '0028-0836', '024a': '9780394740676', '041a': 'ara', '041b': 'eng', '041h': 'per',
  '043a': 'a-iq---', '044a': 'iq', '050a': 'PJ7755.A5', '050b': 'Q33 1980', '082a': '892.7', '084a': '297.1', '090a': 'BP173', '010a': 'n  79021164',
};
/** In a name field, the title subfields make it a related work (700 $a $t); the name is shown without them. */
const TITLE_PART = /^[fklnpt]$/;

/** Every place (entity › property › …) a text containing `needle` sits in. */
function placesOf(root: Record<string, any>, needle: string, ids = false): string[] {
  const out = new Set<string>();
  const walk = (v: any, path: string[]) => {
    if (typeof v === 'string') { if (v.includes(needle)) out.add(path.join(' › ')); return; }
    if (Array.isArray(v)) { v.forEach((x) => walk(x, path)); return; }
    if (!v || typeof v !== 'object') return;
    for (const [k, x] of Object.entries(v)) {
      if (k === '@type' || (k === '@id' && !ids)) continue;
      if (k === '@id') { if (typeof x === 'string' && x.includes(needle)) out.add(path.join(' › ')); continue; }
      walk(x, k === '@value' ? path : [...path, k]);
    }
  };
  for (const [entity, node] of Object.entries(root)) walk(node, [entity]);
  return [...out];
}

export function fieldPlace(tag: string): FieldPlace | null {
  const def = MARC_FIELDS[tag];
  if (!def || /^00/.test(tag)) return null;
  const isName = /^[1678](00|10|11)$/.test(tag);
  const codes = Object.keys(def.subfields).filter((c) => !SKIP_CODES.test(c) && !(isName && TITLE_PART.test(c)));
  const value = (c: string) => SAMPLES[tag + c] ?? marker(tag, c);
  const field: DataField = { tag, ind1: def.ind1 === '#' ? ' ' : def.ind1, ind2: def.ind2 === '#' ? ' ' : def.ind2, subfields: codes.map((c) => [c, value(c)]) };
  const fields: MarcRecord['fields'] = [
    { tag: '008', data: BASE_008 },
    ...(tag === '245' ? [] : [{ tag: '245', ind1: '0', ind2: '0', subfields: [['a', 'Base title']] } as DataField]),
    field,
  ];
  let out: ReturnType<typeof marcToBibframe>;
  try { out = marcToBibframe({ leader: LEADER, fields }); } catch { return { tag, en: def.en, ar: def.ar, status: 'none', subfields: [] }; }
  const roots = { Work: out.work, Instance: out.instance, Item: out.item };
  const kept = JSON.stringify(roots['Instance']?.['moonext:marcField'] ?? '').includes(value(codes[0] || 'a'));
  const subfields = codes.map((c) => ({
    code: c, name: def.subfields[c],
    places: placesOf(roots, value(c), !!SAMPLES[tag + c]).filter((p) => !p.includes('moonext:marcField')),
  }));
  const mapped = subfields.some((s) => s.places.length);
  const baseline = JSON.stringify(marcToBibframe({ leader: LEADER, fields: fields.filter((f) => f !== field) }));
  const changed = JSON.stringify(out) !== baseline;
  return {
    tag, en: def.en, ar: def.ar,
    status: mapped ? 'mapped' : kept ? 'kept' : changed ? 'coded' : 'none',
    subfields: subfields.filter((s) => s.places.length || !mapped),
  };
}

/** The whole table, in tag order. */
export function marcWhereTable(): FieldPlace[] {
  return Object.keys(MARC_FIELDS).sort().map(fieldPlace).filter((x): x is FieldPlace => !!x);
}
