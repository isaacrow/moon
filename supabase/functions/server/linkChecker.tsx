/**
 * Link checker (Phase 13 S16): which of Moon's links from a person or body to LC, VIAF or Wikidata look wrong,
 * for a person to look at. It never blocks or removes anything; it only reports.
 *
 * - Name mismatch: what LC or Wikidata calls the thing (from the label cache) shares no name word with any of
 *   the entity's own names in the same script. A different script is not judged (نعمة / Abunimah).
 * - Same link, two entities: two of Moon's entities point at the same LC / VIAF / Wikidata address, so one of
 *   the links is wrong or the two entities are one.
 * - Gone at the source: LC or Wikidata no longer has the record (the cache marks it missing).
 * No imports: the server passes the entities and cached labels; the tests run it in Node.
 */

export interface CheckEntity { id: string; kind: string; label: string; variants: string[]; sameAs: string[] }
export interface CachedName { uri: string; source: string; labels: Array<{ value: string; lang?: string }>; missing?: boolean }
export interface LinkIssue { entityId: string; entityLabel: string; uri: string; kind: "name-mismatch" | "shared-link" | "gone"; detail: string; others?: string[] }

const ARABIC = /[؀-ۿ]/;
/** Name words that say little on their own (given names, kinship words, articles). */
const COMMON = new Set([
  "محمد", "احمد", "علي", "عبد", "بن", "ابن", "ابو", "ابي", "بنت", "ام", "الله", "الدين", "حسن", "حسين",
  "muhammad", "mohammed", "mohamed", "ahmad", "ahmed", "ali", "abd", "abdul", "ibn", "bin", "abu", "bint", "umm", "allah", "al", "el", "din", "hasan", "husayn", "the", "of", "and",
]);

export const canonicalLink = (u: string) => u.trim().replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "").replace(/^wikidata\.org\/wiki\//, "wikidata.org/entity/");

/** The significant words of a name, folded (Arabic letter forms, diacritics, ال/al-, dates and punctuation out). */
export function nameWords(s: string): string[] {
  return String(s || "")
    .replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/[ؤئ]/g, "ء")
    .normalize("NFKD").replace(/[̀-ًͯ-ٰٕـʻʼʿʾ'’]/g, "")
    .toLowerCase()
    .split(/[^\p{L}]+/u)
    .map((w) => w.replace(/^ال(?=...)/, "").replace(/^(al|el)(?=[a-z]{3})/, ""))
    .filter((w) => w.length > 2 && !COMMON.has(w));
}

/** A Latin name word without vowels or doubled letters: "mahmoud" and "mahmud" are both "mhmd". */
export const skeleton = (w: string) => w.replace(/(.)\1+/g, "$1").replace(/h/g, "").replace(/[aeiouyw]/g, "");

const scriptOf = (s: string) => (ARABIC.test(s) ? "arabic" : "latin");

/** Whether two sets of names, compared script by script, could name the same thing; null when no script is shared. */
export function namesAgree(ours: string[], theirs: string[]): boolean | null {
  let judged = false;
  for (const script of ["arabic", "latin"] as const) {
    const a = new Set(ours.filter((n) => scriptOf(n) === script).flatMap(nameWords));
    const b = theirs.filter((n) => scriptOf(n) === script).flatMap(nameWords);
    if (!a.size || !b.length) continue;
    judged = true;
    if (b.some((w) => a.has(w))) return true;
    // Romanizations differ in vowels (Mahmoud / Maḥmūd, Saeed / Saʻīd): compare Latin names by their consonants too.
    if (script === "latin") {
      const sk = new Set([...a].map(skeleton).filter((k) => k.length >= 2));
      if (b.map(skeleton).some((k) => k.length >= 2 && sk.has(k))) return true;
    }
  }
  return judged ? false : null;
}

/** Every suspect link, entity by entity. */
export function checkLinks(entities: CheckEntity[], cache: Map<string, CachedName>, canonicalCacheKey: (u: string) => string): LinkIssue[] {
  const issues: LinkIssue[] = [];
  const byLink = new Map<string, CheckEntity[]>();
  for (const e of entities) {
    for (const u of new Set(e.sameAs.map(canonicalLink))) {
      byLink.set(u, [...(byLink.get(u) || []), e]);
    }
  }
  for (const e of entities) {
    const names = [e.label, ...e.variants];
    for (const uri of e.sameAs) {
      const c = cache.get(canonicalCacheKey(uri));
      if (c?.missing) { issues.push({ entityId: e.id, entityLabel: e.label, uri, kind: "gone", detail: `${c.source === "lc" ? "LC" : "Wikidata"} no longer has this record` }); continue; }
      if (!c || !c.labels.length) continue;
      const theirs = c.labels.map((l) => l.value);
      if (namesAgree(names, theirs) === false) {
        issues.push({ entityId: e.id, entityLabel: e.label, uri, kind: "name-mismatch", detail: `${c.source === "lc" ? "LC" : "Wikidata"} calls it: ${theirs.slice(0, 3).join(" · ")}` });
      }
    }
  }
  for (const [link, es] of byLink) {
    if (es.length < 2) continue;
    for (const e of es) {
      issues.push({ entityId: e.id, entityLabel: e.label, uri: link, kind: "shared-link", detail: `Also linked from ${es.filter((x) => x.id !== e.id).map((x) => x.label).join(", ")}`, others: es.filter((x) => x.id !== e.id).map((x) => x.id) });
    }
  }
  const order = { gone: 0, "shared-link": 1, "name-mismatch": 2 } as const;
  return issues.sort((a, b) => order[a.kind] - order[b.kind] || a.entityLabel.localeCompare(b.entityLabel));
}
