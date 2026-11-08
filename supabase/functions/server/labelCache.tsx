/**
 * The LC and Wikidata label cache (Phase 13 S19). Moon links people, subjects and places to LC
 * (id.loc.gov) and Wikidata; their names there, in every script they have ("Twain, Mark", "تواين، مارک" …),
 * are kept in the label_cache table, so the OPAC can show what LC and Wikidata call them without asking each
 * time, and so a change at LC reaches Moon.
 *
 * Kept fresh from the sources' own change signals, never edited by hand:
 * - LC: its ActivityStreams change feed (id.loc.gov/authorities/names|subjects/activitystreams/feed); every
 *   cached LC address updated there since the last run is fetched again;
 * - Wikidata: each item's `modified` time (wbgetentities props=info), 50 at a time; changed items are refreshed;
 * - anything never fetched, or not checked for 30 days, is fetched.
 * No imports: index.tsx passes fetch and the table; the tests run it in Node.
 */

export interface Label { value: string; lang?: string }
export interface CachedLabels { uri: string; source: "lc" | "wikidata"; labels: Label[]; sourceModified?: string; fetchedAt: string; missing?: boolean }

const LC = /^https?:\/\/id\.loc\.gov\/authorities\/(names|subjects|genreForms)\/[a-z]{1,3}\d+$/;
const WD = /^https?:\/\/(www\.)?wikidata\.org\/(wiki|entity)\/(Q\d+)$/;
export const STALE_DAYS = 30;
export const MAX_PER_RUN = 300;

export function sourceOf(uri: string): "lc" | "wikidata" | null {
  return LC.test(uri) ? "lc" : WD.test(uri) ? "wikidata" : null;
}
/** One address per thing: LC over http, Wikidata as …/entity/Q…. */
export function canonical(uri: string): string {
  const u = uri.trim().replace(/\/$/, "");
  const q = u.match(WD)?.[3];
  if (q) return `http://www.wikidata.org/entity/${q}`;
  return u.replace(/^https:\/\/id\.loc\.gov/, "http://id.loc.gov");
}

/** Every LC or Wikidata address in some documents (records, entities). */
export function outsideUris(docs: unknown[]): string[] {
  const out = new Set<string>();
  JSON.stringify(docs, (_k, v) => {
    if (typeof v === "string" && v.length < 200 && sourceOf(v.trim())) out.add(canonical(v));
    return v;
  });
  return [...out].sort();
}

// ---- LC ----

/** LC's labels for one authority, from its .json (madsrdf:authoritativeLabel in each script, else skos:prefLabel). */
export function parseLc(json: unknown, uri: string): Label[] {
  const nodes = Array.isArray(json) ? json : [];
  const node = nodes.find((n: any) => n?.["@id"] === uri || n?.["@id"] === uri.replace(/^http:/, "https:"));
  const vals = node?.["http://www.loc.gov/mads/rdf/v1#authoritativeLabel"] ?? node?.["http://www.w3.org/2004/02/skos/core#prefLabel"] ?? [];
  const seen = new Set<string>();
  return (Array.isArray(vals) ? vals : [vals]).map((v: any) => ({ value: String(v?.["@value"] ?? v ?? "").trim(), ...(v?.["@language"] ? { lang: String(v["@language"]) } : {}) }))
    .filter((l) => l.value && !seen.has(`${l.lang}|${l.value}`) && seen.add(`${l.lang}|${l.value}`));
}

/** The LC addresses an ActivityStreams page says were changed, with when; and whether to read the next page. */
export function parseLcFeed(page: any, since: string): { changed: Map<string, string>; more: boolean; next?: string } {
  const changed = new Map<string, string>();
  let older = false;
  for (const it of Array.isArray(page?.orderedItems) ? page.orderedItems : []) {
    const when = String(it?.published || it?.object?.updated || "");
    if (when && when < since.slice(0, 10)) { older = true; continue; }
    const id = it?.object?.id;
    if (typeof id === "string") changed.set(canonical(id), when);
  }
  return { changed, more: !older && !!page?.next, ...(page?.next ? { next: String(page.next) } : {}) };
}

// ---- Wikidata ----

export const WD_LANGS = ["ar", "en", "fa", "ur", "fr", "de", "tr"];
export const wikidataUrl = (qids: string[], props: "labels|info" | "info") =>
  `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&origin=*&props=${encodeURIComponent(props)}&languages=${WD_LANGS.join("|")}&ids=${qids.join("|")}`;
export const qidOf = (uri: string) => uri.match(/(Q\d+)$/)?.[1] || "";

/** Labels and modified time of each item in a wbgetentities reply. */
export function parseWikidata(json: any): Map<string, { labels: Label[]; modified?: string; missing?: boolean }> {
  const out = new Map<string, { labels: Label[]; modified?: string; missing?: boolean }>();
  for (const [qid, e] of Object.entries<any>(json?.entities || {})) {
    if (e?.missing !== undefined) { out.set(qid, { labels: [], missing: true }); continue; }
    const labels = Object.values<any>(e?.labels || {}).map((l) => ({ value: String(l.value), lang: String(l.language) }));
    out.set(qid, { labels, ...(e?.modified ? { modified: String(e.modified) } : {}) });
  }
  return out;
}

