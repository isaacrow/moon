/**
 * New real books for "Add sample books", each one Moon does not have yet, with real links:
 *
 *   1. Open Library's search (openlibrary.org, open data) finds works on a rotating set of subjects, Arabic
 *      and English, each with an ISBN-13, an author and a cover. Books whose ISBN is in Moon are left out.
 *   2. The edition is then read by its ISBN, so publisher, place, date, pages, LCCN, OCLC number and LC /
 *      Dewey classes all describe that one edition (search results mix editions).
 *   3. The author is looked up on Wikidata by their Open Library ID (P648). When Wikidata has them, the book
 *      gets the author's real Wikidata, VIAF, LC and ISNI links, dates and Arabic name; when it does not,
 *      the author stays a plain name (never a guessed link).
 */

export interface AuthorFacts {
  /** Wikidata, VIAF, LC and ISNI addresses for the author, as Wikidata records them. */
  links: string[];
  arabicName?: string;
  birthDate?: string;
  deathDate?: string;
}

export interface SampleBookCandidate {
  isbn: string;
  lang: "ara" | "eng";
  title: string;
  subtitle?: string;
  author: string;
  authorFacts?: AuthorFacts;
  responsibility: string;
  place?: string;
  publisher: string;
  date: string;
  extent?: string;
  genre: string;
  subjects: string[];
  summary: string;
  /** The Open Library work and edition, for the record's admin note. */
  openLibrary?: { work?: string; edition?: string };
  lccn?: string;
  oclc?: string[];
  /** LC classification split as BIBFRAME does: class number and item (cutter) part. */
  lcc?: { classificationPortion: string; itemPortion?: string };
  ddc?: string;
}

/** Subjects to draw from: [Open Library query, language, genre in Arabic, genre in English]. Books from an
 *  Arabic source must have an Arabic title, and books from an English one a non-Arabic title, so the genre
 *  and language fit the book. */
const SOURCES: Array<[string, "ara" | "eng", string, string]> = [
  ['subject:"Arabic fiction"', "ara", "رواية", "Fiction"],
  ['subject:"Arabic poetry"', "ara", "شعر", "Poetry"],
  ['subject:"Islam"', "ara", "دراسات إسلامية", "Islamic studies"],
  ['subject:history', "ara", "تاريخ", "History"],
  ['subject:"Arabic language"', "ara", "لغة عربية", "Arabic language"],
  ['subject:philosophy', "ara", "فلسفة", "Philosophy"],
  ['subject:"Islamic philosophy"', "eng", "فلسفة", "Philosophy"],
  ['subject:"Iraq" subject:history', "eng", "تاريخ", "History"],
  ['subject:"Arabic literature"', "eng", "أدب", "Literature"],
  ['subject:"Middle East" subject:history', "eng", "تاريخ", "History"],
  ['subject:"Arabic fiction" subject:"Translations into English"', "eng", "رواية", "Fiction"],
  ['subject:"Arabic poetry" subject:"Translations into English"', "eng", "شعر", "Poetry"],
  ['subject:"Islamic Empire" subject:history', "eng", "تاريخ", "History"],
  ['subject:"Sufism"', "eng", "تصوف", "Sufism"],
  ['subject:"Baghdad (Iraq)"', "eng", "تاريخ", "History"],
  ['subject:"Mesopotamia"', "eng", "آثار", "Archaeology"],
  ['subject:"Arab-Israeli conflict"', "eng", "تاريخ", "History"],
  ['subject:"Islamic art"', "eng", "فنون", "Art"],
];
const ARABIC = /[؀-ۿ]/;
/** Authors the library does not want among the sample books. */
const LEFT_OUT = /طه\s*حسين|حسين،?\s*طه|ta+ha\s+h[uo]s+[ae]?[yi]?n|h[uo]s+[ae]?[yi]?n,?\s+ta+ha/i;
/** An author's name without accents ("Ṭāhā Ḥusayn" → "Taha Husayn"), for LEFT_OUT. */
const plain = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "");
const FIELDS = "key,title,subtitle,author_name,author_key,isbn,subject,cover_i";
const HEADERS = { "User-Agent": "MoonCatalogue/1.0 (https://mooon.site)", Accept: "application/json" };

async function getJson(url: string): Promise<any> {
  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(12_000) });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

