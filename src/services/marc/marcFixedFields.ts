/**
 * The Leader and 008 position by position, for the MARC editor's guided form: what each position means and
 * the codes it takes (MARC 21 Bibliographic, https://www.loc.gov/marc/bibliographic/bdleader.html and
 * bd008.html). 008/18-34 are defined for books (leader/06 a or t); other materials keep those positions as
 * typed. A blank is ' ' (shown as #); '|' means "no attempt to code".
 */

export interface Code { code: string; en: string; ar: string }
export interface Position {
  /** First position, and how many characters it holds. */
  start: number;
  length: number;
  en: string;
  ar: string;
  /** The codes this position takes; none means free text (a date, a country or language code). */
  codes?: Code[];
  /** A repeated code position (008/18-21 illustrations, 24-27 contents): each character is one code. */
  multi?: boolean;
  hint?: string;
}

const c = (code: string, en: string, ar: string): Code => ({ code, en, ar });
const NO_ATTEMPT = c('|', 'No attempt to code', 'لم يُرمَّز');

export const LEADER_POSITIONS: Position[] = [
  { start: 0, length: 5, en: 'Record length', ar: 'طول التسجيلة', hint: 'Computed by the system' },
  { start: 5, length: 1, en: 'Record status', ar: 'حالة التسجيلة', codes: [
    c('n', 'New', 'جديدة'), c('c', 'Corrected or revised', 'مصححة أو منقحة'), c('a', 'Increase in encoding level', 'رفع مستوى الترميز'),
    c('p', 'Increase from prepublication', 'رفع من ما قبل النشر'), c('d', 'Deleted', 'محذوفة')] },
  { start: 6, length: 1, en: 'Type of record', ar: 'نوع التسجيلة', codes: [
    c('a', 'Language material', 'مادة لغوية (كتاب)'), c('t', 'Manuscript language material', 'مخطوط'), c('c', 'Notated music', 'موسيقى مدونة'),
    c('d', 'Manuscript notated music', 'موسيقى مدونة مخطوطة'), c('e', 'Cartographic material', 'مادة خرائطية'), c('f', 'Manuscript cartographic material', 'خريطة مخطوطة'),
    c('g', 'Projected medium', 'وسيط معروض (فيلم، فيديو)'), c('i', 'Nonmusical sound recording', 'تسجيل صوتي غير موسيقي'), c('j', 'Musical sound recording', 'تسجيل صوتي موسيقي'),
    c('k', 'Two-dimensional nonprojectable graphic', 'صورة ثنائية الأبعاد'), c('m', 'Computer file', 'ملف حاسوبي'), c('o', 'Kit', 'مجموعة مواد'),
    c('p', 'Mixed materials', 'مواد مختلطة'), c('r', 'Three-dimensional artifact or naturally occurring object', 'مجسم ثلاثي الأبعاد')] },
  { start: 7, length: 1, en: 'Bibliographic level', ar: 'المستوى الببليوغرافي', codes: [
    c('m', 'Monograph/Item', 'كتاب أحادي/مادة'), c('s', 'Serial', 'دورية'), c('i', 'Integrating resource', 'مصدر متكامل'),
    c('a', 'Monographic component part', 'جزء من كتاب'), c('b', 'Serial component part', 'جزء من دورية'), c('c', 'Collection', 'مجموعة'), c('d', 'Subunit', 'وحدة فرعية')] },
  { start: 8, length: 1, en: 'Type of control', ar: 'نوع الضبط', codes: [c(' ', 'No specified type', 'غير محدد'), c('a', 'Archival', 'أرشيفي')] },
  { start: 9, length: 1, en: 'Character coding scheme', ar: 'ترميز المحارف', codes: [c('a', 'UCS/Unicode', 'يونيكود'), c(' ', 'MARC-8', 'MARC-8')] },
  { start: 10, length: 2, en: 'Indicator count / subfield code count', ar: 'عدد المؤشرات / طول رمز الحقل الفرعي', hint: 'Always 22' },
  { start: 12, length: 5, en: 'Base address of data', ar: 'عنوان بداية البيانات', hint: 'Computed by the system' },
  { start: 17, length: 1, en: 'Encoding level', ar: 'مستوى الترميز', codes: [
    c(' ', 'Full level', 'كامل'), c('1', 'Full level, material not examined', 'كامل، المادة لم تُفحص'), c('2', 'Less-than-full level, material not examined', 'أقل من كامل، لم تُفحص'),
    c('3', 'Abbreviated level', 'مختصر'), c('4', 'Core level', 'أساسي'), c('5', 'Partial (preliminary) level', 'جزئي (أولي)'), c('7', 'Minimal level', 'أدنى'),
    c('8', 'Prepublication level', 'ما قبل النشر'), c('u', 'Unknown', 'غير معروف'), c('z', 'Not applicable', 'لا ينطبق')] },
  { start: 18, length: 1, en: 'Descriptive cataloging form', ar: 'شكل الفهرسة الوصفية', codes: [
    c('i', 'ISBD punctuation included', 'ترقيم تدوب موجود'), c('a', 'AACR 2', 'قواعد AACR2'), c('c', 'ISBD punctuation omitted', 'ترقيم تدوب محذوف'),
    c('n', 'Non-ISBD punctuation omitted', 'ترقيم غير تدوب محذوف'), c(' ', 'Non-ISBD', 'غير تدوب'), c('u', 'Unknown', 'غير معروف')] },
  { start: 19, length: 1, en: 'Multipart resource record level', ar: 'مستوى تسجيلة المصدر متعدد الأجزاء', codes: [
    c(' ', 'Not specified or not applicable', 'غير محدد أو لا ينطبق'), c('a', 'Set', 'مجموعة'), c('b', 'Part with independent title', 'جزء بعنوان مستقل'), c('c', 'Part with dependent title', 'جزء بعنوان تابع')] },
  { start: 20, length: 4, en: 'Entry map', ar: 'خريطة المداخل', hint: 'Always 4500' },
];

