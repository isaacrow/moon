/**
 * New real books for "Add sample books": each time, books Moon does not have yet, found on Open Library
 * (openlibrary.org, whose data is open) across a rotating set of subjects, Arabic and English, each with an
 * ISBN-13, an author and a cover. Books whose ISBN is already in Moon (any record) are left out.
 */

export interface SampleBookCandidate {
  isbn: string;
  lang: "ara" | "eng";
  title: string;
  subtitle?: string;
  author: string;
  responsibility: string;
  place?: string;
  publisher: string;
  date: string;
  extent?: string;
  genre: string;
  subjects: string[];
  summary: string;
}

/** Subjects to draw from: [Open Library query, language, genre in Arabic, genre in English]. Books from an
 *  Arabic source must have an Arabic title, and books from an English one a non-Arabic title, so the genre
 *  and language fit the book. */
const SOURCES: Array<[string, "ara" | "eng", string, string]> = [
  ['subject:"Arabic fiction"', "ara", "رواية", "Fiction"],
  ['subject:"Arabic poetry"', "ara", "شعر", "Poetry"],
  ['subject:"Islamic philosophy"', "eng", "فلسفة", "Philosophy"],
  ['subject:"Iraq" subject:history', "eng", "تاريخ", "History"],
  ['subject:"Islam"', "ara", "دراسات إسلامية", "Islamic studies"],
  ['subject:"Arabic literature"', "eng", "أدب", "Literature"],
  ['subject:"Middle East" subject:history', "eng", "تاريخ", "History"],
  ['subject:"Classic literature"', "eng", "رواية", "Fiction"],
  ['subject:"Science"', "eng", "علوم", "Science"],
  ['subject:history', "ara", "تاريخ", "History"],
];
const ARABIC = /[؀-ۿ]/;
/** Authors the library does not want among the sample books. */
const LEFT_OUT = /طه\s*حسين|حسين،?\s*طه|ta+ha\s+h[uo]s+[ae]?[yi]?n|h[uo]s+[ae]?[yi]?n,?\s+ta+ha/i;
/** An author's name without accents ("Ṭāhā Ḥusayn" → "Taha Husayn"), for LEFT_OUT. */
const plain = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "");
const FIELDS = "title,subtitle,author_name,first_publish_year,publish_year,isbn,publisher,publish_place,number_of_pages_median,subject,cover_i";

/** Up to `want` books whose ISBN is not in `known`, starting from a random subject. */
export async function findNewSampleBooks(want: number, known: Set<string>): Promise<SampleBookCandidate[]> {
  const out: SampleBookCandidate[] = [];
  const seen = new Set(known);
  const start = Math.floor(Math.random() * SOURCES.length);
  const thisYear = new Date().getFullYear();
  for (let i = 0; i < SOURCES.length && out.length < want; i++) {
    const [q, lang, genreAr, genreEn] = SOURCES[(start + i) % SOURCES.length];
    const page = 1 + Math.floor(Math.random() * 3);
    const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&language=${lang}&fields=${FIELDS}&limit=40&page=${page}`;
    let docs: any[] = [];
    try {
      const res = await fetch(url, { headers: { "User-Agent": "MoonCatalogue/1.0 (https://mooon.site)" }, signal: AbortSignal.timeout(12_000) });
      docs = res.ok ? (await res.json()).docs || [] : [];
    } catch { continue; }
    for (const d of docs.sort(() => Math.random() - 0.5)) {
      if (out.length >= want) break;
      const isbn = (d.isbn || []).find((x: string) => /^97[89]\d{10}$/.test(x));
      if (!isbn || !d.cover_i || !d.author_name?.length || !d.title || seen.has(isbn)) continue;
      if (d.author_name.some((a: string) => LEFT_OUT.test(plain(a)))) continue;
      const isArabic = ARABIC.test(d.title);
      if (isArabic !== (lang === "ara")) continue;
      seen.add(isbn);
      const years = [d.first_publish_year, ...(d.publish_year || [])].filter((y: any) => Number.isInteger(y) && y >= 1800 && y <= thisYear);
      out.push({
        isbn,
        lang: isArabic ? "ara" : "eng",
        title: String(d.title).trim(),
        ...(d.subtitle ? { subtitle: String(d.subtitle).trim() } : {}),
        author: String(d.author_name[0]).trim(),
        responsibility: d.author_name.slice(0, 3).join(isArabic ? "، " : ", "),
        ...(d.publish_place?.[0] ? { place: String(d.publish_place[0]).trim() } : {}),
        publisher: String(d.publisher?.[0] || "").trim() || (isArabic ? "ناشر غير معروف" : "Unknown publisher"),
        date: String(years.length ? Math.max(...years) : ""),
        ...(d.number_of_pages_median ? { extent: isArabic ? `${d.number_of_pages_median} صفحة` : `${d.number_of_pages_median} pages` } : {}),
        genre: isArabic ? genreAr : genreEn,
        subjects: (d.subject || []).filter((s: string) => s.length < 60).slice(0, 3),
        summary: "",
      });
    }
  }
  return out;
}
