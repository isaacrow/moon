/**
 * Hijri dates for cataloguing (Phase 11, step 2). Arabic and Persian imprints give their year in the Hijri
 * calendar (1445 هـ), the solar Hijri calendar of Iran (1402 ش), the Gregorian (2023 م), or several at once.
 * This reads a date statement as written and gives the Gregorian years it stands for, so a record can be
 * coded (008), searched, sorted and browsed by century in either calendar.
 *
 * Conversion uses the arithmetic (tabular) Islamic calendar. It can differ from a sighted or Umm al-Qura
 * date by a day or two, so conversions are kept to whole years, and a Hijri year that runs across two
 * Gregorian years gives both ("1445 هـ" is 2023 or 2024), as LC records it ("1445 [2023 or 2024]").
 * Gregorian dates are proleptic Gregorian.
 */

const EPOCH = 1948439.5; // Julian day of 1 Muharram 1 AH (tabular, civil epoch)

/** Julian day of a tabular Hijri date. */
export function hijriToJd(year: number, month = 1, day = 1): number {
  return day + Math.ceil(29.5 * (month - 1)) + (year - 1) * 354 + Math.floor((3 + 11 * year) / 30) + EPOCH - 1;
}

const jdToDate = (jd: number) => new Date(Math.round((jd - 2440587.5) * 86400000));
const dateToJd = (d: Date) => d.getTime() / 86400000 + 2440587.5;

/** A tabular Hijri date in the Gregorian calendar, as YYYY-MM-DD. */
export function hijriToGregorian(year: number, month = 1, day = 1): string {
  return jdToDate(hijriToJd(year, month, day)).toISOString().slice(0, 10);
}

/** A Gregorian date (YYYY-MM-DD) in the tabular Hijri calendar. */
export function gregorianToHijri(iso: string): { year: number; month: number; day: number } {
  // Julian days start at noon: midnight UTC of the date is N.5, the same as hijriToJd gives.
  const jd = Math.floor(dateToJd(new Date(`${iso}T12:00:00Z`))) - 0.5;
  const year = Math.floor((30 * (jd - EPOCH) + 10646) / 10631);
  const month = Math.min(12, Math.ceil((jd - (29 + hijriToJd(year, 1, 1))) / 29.5) + 1);
  const day = jd - hijriToJd(year, month, 1) + 1;
  return { year, month, day };
}

/** The Gregorian years a Hijri year runs across (one, or two). */
export function hijriYearSpan(year: number): [number, number] {
  const from = Number(hijriToGregorian(year, 1, 1).slice(0, 4));
  const to = Number(jdToDate(hijriToJd(year + 1, 1, 1) - 1).toISOString().slice(0, 4));
  return [from, to];
}

/** The Gregorian years a solar Hijri (Iranian) year runs across: it starts at Nowruz, about 21 March. */
export const solarHijriYearSpan = (year: number): [number, number] => [year + 621, year + 622];

/** The Hijri century a Gregorian year falls in (the century of the Hijri year it begins in). */
export function hijriCenturyOf(gregorianYear: number): number {
  const h = gregorianToHijri(`${String(gregorianYear).padStart(4, '0')}-07-01`).year;
  return Math.floor((h - 1) / 100) + 1;
}

const ARABIC = /[؀-ۿ]/;
const digits = (s: string) => s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
const SOLAR = /(?<!\d)(\d{3,4})\s*(?:هـ?\s*\.?\s*ش|ه\.\s*ش|ش(?![؀-ۿ])|\.?\s*SH\b|solar)/gi;
const HIJRI = /(?<!\d)(\d{1,4})\s*(?:هـ|ھـ|ﻫ|ه(?![؀-ۿ])|هجري(?:ة)?|للهجرة|A\.?\s?H\.?(?![a-z])|H\.(?![a-z])|hijri)/gi;
const GREG = /(?<!\d)(\d{3,4})\s*(?:م(?![؀-ۿ])|م\.|ميلادي(?:ة)?|A\.?\s?D\.?(?![a-z])|C\.?E\.?(?![a-z]))/gi;

export interface DateReading {
  /** Gregorian years the statement stands for: one year, or two when a Hijri year runs across two. */
  from?: number;
  to?: number;
  /** The Hijri year as written, if any. */
  hijri?: number;
  /** The solar Hijri year as written, if any. */
  solarHijri?: number;
  /** A Gregorian year the statement gives itself. */
  gregorian?: number;
  /** A year with no calendar named, read as Hijri because the statement is in Arabic and before 1450. */
  assumed?: boolean;
  /** EDTF for the Gregorian reading: "2023", or "[2023,2024]" (one of the two). */
  edtf?: string;
}

/** Reads a date statement ("1445 هـ، 2023 م", "١٣٩٨ [1978]", "1402 ش", "سنة 645 هـ", "2015") in any calendar. */
export function readDate(statement: string): DateReading {
  const s = digits(String(statement || ''));
  const first = (re: RegExp) => { re.lastIndex = 0; const m = re.exec(s); return m ? Number(m[1]) : undefined; };
  const solar = first(SOLAR);
  const masked = s.replace(SOLAR, ' ');
  HIJRI.lastIndex = 0;
  const hm = HIJRI.exec(masked);
  let hijri = hm ? Number(hm[1]) : undefined;
  const withoutCalendars = masked.replace(HIJRI, ' ');
  let gregorian = first(GREG);
  if (gregorian === undefined) {
    const plain = [...withoutCalendars.matchAll(/(?<!\d)(\d{4})(?!\d)/g)].map((m) => Number(m[1]));
    gregorian = plain.find((y) => y >= 1450 && y <= new Date().getFullYear() + 1);
    // An Arabic imprint year before 1450 with no calendar named is a Hijri year (1398 = 1978).
    if (gregorian === undefined && hijri === undefined && solar === undefined && ARABIC.test(s)) {
      const h = plain.find((y) => y >= 1000 && y < 1450);
      if (h) return finish({ hijri: h, assumed: true });
    }
  }
  return finish({ hijri, solarHijri: solar, gregorian });
}

function finish(r: DateReading): DateReading {
  if (r.gregorian !== undefined) return { ...r, from: r.gregorian, to: r.gregorian, edtf: String(r.gregorian).padStart(4, '0') };
  const span = r.hijri !== undefined ? hijriYearSpan(r.hijri) : r.solarHijri !== undefined ? solarHijriYearSpan(r.solarHijri) : null;
  if (!span) return r;
  const [from, to] = span;
  const pad = (y: number) => String(y).padStart(4, '0');
  return { ...r, from, to, edtf: from === to ? pad(from) : `[${pad(from)},${pad(to)}]` };
}

/** "1445 هـ / 2023–2024 م": a reading in both calendars, for display. */
export function bothCalendars(r: DateReading, ar = true): string {
  if (r.from === undefined) return '';
  const g = r.from === r.to ? String(r.from) : `${r.from}–${r.to}`;
  const h = r.hijri ?? (r.solarHijri === undefined ? hijriFromGregorian(r.from) : undefined);
  const parts = [
    h !== undefined ? (ar ? `${h} هـ` : `${h} AH`) : '',
    r.solarHijri !== undefined ? (ar ? `${r.solarHijri} هـ.ش` : `${r.solarHijri} SH`) : '',
    ar ? `${g} م` : `${g} CE`,
  ].filter(Boolean);
  return parts.join(' / ');
}

const hijriFromGregorian = (y: number) => gregorianToHijri(`${String(y).padStart(4, '0')}-07-01`).year;
