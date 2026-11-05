/**
 * A MARC 21 record and its three file forms:
 * - ISO 2709 (.mrc): the binary exchange format Koha, MarcEdit and every ILS load (UTF-8, leader/09 = "a");
 * - MARCXML (.xml): the Library of Congress XML schema;
 * - MarcEdit text (.mrk): the "=245  10$aTitle" lines people read and edit.
 */

export type Subfield = [code: string, value: string];
export interface ControlField { tag: string; data: string }
export interface DataField { tag: string; ind1: string; ind2: string; subfields: Subfield[] }
export type MarcField = ControlField | DataField;
export interface MarcRecord { leader: string; fields: MarcField[] }

export const isControl = (f: MarcField): f is ControlField => (f as ControlField).data !== undefined;

const FIELD_END = 0x1e;
const RECORD_END = 0x1d;
const SUBFIELD = 0x1f;

/** Fields in tag order (control fields first), as MARC requires; equal tags keep their order. */
export function sortFields(fields: MarcField[]): MarcField[] {
  return fields.map((f, i) => [f, i] as const).sort((a, b) => a[0].tag.localeCompare(b[0].tag) || a[1] - b[1]).map(([f]) => f);
}

/** ISO 2709: leader (24), directory (12 bytes per field), field terminator, the fields, record terminator. */
export function toIso2709(record: MarcRecord): Uint8Array {
  const enc = new TextEncoder();
  const fields = sortFields(record.fields);
  const bodies = fields.map((f) => {
    if (isControl(f)) return Uint8Array.from([...enc.encode(f.data), FIELD_END]);
    const parts: number[] = [...enc.encode((f.ind1 || ' ') + (f.ind2 || ' '))];
    for (const [code, value] of f.subfields) parts.push(SUBFIELD, ...enc.encode(code + value));
    parts.push(FIELD_END);
    return Uint8Array.from(parts);
  });
  let offset = 0;
  const directory = fields.map((f, i) => {
    const entry = f.tag.padStart(3, '0') + String(bodies[i].length).padStart(4, '0') + String(offset).padStart(5, '0');
    offset += bodies[i].length;
    return entry;
  }).join('');
  const baseAddress = 24 + directory.length + 1;
  const length = baseAddress + offset + 1;
  if (length > 99999) throw new Error('This record is too long for a MARC file (over 99,999 bytes).');
  // Leader: record length (00-04), base address of data (12-16), UTF-8 (09 = a), entry map "4500" (20-23).
  const l = record.leader.padEnd(24, ' ').split('');
  const leader = String(length).padStart(5, '0') + l.slice(5, 9).join('') + 'a' + '22' + String(baseAddress).padStart(5, '0') + l.slice(17, 20).join('') + '4500';
  const out = new Uint8Array(length);
  let p = 0;
  for (const chunk of [enc.encode(leader), enc.encode(directory), Uint8Array.of(FIELD_END), ...bodies, Uint8Array.of(RECORD_END)]) {
    out.set(chunk, p);
    p += chunk.length;
  }
  return out;
}

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** MARCXML (http://www.loc.gov/MARC21/slim), one or more records in a collection. */
export function toMarcXml(records: MarcRecord[]): string {
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<collection xmlns="http://www.loc.gov/MARC21/slim">'];
  for (const r of records) {
    lines.push('  <record>', `    <leader>${xml(r.leader.padEnd(24, ' ').slice(0, 9) + 'a' + r.leader.padEnd(24, ' ').slice(10))}</leader>`);
    for (const f of sortFields(r.fields)) {
      if (isControl(f)) lines.push(`    <controlfield tag="${f.tag}">${xml(f.data)}</controlfield>`);
      else {
        lines.push(`    <datafield tag="${f.tag}" ind1="${xml(f.ind1 || ' ')}" ind2="${xml(f.ind2 || ' ')}">`);
        for (const [code, value] of f.subfields) lines.push(`      <subfield code="${xml(code)}">${xml(value)}</subfield>`);
        lines.push('    </datafield>');
      }
    }
    lines.push('  </record>');
  }
  lines.push('</collection>', '');
  return lines.join('\n');
}

/** MarcEdit's text form (.mrk): "=LDR  ...", "=245  10$aTitle". Blanks in indicators are written as "\". */
export function toMrk(record: MarcRecord): string {
  const ind = (c: string) => (!c || c === ' ' ? '\\' : c);
  const leader = record.leader.padEnd(24, ' ');
  const lines = [`=LDR  ${(leader.slice(0, 9) + 'a' + leader.slice(10)).replace(/ /g, '\\')}`];
  for (const f of sortFields(record.fields)) {
    if (isControl(f)) lines.push(`=${f.tag}  ${f.data.replace(/ /g, '\\')}`);
    else lines.push(`=${f.tag}  ${ind(f.ind1)}${ind(f.ind2)}${f.subfields.map(([c, v]) => `$${c}${v}`).join('')}`);
  }
  return lines.join('\n') + '\n';
}
