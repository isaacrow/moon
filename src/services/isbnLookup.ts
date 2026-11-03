/**
 * ISBN normalization and multi-source lookup for the editor's ISBN auto-fill.
 *
 * - Accepts ISBNs as people type or paste them: hyphens, spaces, "ISBN" prefixes, and
 *   Arabic-Indic (٠١٢…) or Eastern Arabic-Indic (۰۱۲…) digits.
 * - Validates the check digit and derives the other form (ISBN-10 <-> ISBN-13).
 * - Asks Open Library (which also holds Arabic-script books) and Google Books in parallel and merges
 *   field by field, remembering which source each value came from.
 *
 * LC's own services do not answer ISBN queries publicly (id.loc.gov suggest2 does not index ISBNs and
 * the LC SRU isbn index returns nothing), so they are not queried here.
 */

export interface IsbnInfo {
  /** What the user entered. */
  input: string;
  /** Digits (and a final X) only, with Arabic-Indic digits converted. */
  digits: string;
  valid: boolean;
  isbn10?: string;
  isbn13?: string;
  /** Why the ISBN is not valid, for display. */
  problem?: 'empty' | 'length' | 'checksum';
}

export type IsbnSource = 'Open Library' | 'Google Books';

export interface IsbnRecord {
  isbn10?: string;
  isbn13?: string;
  title?: string;
  subtitle?: string;
  authors: string[];
  publisher?: string;
  place?: string;
  /** Four-digit year when one can be found, otherwise the source's text. */
  date?: string;
  pages?: number;
  /** MARC language code (e.g. "ara"), usable as an id.loc.gov/vocabulary/languages/ code. */
  language?: string;
  /** Which source supplied each field. */
  sources: Partial<Record<Exclude<keyof IsbnRecord, 'sources' | 'foundIn'>, IsbnSource>>;
  /** Every source that knew the ISBN. */
  foundIn: IsbnSource[];
}

export interface IsbnLookupResult {
  isbn: IsbnInfo;
  record: IsbnRecord | null;
  /** Sources that could not be reached (network error, rate limit), as opposed to "not found". */
  unreachable: IsbnSource[];
}

const ARABIC_INDIC = /[٠-٩]/g;
const EASTERN_ARABIC_INDIC = /[۰-۹]/g;

/** Converts Arabic-Indic and Eastern Arabic-Indic digits to ASCII digits. */
export function toAsciiDigits(text: string): string {
  return text
    .replace(ARABIC_INDIC, d => String(d.charCodeAt(0) - 0x0660))
    .replace(EASTERN_ARABIC_INDIC, d => String(d.charCodeAt(0) - 0x06F0));
}

function isbn10CheckDigit(first9: string): string {
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += (10 - i) * Number(first9[i]);
  const check = (11 - (sum % 11)) % 11;
  return check === 10 ? 'X' : String(check);
}

function isbn13CheckDigit(first12: string): string {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  return String((10 - (sum % 10)) % 10);
}

export function normalizeIsbn(input: string): IsbnInfo {
  const digits = toAsciiDigits(String(input || ''))
    .toUpperCase()
    .replace(/^\s*ISBN(-1[03])?:?\s*/, '')
    .replace(/[^0-9X]/g, '')
    // X is only a check digit, and only in ISBN-10
    .replace(/X(?=.)/g, '');

  if (!digits) return { input, digits, valid: false, problem: 'empty' };

  if (digits.length === 10 && /^\d{9}[\dX]$/.test(digits)) {
    if (isbn10CheckDigit(digits.slice(0, 9)) !== digits[9]) return { input, digits, valid: false, problem: 'checksum' };
    const core = `978${digits.slice(0, 9)}`;
    return { input, digits, valid: true, isbn10: digits, isbn13: core + isbn13CheckDigit(core) };
  }

  if (digits.length === 13 && /^\d{13}$/.test(digits)) {
    if (isbn13CheckDigit(digits.slice(0, 12)) !== digits[12]) return { input, digits, valid: false, problem: 'checksum' };
    // Only 978-prefixed ISBN-13s have an ISBN-10 form.
    const isbn10 = digits.startsWith('978') ? digits.slice(3, 12) + isbn10CheckDigit(digits.slice(3, 12)) : undefined;
    return { input, digits, valid: true, isbn13: digits, isbn10 };
  }

  return { input, digits, valid: false, problem: 'length' };
}

// ISO 639-1 (Google Books) -> MARC language codes used by id.loc.gov/vocabulary/languages/
const ISO1_TO_MARC: Record<string, string> = {
  ar: 'ara', en: 'eng', fa: 'per', ur: 'urd', ku: 'kur', tr: 'tur', fr: 'fre', de: 'ger', es: 'spa',
  it: 'ita', ru: 'rus', he: 'heb', zh: 'chi', ja: 'jpn', ko: 'kor', pt: 'por', nl: 'dut', sv: 'swe',
  hi: 'hin', ps: 'pus', sd: 'snd', syr: 'syr', la: 'lat', el: 'gre', id: 'ind', ms: 'may',
};

const yearOf = (text?: string): string | undefined => {
  if (!text) return undefined;
  const ascii = toAsciiDigits(text);
  return ascii.match(/\b(1[0-9]{3}|20[0-9]{2})\b/)?.[1] || text.trim() || undefined;
};