// ---- Plan ----

/** Which addresses to fetch now: never fetched, changed at the source, or not checked for STALE_DAYS. */
export function refreshPlan(uris: string[], cached: Map<string, CachedLabels>, lcChanged: Map<string, string>, now: Date): string[] {
  const stale = new Date(now.getTime() - STALE_DAYS * 86_400_000).toISOString();
  const due = uris.filter((u) => {
    const c = cached.get(u);
    if (!c) return true;
    if (c.source === "lc" && lcChanged.has(u) && (lcChanged.get(u) || "") >= c.fetchedAt.slice(0, 10)) return true;
    return c.fetchedAt < stale;
  });
  // New ones first, then the oldest checked.
  return due.sort((a, b) => (cached.get(a)?.fetchedAt || "").localeCompare(cached.get(b)?.fetchedAt || "")).slice(0, MAX_PER_RUN);
}

export interface RefreshDeps {
  fetchJson(url: string): Promise<any | null>;
  now: Date;
  since: string;
}

/** Fetches what is due. Returns the rows to store and when LC's feed was read up to. */
export async function refreshLabels(uris: string[], cached: Map<string, CachedLabels>, deps: RefreshDeps): Promise<{ rows: CachedLabels[]; lcFeedRead: number; wikidataChanged: number }> {
  const at = deps.now.toISOString();
  // LC's change feeds since the last run (names and subjects), a few pages at most.
  const lcChanged = new Map<string, string>();
  let lcFeedRead = 0;
  for (const scheme of ["names", "subjects"]) {
    let url: string | undefined = `https://id.loc.gov/authorities/${scheme}/activitystreams/feed/1.json`;
    for (let page = 0; url && page < 10; page++) {
      const json = await deps.fetchJson(url.endsWith(".json") ? url : `${url}.json`);
      if (!json) break;
      lcFeedRead++;
      const { changed, more, next } = parseLcFeed(json, deps.since);
      changed.forEach((v, k) => lcChanged.set(k, v));
      url = more ? next : undefined;
    }
  }
  // Wikidata: which cached items changed since they were fetched.
  const wdCached = uris.filter((u) => sourceOf(u) === "wikidata" && cached.has(u));
  let wikidataChanged = 0;
  const wdDue = new Set<string>();
  for (let i = 0; i < wdCached.length; i += 50) {
    const batch = wdCached.slice(i, i + 50);
    const info = parseWikidata(await deps.fetchJson(wikidataUrl(batch.map(qidOf), "info")));
    for (const u of batch) {
      const m = info.get(qidOf(u))?.modified;
      if (m && m !== cached.get(u)?.sourceModified) { wdDue.add(u); wikidataChanged++; }
    }
  }
  const plan = [...new Set([...refreshPlan(uris, cached, lcChanged, deps.now), ...[...wdDue].slice(0, MAX_PER_RUN)])].slice(0, MAX_PER_RUN);

  const rows: CachedLabels[] = [];
  // LC, a few at a time (gentle on id.loc.gov, quick enough for one run).
  const lcPlan = plan.filter((p) => sourceOf(p) === "lc");
  for (let i = 0; i < lcPlan.length; i += 6) {
    await Promise.all(lcPlan.slice(i, i + 6).map(async (u) => {
      const json = await deps.fetchJson(`${u}.json`);
      if (json === null) return; // unreachable: try again next run
      const labels = parseLc(json, u);
      rows.push({ uri: u, source: "lc", labels, fetchedAt: at, ...(lcChanged.get(u) ? { sourceModified: lcChanged.get(u) } : {}), ...(!labels.length ? { missing: true } : {}) });
    }));
  }
  rows.sort((x, y) => x.uri.localeCompare(y.uri));
  const wd = plan.filter((p) => sourceOf(p) === "wikidata");
  for (let i = 0; i < wd.length; i += 50) {
    const batch = wd.slice(i, i + 50);
    const got = parseWikidata(await deps.fetchJson(wikidataUrl(batch.map(qidOf), "labels|info")));
    for (const u of batch) {
      const g = got.get(qidOf(u));
      if (!g) continue;
      rows.push({ uri: u, source: "wikidata", labels: g.labels, fetchedAt: at, ...(g.modified ? { sourceModified: g.modified } : {}), ...(g.missing ? { missing: true } : {}) });
    }
  }
  return { rows, lcFeedRead, wikidataChanged };
}

/** The label to show for a reader: their language or script first, then English, then any. */
export function pickLabel(labels: Label[], lang: "ar" | "en"): string {
  const by = (test: (l: string) => boolean) => labels.find((l) => l.lang && test(l.lang.toLowerCase()))?.value;
  return (lang === "ar" ? by((l) => l === "ar" || l === "und-arab" || l === "ar-arab") : undefined)
    || by((l) => l === "en") || labels.find((l) => !l.lang)?.value || labels[0]?.value || "";
}