const ILLUSTRATIONS = [
  c(' ', 'No illustrations', 'بلا إيضاحات'), c('a', 'Illustrations', 'إيضاحات'), c('b', 'Maps', 'خرائط'), c('c', 'Portraits', 'صور شخصية'), c('d', 'Charts', 'رسوم بيانية'),
  c('e', 'Plans', 'مخططات'), c('f', 'Plates', 'لوحات'), c('g', 'Music', 'نوتات موسيقية'), c('h', 'Facsimiles', 'صور طبق الأصل'), c('i', 'Coats of arms', 'شعارات'),
  c('j', 'Genealogical tables', 'جداول أنساب'), c('k', 'Forms', 'نماذج'), c('l', 'Samples', 'عينات'), c('m', 'Phonodisc, phonowire, etc.', 'أسطوانات صوتية'),
  c('o', 'Photographs', 'صور فوتوغرافية'), c('p', 'Illuminations', 'زخارف مذهبة'), NO_ATTEMPT,
];
const CONTENTS = [
  c(' ', 'No specified nature of contents', 'غير محدد'), c('a', 'Abstracts/summaries', 'مستخلصات'), c('b', 'Bibliographies', 'ببليوغرافيات'), c('c', 'Catalogs', 'فهارس'),
  c('d', 'Dictionaries', 'معاجم'), c('e', 'Encyclopedias', 'موسوعات'), c('f', 'Handbooks', 'أدلة'), c('g', 'Legal articles', 'مقالات قانونية'), c('i', 'Indexes', 'كشافات'),
  c('j', 'Patent document', 'براءة اختراع'), c('k', 'Discographies', 'قوائم تسجيلات'), c('l', 'Legislation', 'تشريعات'), c('m', 'Theses', 'رسائل جامعية'),
  c('n', 'Surveys of literature in a subject area', 'مراجعات أدبيات'), c('o', 'Reviews', 'عروض ومراجعات'), c('p', 'Programmed texts', 'نصوص مبرمجة'),
  c('q', 'Filmographies', 'قوائم أفلام'), c('r', 'Directories', 'أدلة عناوين'), c('s', 'Statistics', 'إحصاءات'), c('t', 'Technical reports', 'تقارير فنية'),
  c('u', 'Standards/specifications', 'مواصفات ومعايير'), c('v', 'Legal cases and case notes', 'قضايا قانونية'), c('w', 'Law reports and digests', 'تقارير قانونية'),
  c('y', 'Yearbooks', 'حوليات'), c('z', 'Treaties', 'معاهدات'), c('2', 'Offprints', 'مستلات'), c('5', 'Calendars', 'تقاويم'), c('6', 'Comics/graphic novels', 'قصص مصورة'), NO_ATTEMPT,
];

