/**
 * SRU (Search/Retrieve via URL, https://www.loc.gov/standards/sru/) copy cataloguing: search other library
 * catalogues and bring back MARCXML for the editor to import. Catalogue servers rarely allow calls from a
 * browser, so the edge function asks on the cataloger's behalf, only to the catalogues listed here
 * (the Library of Congress, plus any in the MOON_SRU_TARGETS secret), never to an address from the request.
 */

export interface SruTarget { id: string; name: string; url: string; indexes?: Partial<Record<SruIndex, string>> }
export type SruIndex = "keyword" | "title" | "author" | "isbn" | "lccn";

const DEFAULT_INDEXES: Record<SruIndex, string> = {
  keyword: "cql.anywhere", title: "dc.title", author: "dc.creator", isbn: "bath.isbn", lccn: "bath.lccn",
};

export const LC_TARGET: SruTarget = { id: "lc", name: "Library of Congress", url: "http://lx2.loc.gov:210/LCDB" };

/** LC plus the catalogues in MOON_SRU_TARGETS: [{"id":"koha","name":"…","url":"https://…/biblios"}]. */
export function sruTargets(configured: string | undefined | null): SruTarget[] {
  const extra: SruTarget[] = [];
  try {
    for (const t of JSON.parse(configured || "[]")) {
      if (t && /^[a-z0-9-]{1,30}$/.test(t.id) && typeof t.name === "string" && /^https?:\/\/[^\s]+$/.test(t.url) && t.id !== "lc") {
        extra.push({ id: t.id, name: t.name.slice(0, 80), url: t.url, indexes: t.indexes });
      }
    }
  } catch { /* a malformed setting adds nothing */ }
  return [LC_TARGET, ...extra];
}

/** The searchRetrieve URL for a query (CQL with the term quoted, so the user cannot write CQL). */
export function sruUrl(target: SruTarget, index: SruIndex, term: string, start = 1, max = 10): string {
  const field = target.indexes?.[index] || DEFAULT_INDEXES[index] || DEFAULT_INDEXES.keyword;
  const clean = term.replace(/["\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);
  const params = new URLSearchParams({
    operation: "searchRetrieve", version: "1.1", query: `${field}="${clean}"`,
    startRecord: String(Math.max(1, start)), maximumRecords: String(Math.min(20, Math.max(1, max))), recordSchema: "marcxml",
  });
  return `${target.url}?${params}`;
}

/** The total and any SRU diagnostic from a searchRetrieve response. */
export function sruSummary(xml: string): { total: number; diagnostic?: string } {
  const total = Number((xml.match(/<(?:\w+:)?numberOfRecords>(\d+)</) || [])[1] || 0);
  const diagnostic = (xml.match(/<(?:\w+:)?message>([^<]*)</) || [])[1];
  return { total, ...(diagnostic ? { diagnostic } : {}) };
}
