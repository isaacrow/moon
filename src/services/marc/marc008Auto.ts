/**
 * The 008 filled from what the record already says, as the cataloguer types: the date and type of date from
 * 264/260 $c, the place from 264 $a, the language from 041 or the title's script, illustrations from 300 $b,
 * nature of contents from 502/504/6XX $v, conference from 111/611/711, index from the notes, literary form and
 * biography from the subjects and genres. A position the record says nothing about is left as it is, and so is
 * any position the cataloguer set by hand (`keep`).
 */
import type { DataField, MarcRecord } from './marcRecord';
import { isControl } from './marcRecord';
import { readDate } from '../hijri';

/** A date statement that gives a Hijri or solar Hijri year and no Gregorian one. */
const hijriOnly = (s: string) => { const r = readDate(s); return r.from !== undefined && r.gregorian === undefined; };

export interface Filled { start: number; length: number; value: string; en: string; ar: string }

const data = (r: MarcRecord, tags: RegExp) => r.fields.filter((f): f is DataField => !isControl(f) && tags.test(f.tag));
const subs = (f: DataField, codes: string) => f.subfields.filter(([c]) => codes.includes(c)).map(([, v]) => v);
const allText = (r: MarcRecord, tags: RegExp, codes: string) => data(r, tags).flatMap((f) => subs(f, codes)).join(' ').toLowerCase();

/** Eastern Arabic and Persian digits as ASCII. */
const asciiDigits = (s: string) => s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));

/**
 * The Gregorian years in a date statement, in order. A year followed by هـ / ه / AH is Hijri and is skipped
 * ("1445هـ / 2023م" gives 2023); so is any year before 1450, which in Arabic imprints is a Hijri year.
 */
export function gregorianYears(s: string): string[] {
  return [...asciiDigits(s).matchAll(/(?<!\d)(\d{4})(?!\d)(?!\s*(?:ه|ﻫ|a\.?\s?h\b))/gi)]
    .map((m) => m[1]).filter((y) => Number(y) >= 1450 && Number(y) <= new Date().getFullYear() + 1);
}