export const F008_ALL_START: Position[] = [
  { start: 0, length: 6, en: 'Date entered on file (yymmdd)', ar: 'تاريخ الإدخال (سسششيي)', hint: 'yymmdd' },
  { start: 6, length: 1, en: 'Type of date/Publication status', ar: 'نوع التاريخ/حالة النشر', codes: [
    c('s', 'Single known date/probable date', 'تاريخ واحد معروف أو محتمل'), c('m', 'Multiple dates', 'تواريخ متعددة'), c('r', 'Reprint/reissue date and original date', 'تاريخ إعادة الطبع والتاريخ الأصلي'),
    c('t', 'Publication date and copyright date', 'تاريخ النشر وتاريخ حقوق النشر'), c('q', 'Questionable date', 'تاريخ مشكوك فيه'), c('n', 'Dates unknown', 'التواريخ مجهولة'),
    c('e', 'Detailed date', 'تاريخ مفصل'), c('i', 'Inclusive dates of collection', 'تواريخ شاملة للمجموعة'), c('k', 'Range of years of bulk of collection', 'مدى سنوات معظم المجموعة'),
    c('p', 'Date of distribution/release/issue and production/recording session', 'تاريخ التوزيع وتاريخ الإنتاج'), c('b', 'No dates given; B.C. date involved', 'لا تواريخ؛ قبل الميلاد'),
    c('c', 'Continuing resource currently published', 'دورية مستمرة'), c('d', 'Continuing resource ceased publication', 'دورية متوقفة'), c('u', 'Continuing resource status unknown', 'حالة الدورية مجهولة'), NO_ATTEMPT] },
  { start: 7, length: 4, en: 'Date 1', ar: 'التاريخ 1', hint: 'yyyy, u for unknown digits (19uu)' },
  { start: 11, length: 4, en: 'Date 2', ar: 'التاريخ 2', hint: 'yyyy, or blank' },
  { start: 15, length: 3, en: 'Place of publication, production, or execution', ar: 'مكان النشر (رمز البلد)', hint: 'MARC country code: iq, le, sy, ua, xx (unknown) …' },
];