/** Open Library's LC class sort key ("PJ-7862.00000000.H356 H5513 1987") → "PJ7862" + ".H356 H5513 1987". */
export function lccFromOpenLibrary(raw: string): { classificationPortion: string; itemPortion?: string } | undefined {
  const s = String(raw || "").trim();
  const sortKey = s.match(/^([A-Z]{1,3})-0*(\d+)\.(\d+)(?:\.?(.*))?$/);
  if (sortKey) {
    const decimals = sortKey[3].replace(/0+$/, "");
    const cls = `${sortKey[1]}${sortKey[2]}${decimals ? `.${decimals}` : ""}`;
    const item = (sortKey[4] || "").trim();
    return { classificationPortion: cls, ...(item ? { itemPortion: item.startsWith(".") ? item : `.${item}` } : {}) };
  }
  // Already written as LC writes it ("PJ7862.H356 1987").
  const lc = s.match(/^([A-Z]{1,3}\s?\d+(?:\.\d+)?)\s*(\..+)?$/);
  if (lc) return { classificationPortion: lc[1].replace(/\s/g, ""), ...(lc[2] ? { itemPortion: lc[2].trim() } : {}) };
  return undefined;
}

/** A Dewey number Open Library gives, if it is one ("892.736", "823"); not "[E]" or "B". */
export function ddcFromOpenLibrary(raw: string): string | undefined {
  const m = String(raw || "").trim().match(/^(\d{3}(?:\.\d+)?)/);
  return m?.[1];
}

/** "2014", "March 3, 2014", "1408 [1987]" → the year (the last 4-digit one, as an edition's date shows it). */
function yearOf(publishDate: string): string {
  const years = String(publishDate || "").match(/\d{4}/g) || [];
  return years.length ? years[years.length - 1] : "";
}

const wikidataYear = (claim: any) => String(claim?.mainsnak?.datavalue?.value?.time || "").match(/^[+-]0*(\d+)-/)?.[1];
const wikidataString = (e: any, p: string) => {
  const v = e?.claims?.[p]?.find((c: any) => c.rank !== "deprecated")?.mainsnak?.datavalue?.value;
  return typeof v === "string" ? v : undefined;
};

/** Wikidata facts for Open Library authors (by their OL ids), found through Wikidata's P648. */
export async function authorFacts(olAuthorIds: string[]): Promise<Map<string, AuthorFacts>> {
  const out = new Map<string, AuthorFacts>();
  const ids = [...new Set(olAuthorIds.filter((x) => /^OL\d+A$/.test(x)))];
  const qidOf = new Map<string, string>();
  // Two at a time, to stay within Wikidata's limits.
  for (let i = 0; i < ids.length; i += 2) {
    await Promise.all(ids.slice(i, i + 2).map(async (ol) => {
      const s = await getJson(`https://www.wikidata.org/w/api.php?action=query&list=search&format=json&srlimit=2&srsearch=${encodeURIComponent(`haswbstatement:P648=${ol}`)}`);
      const hits = (s?.query?.search || []).map((x: any) => x.title).filter((t: string) => /^Q\d+$/.test(t));
      if (hits.length === 1) qidOf.set(ol, hits[0]); // two items claiming one author: leave it unlinked
    }));
  }
  const qids = [...new Set(qidOf.values())];
  const entities: Record<string, any> = {};
  for (let i = 0; i < qids.length; i += 40) {
    const j = await getJson(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=labels|claims&languages=ar&ids=${qids.slice(i, i + 40).join("|")}`);
    Object.assign(entities, j?.entities || {});
  }
  for (const [ol, qid] of qidOf) {
    const e = entities[qid];
    const human = (e?.claims?.P31 || []).some((c: any) => c?.mainsnak?.datavalue?.value?.id === "Q5");
    if (!e || !human) continue;
    const viaf = wikidataString(e, "P214"), lc = wikidataString(e, "P244"), isni = wikidataString(e, "P213");
    const links = [
      `http://www.wikidata.org/entity/${qid}`,
      ...(viaf && /^\d+$/.test(viaf) ? [`http://viaf.org/viaf/${viaf}`] : []),
      ...(lc && /^n[a-z]?\d+$/.test(lc) ? [`http://id.loc.gov/authorities/names/${lc}`] : []),
      ...(isni && /^[\d ]{15,19}[\dX]$/.test(isni) ? [`https://isni.org/isni/${isni.replace(/ /g, "")}`] : []),
    ];
    const born = wikidataYear(e.claims?.P569?.[0]);
    const died = wikidataYear(e.claims?.P570?.[0]);
    out.set(ol, {
      links,
      ...(e.labels?.ar?.value ? { arabicName: e.labels.ar.value } : {}),
      ...(born ? { birthDate: born } : {}),
      ...(died ? { deathDate: died } : {}),
    });
  }
  return out;
}