// Trailing ISBD punctuation that sources copy from MARC ("Beirut :", "Dar al-Saqi,", "دار الساقي،"),
// including the Arabic comma and semicolon.
const clean = (text?: string): string | undefined => {
  const t = String(text ?? '').replace(/\s*[:;,/.،؛]\s*$/, '').trim();
  return t || undefined;
};

type Partial1 = Omit<IsbnRecord, 'sources' | 'foundIn'>;

async function fromOpenLibrary(isbn: string, fetchImpl: typeof fetch): Promise<Partial1 | null> {
  const key = `ISBN:${isbn}`;
  const [dataRes, detailsRes] = await Promise.all([
    fetchImpl(`https://openlibrary.org/api/books?bibkeys=${key}&format=json&jscmd=data`),
    fetchImpl(`https://openlibrary.org/api/books?bibkeys=${key}&format=json&jscmd=details`),
  ]);
  if (!dataRes.ok) throw new Error(`Open Library ${dataRes.status}`);
  const data = (await dataRes.json())?.[key];
  const details = detailsRes.ok ? (await detailsRes.json())?.[key]?.details : undefined;
  if (!data && !details) return null;
  const langKey: string | undefined = details?.languages?.[0]?.key; // "/languages/ara"
  return {
    title: clean(data?.title || details?.title),
    subtitle: clean(data?.subtitle || details?.subtitle),
    authors: (data?.authors || details?.authors || []).map((a: any) => clean(a?.name)).filter(Boolean) as string[],
    publisher: clean(data?.publishers?.[0]?.name || details?.publishers?.[0]),
    place: clean(data?.publish_places?.[0]?.name || details?.publish_places?.[0]),
    date: yearOf(data?.publish_date || details?.publish_date),
    pages: Number(data?.number_of_pages || details?.number_of_pages) || undefined,
    language: langKey ? langKey.split('/').pop() : undefined,
    isbn10: data?.identifiers?.isbn_10?.[0],
    isbn13: data?.identifiers?.isbn_13?.[0],
  };
}

async function fromGoogleBooks(isbn: string, fetchImpl: typeof fetch): Promise<Partial1 | null> {
  const res = await fetchImpl(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
  if (!res.ok) throw new Error(`Google Books ${res.status}`);
  const info = (await res.json())?.items?.[0]?.volumeInfo;
  if (!info) return null;
  return {
    title: clean(info.title),
    subtitle: clean(info.subtitle),
    authors: (info.authors || []).map((a: string) => clean(a)).filter(Boolean) as string[],
    publisher: clean(info.publisher),
    date: yearOf(info.publishedDate),
    pages: Number(info.pageCount) || undefined,
    language: info.language ? ISO1_TO_MARC[String(info.language).toLowerCase()] : undefined,
  };
}

const FIELDS: (keyof Partial1)[] = ['title', 'subtitle', 'authors', 'publisher', 'place', 'date', 'pages', 'language', 'isbn10', 'isbn13'];

/** Merges source results in priority order: each field comes from the first source that has it. */
export function mergeIsbnResults(results: Array<{ source: IsbnSource; data: Partial1 | null }>): IsbnRecord | null {
  const found = results.filter(r => r.data);
  if (!found.length) return null;
  const record: IsbnRecord = { authors: [], sources: {}, foundIn: found.map(r => r.source) };
  for (const field of FIELDS) {
    for (const { source, data } of found) {
      const value = (data as any)[field];
      const has = Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null && value !== '';
      if (has) {
        (record as any)[field] = value;
        (record.sources as any)[field] = source;
        break;
      }
    }
  }
  // Sources often give "Title : subtitle" in one string (ISBD punctuation from MARC 245 $a : $b).
  if (record.title && !record.subtitle) {
    const [main, ...rest] = record.title.split(/\s+:\s+/);
    if (rest.length && main.trim()) {
      record.title = main.trim();
      record.subtitle = rest.join(' : ').trim();
      if (record.sources.title) record.sources.subtitle = record.sources.title;
    }
  }
  return record;
}

/** Looks an ISBN up in every source. An invalid ISBN is not looked up. */
export async function lookupIsbnEverywhere(input: string, fetchImpl: typeof fetch = fetch): Promise<IsbnLookupResult> {
  const isbn = normalizeIsbn(input);
  if (!isbn.valid) return { isbn, record: null, unreachable: [] };
  const query = isbn.isbn13 || isbn.digits;

  const sources: Array<[IsbnSource, (q: string, f: typeof fetch) => Promise<Partial1 | null>]> = [
    ['Open Library', fromOpenLibrary],
    ['Google Books', fromGoogleBooks],
  ];
  const unreachable: IsbnSource[] = [];
  const results = await Promise.all(sources.map(async ([source, get]) => {
    try {
      let data = await get(query, fetchImpl);
      // Some sources index only one form; retry with the ISBN-10.
      if (!data && isbn.isbn10 && isbn.isbn10 !== query) data = await get(isbn.isbn10, fetchImpl);
      return { source, data };
    } catch {
      unreachable.push(source);
      return { source, data: null };
    }
  }));

  const record = mergeIsbnResults(results);
  if (record) {
    record.isbn13 = isbn.isbn13 || record.isbn13;
    record.isbn10 = isbn.isbn10 || record.isbn10;
  }
  return { isbn, record, unreachable };
}