export const F008_BOOKS: Position[] = [
  { start: 18, length: 4, en: 'Illustrations (up to four)', ar: 'الإيضاحات (حتى أربعة)', codes: ILLUSTRATIONS, multi: true },
  { start: 22, length: 1, en: 'Target audience', ar: 'الجمهور المستهدف', codes: [
    c(' ', 'Unknown or not specified', 'غير محدد'), c('a', 'Preschool', 'ما قبل المدرسة'), c('b', 'Primary', 'ابتدائي'), c('c', 'Pre-adolescent', 'ما قبل المراهقة'),
    c('d', 'Adolescent', 'مراهقون'), c('e', 'Adult', 'بالغون'), c('f', 'Specialized', 'متخصص'), c('g', 'General', 'عام'), c('j', 'Juvenile', 'أطفال وناشئة'), NO_ATTEMPT] },
  { start: 23, length: 1, en: 'Form of item', ar: 'شكل المادة', codes: [
    c(' ', 'None of the following (regular print)', 'مطبوع عادي'), c('a', 'Microfilm', 'ميكروفيلم'), c('b', 'Microfiche', 'ميكروفيش'), c('c', 'Microopaque', 'ميكرو معتم'),
    c('d', 'Large print', 'حروف كبيرة'), c('f', 'Braille', 'برايل'), c('o', 'Online', 'على الخط'), c('q', 'Direct electronic', 'إلكتروني مباشر'),
    c('r', 'Regular print reproduction', 'نسخة مطبوعة مستنسخة'), c('s', 'Electronic', 'إلكتروني'), NO_ATTEMPT] },
  { start: 24, length: 4, en: 'Nature of contents (up to four)', ar: 'طبيعة المحتوى (حتى أربعة)', codes: CONTENTS, multi: true },
  { start: 28, length: 1, en: 'Government publication', ar: 'مطبوع حكومي', codes: [
    c(' ', 'Not a government publication', 'ليس مطبوعاً حكومياً'), c('f', 'Federal/national', 'وطني/اتحادي'), c('s', 'State, provincial, territorial, dependent, etc.', 'محافظة أو إقليم'),
    c('l', 'Local', 'محلي'), c('m', 'Multistate', 'عدة محافظات'), c('c', 'Multilocal', 'عدة جهات محلية'), c('i', 'International intergovernmental', 'دولي حكومي'),
    c('a', 'Autonomous or semi-autonomous component', 'جهة مستقلة أو شبه مستقلة'), c('z', 'Other', 'أخرى'), c('o', 'Government publication — level undetermined', 'حكومي — المستوى غير محدد'),
    c('u', 'Unknown if item is government publication', 'غير معروف'), NO_ATTEMPT] },
  { start: 29, length: 1, en: 'Conference publication', ar: 'منشور مؤتمر', codes: [c('0', 'Not a conference publication', 'ليس منشور مؤتمر'), c('1', 'Conference publication', 'منشور مؤتمر'), NO_ATTEMPT] },
  { start: 30, length: 1, en: 'Festschrift', ar: 'كتاب تذكاري', codes: [c('0', 'Not a festschrift', 'ليس كتاباً تذكارياً'), c('1', 'Festschrift', 'كتاب تذكاري'), NO_ATTEMPT] },
  { start: 31, length: 1, en: 'Index', ar: 'الكشاف', codes: [c('0', 'No index', 'بلا كشاف'), c('1', 'Index present', 'فيه كشاف'), NO_ATTEMPT] },
  { start: 32, length: 1, en: 'Undefined', ar: 'غير معرّف', codes: [c(' ', 'Undefined', 'غير معرّف'), NO_ATTEMPT] },
  { start: 33, length: 1, en: 'Literary form', ar: 'الشكل الأدبي', codes: [
    c('0', 'Not fiction (not further specified)', 'ليس أدباً خيالياً'), c('1', 'Fiction (not further specified)', 'أدب خيالي'), c('c', 'Comic strips', 'قصص مصورة'),
    c('d', 'Dramas', 'مسرحيات'), c('e', 'Essays', 'مقالات'), c('f', 'Novels', 'روايات'), c('h', 'Humor, satires, etc.', 'فكاهة وهجاء'), c('i', 'Letters', 'رسائل'),
    c('j', 'Short stories', 'قصص قصيرة'), c('m', 'Mixed forms', 'أشكال مختلطة'), c('p', 'Poetry', 'شعر'), c('s', 'Speeches', 'خطب'), c('u', 'Unknown', 'غير معروف'), NO_ATTEMPT] },
  { start: 34, length: 1, en: 'Biography', ar: 'السيرة', codes: [
    c(' ', 'No biographical material', 'لا سيرة'), c('a', 'Autobiography', 'سيرة ذاتية'), c('b', 'Individual biography', 'سيرة فرد'),
    c('c', 'Collective biography', 'تراجم جماعية'), c('d', 'Contains biographical information', 'فيه معلومات سيرية'), NO_ATTEMPT] },
];