/** Up to `want` books whose ISBN is not in `known`, starting from a random subject. */
export async function findNewSampleBooks(want: number, known: Set<string>): Promise<SampleBookCandidate[]> {
  const picked: Array<{ d: any; isbn: string; lang: "ara" | "eng"; genreAr: string; genreEn: string }> = [];
  const seen = new Set(known);
  const start = Math.floor(Math.random() * SOURCES.length);
  for (let i = 0; i < SOURCES.length && picked.length < want; i++) {
    const [q, lang, genreAr, genreEn] = SOURCES[(start + i) % SOURCES.length];
    const page = 1 + Math.floor(Math.random() * 3);
    const found = await getJson(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&language=${lang}&fields=${FIELDS}&limit=40&page=${page}`);
    // A few books from each subject, so a batch is varied.
    let fromThis = 0;
    for (const d of (found?.docs || []).sort(() => Math.random() - 0.5)) {
      if (picked.length >= want || fromThis >= Math.max(3, Math.ceil(want / 3))) break;
      const isbn = (d.isbn || []).find((x: string) => /^97[89]\d{10}$/.test(x) && !seen.has(x));
      if (!isbn || !d.cover_i || !d.author_name?.length || !d.title) continue;
      if (d.author_name.some((a: string) => LEFT_OUT.test(plain(a)))) continue;
      if (ARABIC.test(d.title) !== (lang === "ara")) continue;
      seen.add(isbn);
      picked.push({ d, isbn, lang, genreAr, genreEn });
      fromThis++;
    }
  }

  // The editions themselves, three at a time.
  const editions = new Map<string, any>();
  for (let i = 0; i < picked.length; i += 3) {
    await Promise.all(picked.slice(i, i + 3).map(async (p) => {
      const e = await getJson(`https://openlibrary.org/isbn/${p.isbn}.json`);
      if (e) editions.set(p.isbn, e);
    }));
  }
  const facts = await authorFacts(picked.map((p) => p.d.author_key?.[0]).filter(Boolean));

  const out: SampleBookCandidate[] = [];
  for (const { d, isbn, genreAr, genreEn } of picked) {
    const e = editions.get(isbn);
    const date = yearOf(e?.publish_date);
    const publisher = String(e?.publishers?.[0] || "").trim();
    // Only editions Open Library really describes: a publisher and a year of that edition.
    if (!e || !publisher || !date) continue;
    // Print-on-demand reprints are not the editions a library catalogues.
    if (/independently published|createspace|lulu.com|forgotten books/i.test(publisher)) continue;
    // The edition's own language decides (an English search can return a French translation).
    const langs = (e.languages || []).map((l: any) => String(l?.key || '').split('/').pop());
    if (langs.length && !langs.includes('ara') && !langs.includes('eng')) continue;
    const isArabic = langs.includes('ara') || (!langs.length && ARABIC.test(d.title));
    const pages = Number(e.number_of_pages) || 0;
    const lcc = (e.lc_classifications || []).map(lccFromOpenLibrary).find(Boolean);
    const ddc = (e.dewey_decimal_class || []).map(ddcFromOpenLibrary).find(Boolean);
    const lccn = (e.lccn || []).map((x: string) => String(x).replace(/\s/g, "")).find((x: string) => /^[a-z]{0,3}\d{8,10}$/.test(x));
    const oclc = (e.oclc_numbers || []).map(String).filter((x: string) => /^\d+$/.test(x)).slice(0, 3);
    const author = String(d.author_name[0]).trim();
    const known = facts.get(d.author_key?.[0]);
    // Only real books: an edition libraries have catalogued (LCCN, OCLC number, LC or Dewey class) or by an
    // author Wikidata knows; never one whose publisher is its own author (self-published).
    if (plain(publisher).toLowerCase().replace(/\W+/g, "") === plain(author).toLowerCase().replace(/\W+/g, "")) continue;
    if (!lccn && !oclc.length && !lcc && !ddc && !known) continue;
    out.push({
      isbn,
      lang: isArabic ? "ara" : "eng",
      title: String(e.title || d.title).trim(),
      ...(e.subtitle || d.subtitle ? { subtitle: String(e.subtitle || d.subtitle).trim() } : {}),
      author,
      ...(known ? { authorFacts: known } : {}),
      responsibility: String(e.by_statement || d.author_name.slice(0, 3).join(isArabic ? "، " : ", ")).trim().replace(/[.\s]+$/, ""),
      ...(e.publish_places?.[0] ? { place: String(e.publish_places[0]).trim().replace(/[\s:;,]+$/, "") } : {}),
      publisher,
      date,
      ...(pages ? { extent: isArabic ? `${pages} صفحة` : `${pages} pages` } : {}),
      genre: isArabic ? genreAr : genreEn,
      subjects: (d.subject || []).filter((s: string) => s.length < 60 && !/^(Accessible book|Protected DAISY|In library|Lending library|OverDrive|Large type books|nyt:)/i.test(s)).slice(0, 4),
      summary: "",
      openLibrary: { work: d.key ? `https://openlibrary.org${d.key}` : undefined, edition: e.key ? `https://openlibrary.org${e.key}` : undefined },
      ...(lccn ? { lccn } : {}),
      ...(oclc.length ? { oclc } : {}),
      ...(lcc ? { lcc } : {}),
      ...(ddc ? { ddc } : {}),
    });
  }
  return out;
}
