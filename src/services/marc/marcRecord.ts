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

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/** ISO 2709 (.mrc), one record or a whole batch (e.g. a Koha export). Assumes UTF-8 (leader/09 = a). */
export function parseIso2709(bytes: Uint8Array): MarcRecord[] {
  const dec = new TextDecoder('utf-8');
  const records: MarcRecord[] = [];
  let start = 0;
  while (start < bytes.length) {
    // Skip line breaks some tools put between records.
    while (start < bytes.length && (bytes[start] === 0x0a || bytes[start] === 0x0d)) start++;
    if (start >= bytes.length) break;
    const length = Number(dec.decode(bytes.subarray(start, start + 5)));
    if (!Number.isFinite(length) || length < 25) throw new Error('This is not a binary MARC file (the record length is missing).');
    const rec = bytes.subarray(start, start + length);
    const leader = dec.decode(rec.subarray(0, 24));
    const base = Number(leader.slice(12, 17));
    const fields: MarcField[] = [];
    for (let p = 24; p + 12 <= base - 1; p += 12) {
      const entry = dec.decode(rec.subarray(p, p + 12));
      const tag = entry.slice(0, 3);
      const len = Number(entry.slice(3, 7));
      const off = Number(entry.slice(7, 12));
      let body = rec.subarray(base + off, base + off + len);
      if (body[body.length - 1] === FIELD_END) body = body.subarray(0, body.length - 1);
      if (/^00\d$/.test(tag)) { fields.push({ tag, data: dec.decode(body) }); continue; }
      // Composed characters (ā, not a + macron), as Moon stores and searches text.
      const text = dec.decode(body).normalize('NFC');
      const [ind, ...parts] = text.split(String.fromCharCode(SUBFIELD));
      fields.push({ tag, ind1: ind[0] || ' ', ind2: ind[1] || ' ', subfields: parts.filter(Boolean).map((s) => [s[0], s.slice(1)] as Subfield) });
    }
    records.push({ leader, fields });
    start += length;
  }
  return records;
}

const unxml = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  // LC writes combining marks as hex entities (Qabasa&#x304;t).
  .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&amp;/g, '&');
const attr = (tag: string, name: string) => (tag.match(new RegExp(`\\b${name}="([^"]*)"`)) || [])[1] ?? '';

/** MARCXML: a <collection> of <record>s or a single <record>, with or without a "marc:" prefix. */
export function parseMarcXml(text: string): MarcRecord[] {
  const src = text.replace(/<(\/?)marc:/g, '<$1');
  const records: MarcRecord[] = [];
  for (const [, body] of src.matchAll(/<record\b[^>]*>([\s\S]*?)<\/record>/g)) {
    const leader = unxml((body.match(/<leader>([\s\S]*?)<\/leader>/) || [])[1] || '').padEnd(24, ' ');
    const fields: MarcField[] = [];
    for (const m of body.matchAll(/<controlfield\b([^>]*)>([\s\S]*?)<\/controlfield>|<datafield\b([^>]*)>([\s\S]*?)<\/datafield>/g)) {
      if (m[1] !== undefined) { fields.push({ tag: attr(m[1], 'tag'), data: unxml(m[2]) }); continue; }
      const subfields = [...m[4].matchAll(/<subfield\b([^>]*)>([\s\S]*?)<\/subfield>/g)].map(([, a, v]) => [attr(a, 'code'), unxml(v).normalize('NFC')] as Subfield);
      fields.push({ tag: attr(m[3], 'tag'), ind1: attr(m[3], 'ind1') || ' ', ind2: attr(m[3], 'ind2') || ' ', subfields });
    }
    records.push({ leader, fields });
  }
  return records;
}

/** MarcEdit text (.mrk): records separated by blank lines; "\" is a blank. */
export function parseMrk(text: string): MarcRecord[] {
  const records: MarcRecord[] = [];
  for (const block of text.replace(/\r/g, '').split(/\n\s*\n/)) {
    let leader = '';
    const fields: MarcField[] = [];
    for (const line of block.split('\n')) {
      const m = line.match(/^=(\w{3}) {2}(.*)$/);
      if (!m) continue;
      const [, tag, rest] = m;
      if (tag === 'LDR') leader = rest.replace(/\\/g, ' ');
      else if (/^00\d$/.test(tag)) fields.push({ tag, data: rest.replace(/\\/g, ' ') });
      else {
        const blank = (c: string) => (c === '\\' ? ' ' : c || ' ');
        fields.push({ tag, ind1: blank(rest[0]), ind2: blank(rest[1]),
          subfields: rest.slice(2).normalize('NFC').split('$').filter(Boolean).map((s) => [s[0], s.slice(1)] as Subfield) });
      }
    }
    if (leader || fields.length) records.push({ leader: leader.padEnd(24, ' '), fields });
  }
  return records;
}

/** Reads a MARC file whatever its form: binary, MARCXML or MarcEdit text. */
export function readMarcFile(bytes: Uint8Array): MarcRecord[] {
  const head = new TextDecoder('utf-8').decode(bytes.subarray(0, 400)).replace(/^﻿/, '').trimStart();
  if (/^\d{5}/.test(head)) return parseIso2709(bytes);
  const text = new TextDecoder('utf-8').decode(bytes).replace(/^﻿/, '');
  if (head.startsWith('<')) return parseMarcXml(text);
  if (head.startsWith('=LDR') || head.startsWith('=')) return parseMrk(text);
  throw new Error('This file is not MARC (binary .mrc, MARCXML or MarcEdit .mrk).');
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
