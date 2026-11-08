/**
 * Checks a record before it is saved, in three levels and plain words (Phase 13 S17), after the BIBFRAME
 * Interoperability Group's core (BIG / PCC): what every shared record carries.
 * - must: without it the record cannot be found or shared (a title). Saving stops until it is fixed.
 * - should: core data a cataloguer is expected to give (content, media and carrier types, language, date,
 *   publisher or place, extent, a name). Saving asks first.
 * - note: what would make it better (a subject, a class number, an identifier, linked names, the ALA-LC
 *   romanization of an Arabic title). Shown, never in the way.
 * Kept free of React so the tests can run it.
 */

export type CheckLevel = 'must' | 'should' | 'note';
export interface SaveCheck { level: CheckLevel; field: string; en: string; ar: string }

const all = (v: any): any[] => (v === undefined || v === null || v === '' ? [] : Array.isArray(v) ? v : [v]);
const get = (n: any, k: string): any[] => all(n?.[`bf:${k}`] ?? n?.[`http://id.loc.gov/ontologies/bibframe/${k}`]);
function text(v: any): string {
  if (v === undefined || v === null) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v).trim();
  if (Array.isArray(v)) return v.map(text).find(Boolean) || '';
  if (v['@value'] !== undefined) return String(v['@value']).trim();
  for (const k of ['bf:mainTitle', 'rdfs:label', 'rdf:value', 'bflc:simpleDate', 'bflc:simplePlace', 'bflc:simpleAgent', 'bf:code']) {
    const t = text(v[k]);
    if (t) return t;
  }
  if (typeof v['@id'] === 'string') return v['@id'];
  // Any other value the node holds (a class number in bf:classificationPortion, a code …).
  for (const [k, x] of Object.entries(v)) if (!k.startsWith('@') && typeof x !== 'object') { const t = text(x); if (t) return t; }
  return '';
}
const has = (n: any, k: string) => get(n, k).some((x) => text(x));
const ARABIC = /[؀-ۿ]/;

export function saveChecks(work: any, instance: any): SaveCheck[] {
  const out: SaveCheck[] = [];
  const add = (level: CheckLevel, field: string, en: string, ar: string) => out.push({ level, field, en, ar });

  // ---- must ----
  const titles = [...get(instance, 'title'), ...get(work, 'title')];
  const mainTitles = titles.flatMap((t) => [text(t?.['bf:mainTitle']), typeof t === 'string' ? t : '']).filter(Boolean);
  if (!mainTitles.length) add('must', 'title', 'A title is needed: the record cannot be found without one.', 'العنوان مطلوب: لا يمكن العثور على التسجيلة بدونه.');

  // ---- should ----
  if (!has(work, 'content')) add('should', 'content', 'No content type (text, still image …).', 'لا نوع للمحتوى (نص، صورة ثابتة …).');
  if (!has(instance, 'media')) add('should', 'media', 'No media type (unmediated, computer …).', 'لا نوع للوسيط (بلا وسيط، حاسوب …).');
  if (!has(instance, 'carrier')) add('should', 'carrier', 'No carrier type (volume, online resource …).', 'لا نوع للحامل (مجلد، مصدر على الخط …).');
  if (!has(work, 'language')) add('should', 'language', 'No language for the Work.', 'لا لغة للعمل.');
  const provisions = get(instance, 'provisionActivity');
  const dated = provisions.some((p) => text(get(p, 'date')) || text(p?.['bflc:simpleDate']));
  if (!dated) add('should', 'date', 'No date of publication (use [date of publication not identified] if unknown).', 'لا تاريخ للنشر (اكتب [تاريخ النشر غير معروف] إن جُهل).');
  const placed = provisions.some((p) => text(get(p, 'agent')) || text(get(p, 'place')) || text(p?.['bflc:simpleAgent']) || text(p?.['bflc:simplePlace']));
  if (!placed) add('should', 'publisher', 'No publisher or place of publication.', 'لا ناشر ولا مكان للنشر.');
  if (!has(instance, 'extent')) add('should', 'extent', 'No extent (e.g. 180 pages).', 'لا وصف مادي (مثل 180 صفحة).');
  const contributions = get(work, 'contribution');
  if (!contributions.some((c) => text(get(c, 'agent')))) add('should', 'contribution', 'No author or other name.', 'لا مؤلف ولا اسم آخر.');

  // ---- note ----
  if (!has(work, 'subject')) add('note', 'subject', 'No subject: readers find it by subject too.', 'لا موضوع: يبحث القرّاء بالموضوع أيضاً.');
  if (!has(work, 'classification') && !has(instance, 'classification')) add('note', 'classification', 'No class number (LC or Dewey).', 'لا رقم تصنيف (الكونغرس أو ديوي).');
  if (!has(instance, 'identifiedBy')) add('note', 'identifiedBy', 'No identifier (ISBN, ISSN, LCCN …).', 'لا معرّف (ردمك، ردمد، LCCN …).');
  const unlinked = contributions.map((c) => get(c, 'agent')[0]).filter((a) => text(a) && !(typeof a?.['@id'] === 'string' && /^https?:\/\//.test(a['@id'])));
  if (unlinked.length) add('note', 'contribution', `${unlinked.length} name(s) not linked to an entity.`, `${unlinked.length} من الأسماء غير مربوطة بكيان.`);
  const arabicOnly = mainTitles.length > 0 && mainTitles.every((t) => ARABIC.test(t));
  if (arabicOnly) add('note', 'title', 'The title is in Arabic only: add its ALA-LC romanization.', 'العنوان بالعربية فقط: أضف صيغته اللاتينية (ALA-LC).');
  return out;
}

/** One list for a dialog: "• …" per check, in the reader's language. */
export function checksText(checks: SaveCheck[], ar: boolean): string {
  return checks.map((c) => `• ${ar ? c.ar : c.en}`).join('\n');
}