/** Cities and countries (Arabic and English) → MARC country code (3 characters, blank-padded). */
const PLACES: [RegExp, string][] = [
  [/بغداد|baghdad|النجف|najaf|كربلاء|karbala|البصرة|basra|الموصل|mosul|أربيل|اربيل|erbil|arbil|السليمانية|sulaymaniyah|الكوفة|kufa|الحلة|hilla|الكاظمية|سامراء|samarra|العراق|iraq/i, 'iq '],
  [/بيروت|beirut|صيدا|sidon|لبنان|lebanon/i, 'le '],
  [/القاهرة|cairo|الإسكندرية|الاسكندرية|alexandria|مصر|egypt|bulaq|بولاق/i, 'ua '],
  [/دمشق|damascus|حلب|aleppo|سوريا|سورية|syria/i, 'sy '],
  [/عمّان|عمان(?!\s*\(سلطنة)|amman|الأردن|jordan/i, 'jo '],
  [/الرياض|riyadh|جدة|jeddah|مكة|mecca|makkah|المدينة المنورة|medina|السعودية|saudi/i, 'su '],
  [/الكويت|kuwait/i, 'ku '],
  [/طهران|tehran|قم|qom|qum|مشهد|mashhad|إيران|ايران|iran/i, 'ir '],
  [/تونس|tunis/i, 'ti '],
  [/الرباط|rabat|الدار البيضاء|casablanca|فاس|fez|المغرب|morocco/i, 'mr '],
  [/الجزائر|algiers|algeria/i, 'ae '],
  [/الدوحة|doha|قطر|qatar/i, 'qa '],
  [/دبي|dubai|أبو ظبي|ابوظبي|abu dhabi|الشارقة|sharjah|الإمارات|emirates/i, 'ts '],
  [/مسقط|muscat|عُمان|oman/i, 'mk '],
  [/المنامة|manama|البحرين|bahrain/i, 'ba '],
  [/صنعاء|sanaa|عدن|aden|اليمن|yemen/i, 'ye '],
  [/الخرطوم|khartoum|السودان|sudan/i, 'sj '],
  [/طرابلس الغرب|بنغازي|benghazi|ليبيا|libya/i, 'ly '],
  [/إسطنبول|اسطنبول|istanbul|أنقرة|ankara|تركيا|turkey/i, 'tu '],
  [/لندن|london|oxford|cambridge|أكسفورد/i, 'enk'],
  [/نيويورك|new york/i, 'nyu'],
  [/باريس|paris|فرنسا|france/i, 'fr '],
  [/ليدن|leiden|amsterdam|هولندا/i, 'ne '],
  [/برلين|berlin|leipzig|لايبزيغ|ألمانيا|germany/i, 'gw '],
];

const ILLUSTRATION_WORDS: [RegExp, string][] = [
  [/illustration|\bill\b|\bills\b|إيضاح|رسوم/i, 'a'], [/\bmaps?\b|خرائط|خريطة/i, 'b'], [/portrait|صور شخصية/i, 'c'],
  [/chart|رسوم بيانية|جداول بيانية/i, 'd'], [/plans?\b|مخططات/i, 'e'], [/plates?\b|لوحات/i, 'f'], [/music|نوتة/i, 'g'],
  [/facsim|صور طبق الأصل|نماذج من المخطوط/i, 'h'], [/coats? of arms|شعارات/i, 'i'], [/genealog|أنساب|شجرة/i, 'j'],
  [/forms?\b|استمارات/i, 'k'], [/photo|صور فوتوغرافية|صور ملونة/i, 'o'], [/illumination|زخارف|مذهب/i, 'p'],
];

const LITERARY: [RegExp, string][] = [
  [/\bnovels?\b|روايات|رواية/i, 'f'], [/short stories|قصص قصيرة/i, 'j'], [/poetry|(^|\s)(ال)?شعر(\s|$)|دواوين|ديوان/i, 'p'], [/drama|مسرحيات|مسرحية/i, 'd'],
  [/essays|مقالات/i, 'e'], [/letters|correspondence|(^|\s)رسائل(?!\s*جامعية)/i, 'i'], [/humor|satire|فكاهة|هجاء/i, 'h'], [/speeches|خطب/i, 's'],
  [/comic|graphic novel|قصص مصورة/i, 'c'], [/\bfiction\b|قصص|أدب خيالي/i, '1'],
];

/** The 008 positions the record speaks for. */
export function derive008(r: MarcRecord): Filled[] {
  const out: Filled[] = [];
  const put = (start: number, value: string, en: string, ar: string) => out.push({ start, length: value.length, value, en, ar });

  // ---- Dates (06, 07-10, 11-14) from 264 _1 $c, else 260 $c, else 264 _4 (copyright) ----
  const pub = data(r, /^264$/).find((f) => f.ind2 === '1') || data(r, /^260$/)[0];
  const copyright = data(r, /^264$/).find((f) => f.ind2 === '4');
  const dateText = asciiDigits([pub && subs(pub, 'c').join(' '), copyright && subs(copyright, 'c').join(' ')].filter(Boolean).join(' '));
  if (dateText.trim()) {
    const years = gregorianYears(dateText);
    const pubYear = pub ? gregorianYears(subs(pub, 'c').join(' '))[0] : undefined;
    const copyYear = copyright ? gregorianYears(subs(copyright, 'c').join(' '))[0] : undefined;
    const decade = dateText.match(/\b(1[4-9]|20)(\d)-(?:-|\?)/);
    if (pubYear && copyYear && pubYear !== copyYear) { put(6, 't', 'Publication and copyright date', 'تاريخ النشر وتاريخ حقوق النشر'); put(7, pubYear, 'Date 1', 'التاريخ 1'); put(11, copyYear, 'Date 2', 'التاريخ 2'); }
    else if (/\[[^\]]*\?\s*\]|\?/.test(dateText) && (pubYear || years[0])) { put(6, 'q', 'Questionable date', 'تاريخ مشكوك فيه'); put(7, pubYear || years[0], 'Date 1', 'التاريخ 1'); put(11, pubYear || years[0], 'Date 2', 'التاريخ 2'); }
    else if (pubYear || years[0]) { put(6, 's', 'Single known date', 'تاريخ واحد معروف'); put(7, pubYear || years[0], 'Date 1', 'التاريخ 1'); put(11, '    ', 'Date 2', 'التاريخ 2'); }
    else if (hijriOnly(dateText)) {
      // Only a Hijri (or solar Hijri) year: its Gregorian years, as LC codes "1445 [2023 or 2024]".
      const h = readDate(dateText);
      const [from, to] = [String(h.from).padStart(4, '0'), String(h.to).padStart(4, '0')];
      if (from === to) { put(6, 's', 'Single known date', 'تاريخ واحد معروف'); put(7, from, 'Date 1', 'التاريخ 1'); put(11, '    ', 'Date 2', 'التاريخ 2'); }
      else { put(6, 'q', 'Hijri year: one of two Gregorian years', 'سنة هجرية: إحدى سنتين ميلاديتين'); put(7, from, 'Date 1', 'التاريخ 1'); put(11, to, 'Date 2', 'التاريخ 2'); }
    }
    else if (decade) { put(6, 'q', 'Questionable date', 'تاريخ مشكوك فيه'); put(7, `${decade[1]}${decade[2]}u`, 'Date 1', 'التاريخ 1'); put(11, '    ', 'Date 2', 'التاريخ 2'); }
  }

  // ---- Place (15-17) from the first place of publication ----
  const placeText = pub ? subs(pub, 'a').join(' ') : '';
  const country = PLACES.find(([re]) => re.test(placeText))?.[1];
  if (country) put(15, country, 'Place of publication', 'مكان النشر');
  else if (/\[?s\.\s?l\.|د\.\s?م|\[مكان النشر غير معروف\]|place of publication not identified/i.test(placeText)) put(15, 'xx ', 'Place unknown', 'مكان النشر مجهول');

  // ---- Books positions (only for language material) ----
  const books = /^[at]$/.test(r.leader[6] || 'a') && !/^[bis]$/.test(r.leader[7] || 'm');
  if (books) {
    const physical = allText(r, /^300$/, 'b');
    const ill = ILLUSTRATION_WORDS.filter(([re]) => re.test(physical)).map(([, c]) => c);
    if (data(r, /^300$/).length) put(18, [...new Set(ill)].slice(0, 4).join('').padEnd(4, ' '), 'Illustrations', 'الإيضاحات');

    const forms = allText(r, /^(6\d\d)$/, 'avx') + ' ' + allText(r, /^655$/, 'a');
    const contents: string[] = [];
    if (data(r, /^504$/).length || /bibliograph|ببليوغراف/.test(forms)) contents.push('b');
    if (data(r, /^502$/).length || /dissertation|thesis|رسائل جامعية|أطروحات/.test(forms)) contents.push('m');
    if (/dictionar|معاجم|قواميس/.test(forms)) contents.push('d');
    if (/encyclop|موسوعات/.test(forms)) contents.push('e');
    if (/catalog|فهارس المخطوطات|فهارس/.test(forms)) contents.push('c');
    if (/statistics|إحصاءات/.test(forms)) contents.push('s');
    if (/indexes|كشافات/.test(forms)) contents.push('i');
    if (/yearbook|حوليات/.test(forms)) contents.push('y');
    if (/handbook|manual|أدلة/.test(forms)) contents.push('f');
    put(24, [...new Set(contents)].slice(0, 4).join('').padEnd(4, ' '), 'Nature of contents', 'طبيعة المحتوى');

    put(29, data(r, /^(111|611|711)$/).length ? '1' : '0', 'Conference publication', 'منشور مؤتمر');
    const notes = allText(r, /^(500|504|505)$/, 'a') + ' ' + allText(r, /^300$/, 'a');
    put(31, /\bindex|indexes|كشاف|فهارس|الفهارس/.test(notes) ? '1' : '0', 'Index', 'الكشاف');

    const literary = LITERARY.find(([re]) => re.test(forms))?.[1];
    if (literary) put(33, literary, 'Literary form', 'الشكل الأدبي');
    else if (data(r, /^(6\d\d)$/).length) put(33, '0', 'Literary form', 'الشكل الأدبي');

    if (/autobiograph|سيرة ذاتية|مذكرات/.test(forms)) put(34, 'a', 'Biography', 'السيرة');
    else if (/biography|(^|\s)(تراجم|سير|السير)(\s|$)/.test(forms)) put(34, data(r, /^600$/).length > 1 ? 'c' : 'b', 'Biography', 'السيرة');
    else if (data(r, /^600$/).length) put(34, 'd', 'Biography', 'السيرة');

    const online = /online resource|مصدر على الخط/.test(allText(r, /^338$/, 'a')) || allText(r, /^338$/, 'b').includes('cr');
    if (online) put(23, 'o', 'Form of item', 'شكل المادة');
  }

  // ---- Language (35-37): 041 $a, else the title's script ----
  const f041 = (allText(r, /^041$/, 'a').match(/[a-z]{3}/) || [])[0];
  const title = data(r, /^245$/).flatMap((f) => subs(f, 'ab')).join(' ');
  const lang = f041 || (/[؀-ۿ]/.test(title) ? 'ara' : /[a-z]{3}/i.test(title) ? 'eng' : '');
  if (lang) put(35, lang, 'Language', 'اللغة');
  return out;
}

/**
 * The 008 with every position the record speaks for filled, except the positions in `keep`; the date
 * entered (00-05) is set once, if empty. Returns the new 008 and what changed.
 */
export function autoFill008(current: string, r: MarcRecord, keep: Set<number> = new Set(), now = new Date()): { value: string; changed: Filled[] } {
  let v = current.padEnd(40, ' ').slice(0, 40);
  const changed: Filled[] = [];
  const write = (f: Filled) => {
    if ([...keep].some((k) => k >= f.start && k < f.start + f.length)) return;
    if (v.slice(f.start, f.start + f.length) === f.value) return;
    v = v.slice(0, f.start) + f.value + v.slice(f.start + f.length);
    changed.push(f);
  };
  if (!/^\d{6}$/.test(v.slice(0, 6))) write({ start: 0, length: 6, value: now.toISOString().slice(2, 10).replace(/-/g, ''), en: 'Date entered', ar: 'تاريخ الإدخال' });
  for (const f of derive008(r)) write(f);
  return { value: v, changed };
}

/** Which positions differ between two 008s (to remember what the cataloguer set by hand). */
export function changedPositions(before: string, after: string): number[] {
  const a = before.padEnd(40, ' '), b = after.padEnd(40, ' ');
  return Array.from({ length: 40 }, (_, i) => i).filter((i) => a[i] !== b[i]);
}
