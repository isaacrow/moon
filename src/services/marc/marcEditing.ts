/**
 * MARC 21 cataloguing in Moon: the cataloguer edits MARC, and Moon turns it into BIBFRAME as they type.
 *
 * - Text form, one field per line, as cataloguers write it:  245 10 $a Title : $b subtitle / $c author.
 *   MarcEdit lines (=245  10$aTitle) and the ‡ / ǂ delimiters are read too; # or \ is a blank indicator.
 * - checkMarc(): what a cataloguer should fix (bad tag, no 245 $a, a field that may not repeat, …), by line.
 * - The BIBFRAME comes from the same converter as MARC import (marcToBibframe), so a record catalogued in
 *   MARC is the same BIBFRAME as one imported.
 */
import type { MarcRecord, MarcField, DataField, Subfield } from './marcRecord';
import { isControl } from './marcRecord';
import { marcToBibframe, type ImportedMarcRecord } from './marcToBibframe';
import { MARC_FIELDS, fieldDef } from './marcDictionary';
import { check008 } from './marcFixedFields';

export interface MarcLineIssue { line: number; tag?: string; level: 'error' | 'warning'; en: string; ar: string }

const BLANK = /^[#\\_ ]$/;
const ind = (c: string | undefined) => (c === undefined || BLANK.test(c) ? ' ' : c);
const showInd = (c: string) => (c === ' ' ? '#' : c);

/**
 * A data field's indicators and subfields, in the ways catalogues show them:
 *   "10 $a Title"   "1# $aTitle"   "_0 $a …"   "1 0 $$a Title" (Alma)   "10\t|a Title" (Library of Congress)
 *   "10 Title / ǂc …" (OCLC Connexion: the first subfield is $a, shown without its code)
 * Returns the indicators and the subfield text as "<delimiter><code>value…", or why it cannot be read.
 */
function splitDataField(rest: string, afterTab = false): { inds: string; parts: string[] } | { error: 'indicators' | 'empty'; inds: string } {
  // One separator after the tag (a tab, as the Library of Congress shows it, or a space); a space after a
  // tab is a blank first indicator ("650<tab> 0 |a …").
  const body = (afterTab ? rest : rest.replace(/^ /, '')).replace(/\t/g, ' ').replace(/\$\$/g, '$');
  // "|" marks subfields only when nothing else does (the Library of Congress catalogue display).
  const delimiter = /[$‡ǂ]/.test(body) || !/\|[a-z0-9]/.test(body) ? /[$‡ǂ]/ : /\|/;
  const d = body.search(delimiter);
  const head = (d < 0 ? body : body.slice(0, d)).replace(/\s+$/, '');
  const subs = d < 0 ? [] : body.slice(d).split(delimiter).slice(1);
  if (/^\S \S$/.test(head)) return { inds: head[0] + head[2], parts: subs }; // "1 0"
  if (head.length <= 2) return subs.length ? { inds: head.padEnd(2, ' '), parts: subs } : { error: 'empty', inds: head };
  // Longer: two indicators, then the first subfield's words without "$a".
  // (Tried as typed too, so a blank first indicator — "650  0 Epic poetry." — is not lost.)
  const implicit = /^([0-9#_\\ ])([0-9#_\\ ])\s+(\S.*)$/;
  const raw = rest.replace(/\t/g, ' ').replace(/\$\$/g, '$');
  const m = head.match(implicit) || (d < 0 ? raw : raw.slice(0, raw.search(delimiter))).replace(/\s+$/, '').match(implicit);
  if (m) return { inds: m[1] + m[2], parts: [`a${m[3]}`, ...subs] };
  return { error: 'indicators', inds: head };
}

/** Text → MARC record; lines that cannot be read are reported, not dropped silently. */
export function parseMarcText(text: string): { record: MarcRecord; issues: MarcLineIssue[]; lineOf: number[] } {
  const record: MarcRecord = { leader: '', fields: [] };
  const issues: MarcLineIssue[] = [];
  const lineOf: number[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = i + 1;
    const s = raw.replace(/^\s*=/, '').trimEnd();
    if (!s.trim()) return;
    const prev = record.fields[record.fields.length - 1];
    const m = s.match(/^\s*(LDR|LEADER|[A-Za-z0-9]{3})(?=\s|$)\s?(.*)$/i);
    const looksLikeField = m && !/^\s/.test(s) && (/^\d{3}$/.test(m[1]) || /^(LDR|LEADER)$/i.test(m[1]));
    // A long field that ran onto the next line when it was copied is indented, or starts with a subfield
    // mark; it is joined to the field above. Any other stray text stays an error.
    const startsWithSubfield = /^\s*(\$\$?|[‡ǂ|])[a-z0-9]/.test(s);
    if (!looksLikeField && (/^\s/.test(s) || startsWithSubfield) && prev && !isControl(prev) && prev.subfields.length) {
      if (startsWithSubfield) {
        const body = s.trim().replace(/\$\$/g, '$');
        for (const part of body.split(/[$‡ǂ|]/).slice(1)) if (/^[a-z0-9]/.test(part)) prev.subfields.push([part[0], part.slice(1).trim()]);
      } else {
        const last = prev.subfields[prev.subfields.length - 1];
        last[1] = `${last[1]} ${s.trim()}`.trim();
      }
      issues.push({ line, tag: prev.tag, level: 'warning', en: `Joined to ${prev.tag} above (the field had run onto a new line).`, ar: `ضُمّ إلى الحقل ${prev.tag} في الأعلى (كان قد انقسم على سطرين).` });
      return;
    }
    if (!m) { issues.push({ line, level: 'error', en: 'Not a MARC field: a line starts with a 3-character tag.', ar: 'ليس حقل مارك: يبدأ السطر برمز من 3 خانات.' }); return; }
    const tag = m[1].toUpperCase();
    const rest = m[2];
    // The leader: "LDR", "LEADER", or "000" as the Library of Congress catalogue shows it.
    if (tag === 'LDR' || tag === 'LEADER' || tag === '000') { record.leader = rest.replace(/^\s+/, '').replace(/[\\#^]/g, ' ').padEnd(24, ' ').slice(0, 24); return; }
    if (!/^\d{3}$/.test(tag)) { issues.push({ line, tag, level: 'error', en: `Tag "${tag}" must be three digits.`, ar: `يجب أن يكون الرمز «${tag}» ثلاثة أرقام.` }); return; }
    if (tag < '010') {
      record.fields.push({ tag, data: rest.replace(/^\s+/, '').replace(/\\/g, ' ') });
      lineOf.push(line);
      return;
    }
    const split = splitDataField(rest, /^\s*[A-Za-z0-9]{3}\t/.test(s));
    if ('error' in split) {
      issues.push(split.error === 'empty'
        ? { line, tag, level: 'error', en: `${tag}: no subfields ($a …).`, ar: `${tag}: لا حقول فرعية ($a …).` }
        : { line, tag, level: 'error', en: `${tag}: two indicators, then the subfields ("${split.inds}" is too long).`, ar: `${tag}: مؤشران ثم الحقول الفرعية («${split.inds}» أطول من اللازم).` });
      return;
    }
    const inds = split.inds;
    const subfields: Subfield[] = [];
    for (const part of split.parts) {
      if (!part) continue;
      const code = part[0];
      const value = part.slice(1).trim();
      if (!/^[a-z0-9]$/.test(code)) { issues.push({ line, tag, level: 'error', en: `${tag}: "$${code}" is not a subfield code.`, ar: `${tag}: «$${code}» ليس رمز حقل فرعي.` }); continue; }
      subfields.push([code, value]);
    }
    record.fields.push({ tag, ind1: ind(inds[0]), ind2: ind(inds[1]), subfields });
    lineOf.push(line);
  });
  if (!record.leader) record.leader = '00000nam a2200000 i 4500';
  return { record, issues, lineOf };
}

/** MARC record → the text form (indicators as # when blank, " $a " between subfields). */
export function marcToText(record: MarcRecord): string {
  const lines = [`LDR ${record.leader.replace(/ /g, '\\')}`];
  for (const f of record.fields) {
    if (isControl(f)) lines.push(`${f.tag} ${f.data.replace(/ /g, '\\')}`);
    else lines.push(`${f.tag} ${showInd(f.ind1)}${showInd(f.ind2)} ${f.subfields.map(([c, v]) => `$${c} ${v}`).join(' ')}`);
  }
  return lines.join('\n');
}

/** A value with words in it (ISBD punctuation alone, as in a template, is not one). */
const hasText = (v: string) => /[\p{L}\p{N}]/u.test(v);

/** Fields MARC 21 lets appear only once (from the field dictionary). */
const NON_REPEATABLE = new Set(Object.values(MARC_FIELDS).filter((d) => !d.repeatable).map((d) => d.tag));
const ONE_MAIN_ENTRY = ['100', '110', '111', '130'];

/** What to fix before the record is good MARC (and good BIBFRAME). */
export function checkMarc(record: MarcRecord, lineOf: number[] = []): MarcLineIssue[] {
  const issues: MarcLineIssue[] = [];
  const at = (i: number) => lineOf[i] ?? 0;
  const count = new Map<string, number>();
  record.fields.forEach((f, i) => {
    count.set(f.tag, (count.get(f.tag) || 0) + 1);
    if (count.get(f.tag) === 2 && NON_REPEATABLE.has(f.tag)) issues.push({ line: at(i), tag: f.tag, level: 'error', en: `${f.tag} may appear only once.`, ar: `الحقل ${f.tag} لا يتكرر.` });
    if (!fieldDef(f.tag) && f.tag !== '880') issues.push({ line: at(i), tag: f.tag, level: 'warning', en: `${f.tag} is not a MARC 21 bibliographic field.`, ar: `${f.tag} ليس حقلاً في مارك 21 الببليوغرافي.` });
    if (f.tag === '008' && isControl(f)) {
      for (const x of check008(f.data, record.leader)) issues.push({ line: at(i), tag: '008', level: 'warning', ...x });
    }
    if (!isControl(f)) {
      for (const [n, c] of [['first', f.ind1], ['second', f.ind2]] as const) {
        if (!/^[0-9 ]$/.test(c)) issues.push({ line: at(i), tag: f.tag, level: 'error', en: `${f.tag}: the ${n} indicator must be a digit or blank (#).`, ar: `${f.tag}: المؤشر ${n === 'first' ? 'الأول' : 'الثاني'} رقم أو فراغ (#).` });
      }
      if (!f.subfields.length || f.subfields.every(([, v]) => !hasText(v))) issues.push({ line: at(i), tag: f.tag, level: 'warning', en: `${f.tag} is empty.`, ar: `الحقل ${f.tag} فارغ.` });
    }
  });
  const title = record.fields.find((f): f is DataField => f.tag === '245' && !isControl(f));
  if (!title || !title.subfields.some(([c, v]) => c === 'a' && hasText(v))) issues.push({ line: 0, tag: '245', level: 'error', en: 'A title is required: 245 $a.', ar: 'العنوان مطلوب: 245 $a.' });
  if (ONE_MAIN_ENTRY.reduce((n, t) => n + (count.get(t) || 0), 0) > 1) issues.push({ line: 0, tag: '1XX', level: 'error', en: 'Only one main entry (100, 110, 111 or 130).', ar: 'مدخل رئيسي واحد فقط (100 أو 110 أو 111 أو 130).' });
  if (title && count.has('100') && title.ind1 === '0') issues.push({ line: at(record.fields.indexOf(title)), tag: '245', level: 'warning', en: '245 first indicator is 1 when there is a 100.', ar: 'المؤشر الأول لـ 245 هو 1 عند وجود 100.' });
  if (record.leader.length !== 24) issues.push({ line: 0, tag: 'LDR', level: 'warning', en: 'The leader has 24 characters.', ar: 'الفاتح 24 خانة.' });
  return issues.sort((a, b) => a.line - b.line);
}

/** MARC → the editor's Work and Instance, instantly. */
export function marcTextToBibframe(text: string): { bibframe: ImportedMarcRecord | null; issues: MarcLineIssue[]; record: MarcRecord } {
  const { record, issues, lineOf } = parseMarcText(text);
  const all = [...issues, ...checkMarc(record, lineOf)];
  let bibframe: ImportedMarcRecord | null = null;
  try {
    bibframe = marcToBibframe(record);
  } catch (e) {
    all.push({ line: 0, level: 'error', en: `Could not convert to BIBFRAME: ${(e as Error).message}`, ar: `تعذّر التحويل إلى BIBFRAME: ${(e as Error).message}` });
  }
  return { bibframe, issues: all, record };
}

/** A starting record for a printed book (RDA, Arabic), as a cataloguer's template. */
export const BOOK_TEMPLATE = [
  'LDR 00000nam\\a2200000\\i\\4500',
  '008 ' + '      s        iq            000 0 ara d'.replace(/ /g, '\\'),
  '020 ## $a ',
  '040 ## $a  $b ara $e rda $c ',
  '100 1# $a  $e author.',
  '245 10 $a  : $b  / $c ',
  '264 #1 $a  : $b  , $c ',
  '300 ## $a  ; $c ',
  '336 ## $a text $b txt $2 rdacontent',
  '337 ## $a unmediated $b n $2 rdamedia',
  '338 ## $a volume $b nc $2 rdacarrier',
  '650 #0 $a ',
].join('\n');

/** The MARC 21 block a tag belongs to, for colour and grouping (0XX control … 8XX links). */
export function tagBlock(tag: string): string {
  return /^\d/.test(tag) ? `${tag[0]}XX` : 'LDR';
}

/** Field names (English / Arabic) for the editor's labels; MARC 21 Bibliographic. */
export const FIELD_NAMES: Record<string, [string, string]> = {
  LDR: ['Leader', 'الفاتح'], '001': ['Control number', 'رقم الضبط'], '003': ['Control number identifier', 'معرف رقم الضبط'],
  '005': ['Date and time of latest transaction', 'تاريخ آخر تعديل'], '008': ['Fixed-length data elements', 'عناصر البيانات ثابتة الطول'],
  '010': ['LC control number', 'رقم ضبط مكتبة الكونغرس'], '020': ['ISBN', 'الردمك'], '022': ['ISSN', 'الردمد'], '024': ['Other standard identifier', 'معرف معياري آخر'],
  '035': ['System control number', 'رقم ضبط النظام'], '040': ['Cataloging source', 'مصدر الفهرسة'], '041': ['Language code', 'رمز اللغة'],
  '043': ['Geographic area code', 'رمز المنطقة الجغرافية'], '050': ['LC call number', 'رقم طلب الكونغرس'], '082': ['Dewey classification', 'تصنيف ديوي'],
  '100': ['Main entry — personal name', 'المدخل الرئيسي — اسم شخص'], '110': ['Main entry — corporate name', 'المدخل الرئيسي — هيئة'],
  '111': ['Main entry — meeting name', 'المدخل الرئيسي — مؤتمر'], '130': ['Main entry — uniform title', 'المدخل الرئيسي — عنوان موحد'],
  '240': ['Uniform title', 'العنوان الموحد'], '245': ['Title statement', 'بيان العنوان'], '246': ['Varying form of title', 'شكل آخر للعنوان'],
  '250': ['Edition statement', 'بيان الطبعة'], '260': ['Publication (older)', 'النشر (قديم)'], '264': ['Production, publication …', 'الإنتاج والنشر'],
  '300': ['Physical description', 'الوصف المادي'], '336': ['Content type', 'نوع المحتوى'], '337': ['Media type', 'نوع الوسيط'], '338': ['Carrier type', 'نوع الحامل'],
  '490': ['Series statement', 'بيان السلسلة'], '500': ['General note', 'ملاحظة عامة'], '502': ['Dissertation note', 'ملاحظة الأطروحة'],
  '504': ['Bibliography note', 'ملاحظة الببليوغرافيا'], '505': ['Contents note', 'ملاحظة المحتويات'], '520': ['Summary', 'الملخص'], '546': ['Language note', 'ملاحظة اللغة'],
  '600': ['Subject — personal name', 'موضوع — اسم شخص'], '610': ['Subject — corporate name', 'موضوع — هيئة'], '630': ['Subject — uniform title', 'موضوع — عنوان موحد'],
  '650': ['Subject — topical term', 'موضوع — مصطلح'], '651': ['Subject — geographic name', 'موضوع — اسم جغرافي'], '655': ['Genre/form', 'النوع/الشكل'],
  '700': ['Added entry — personal name', 'مدخل إضافي — اسم شخص'], '710': ['Added entry — corporate name', 'مدخل إضافي — هيئة'],
  '740': ['Added entry — related title', 'مدخل إضافي — عنوان'], '830': ['Series added entry — uniform title', 'مدخل إضافي للسلسلة'],
  '856': ['Electronic location and access', 'الموقع الإلكتروني'], '880': ['Alternate graphic representation', 'التمثيل بخط آخر'],
};

/** A field's name, from the full MARC 21 dictionary (the short names above win where they are given). */
export function fieldName(tag: string, ar: boolean): string {
  const n = FIELD_NAMES[tag];
  if (n) return n[ar ? 1 : 0];
  const d = fieldDef(tag);
  return d ? (ar ? d.ar : d.en) : '';
}

/** Re-export for the editor (fields as structured rows). */
export type { MarcRecord, MarcField, DataField, Subfield };