/** 008/18-34 for material other than books: kept as typed, in one box. */
export const F008_OTHER: Position[] = [
  { start: 18, length: 17, en: 'Material-specific positions (18–34)', ar: 'خانات خاصة بنوع المادة (18–34)', hint: 'See the MARC 21 008 section for this type of material' },
];

export const F008_ALL_END: Position[] = [
  { start: 35, length: 3, en: 'Language', ar: 'اللغة', hint: 'MARC language code: ara, eng, per, tur, kur, fre …' },
  { start: 38, length: 1, en: 'Modified record', ar: 'تسجيلة معدلة', codes: [
    c(' ', 'Not modified', 'غير معدلة'), c('d', 'Dashed-on information omitted', 'حذفت معلومات'), c('o', 'Completely romanized/printed cards romanized', 'مُرَوْمَنة بالكامل'),
    c('r', 'Completely romanized/printed cards in script', 'مُرَوْمَنة، والبطاقات بالخط الأصلي'), c('s', 'Shortened', 'مختصرة'), c('x', 'Missing characters', 'محارف ناقصة'), NO_ATTEMPT] },
  { start: 39, length: 1, en: 'Cataloging source', ar: 'مصدر الفهرسة', codes: [
    c(' ', 'National bibliographic agency', 'وكالة ببليوغرافية وطنية'), c('c', 'Cooperative cataloging program', 'برنامج فهرسة تعاونية'),
    c('d', 'Other', 'أخرى (مكتبة)'), c('u', 'Unknown', 'غير معروف'), NO_ATTEMPT] },
];

/** The 008 positions for a record of this leader: books in full, other material with 18-34 as one box. */
export function f008Positions(leader: string): Position[] {
  const books = /^[at]$/.test(leader[6] || 'a') && !/^[bis]$/.test(leader[7] || 'm');
  return [...F008_ALL_START, ...(books ? F008_BOOKS : F008_OTHER), ...F008_ALL_END];
}

/** A value with one position changed (padded to the field's length). */
export function setPosition(value: string, p: Position, next: string, total: number): string {
  const v = value.padEnd(total, ' ').slice(0, total);
  const part = next.padEnd(p.length, ' ').slice(0, p.length);
  return v.slice(0, p.start) + part + v.slice(p.start + p.length);
}

export const getPosition = (value: string, p: Position) => value.padEnd(p.start + p.length, ' ').slice(p.start, p.start + p.length);

/** What is wrong with a 008 for this leader: its length, and codes a position does not take. */
export function check008(value: string, leader: string): { en: string; ar: string }[] {
  const out: { en: string; ar: string }[] = [];
  if (value.length !== 40) out.push({ en: `008 has ${value.length} characters; it needs 40.`, ar: `في 008 ${value.length} خانة؛ المطلوب 40.` });
  for (const p of f008Positions(leader)) {
    if (!p.codes) continue;
    const v = getPosition(value, p);
    const chars = p.multi ? [...v] : [v];
    for (const ch of chars) {
      if (!p.codes.some((x) => x.code === ch)) out.push({ en: `008/${String(p.start).padStart(2, '0')} ${p.en}: "${ch === ' ' ? '#' : ch}" is not a code here.`, ar: `008/${String(p.start).padStart(2, '0')} ${p.ar}: «${ch === ' ' ? '#' : ch}» ليس رمزاً صالحاً هنا.` });
    }
  }
  return out;
}

/** A fresh 008 for a printed book: entered today, a single date, the place and language given. */
export function new008(opts: { date1?: string; country?: string; language?: string; now?: Date } = {}): string {
  const now = opts.now || new Date();
  const entered = now.toISOString().slice(2, 10).replace(/-/g, '');
  const date1 = (opts.date1 || '').padEnd(4, 'u').slice(0, 4);
  return `${entered}${opts.date1 ? 's' : 'n'}${opts.date1 ? date1 : 'uuuu'}    ${(opts.country || 'xx').padEnd(3, ' ').slice(0, 3)}           000 0 ${(opts.language || 'ara').slice(0, 3)} d`;
}
