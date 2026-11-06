/**
 * Every name and subject in a saved record points at an authority. A contributor, publisher, place or
 * subject written as plain text (or picked as a local entry with no address) is matched to the entry in
 * Moon's authority file with that name, in any Arabic spelling, or a new entry is made; the record then
 * links to it (https://mooon.site/resource/agent|place|topic/<id>). Values already linked to LC, VIAF,
 * Wikidata or an LC vocabulary are left as they are.
 *
 * Runs on the server for every save, so records from the editor, MARC batches, imports and Blue Core
 * copies are all linked the same way. The function that adds entries is passed in, so this is tested
 * without a database.
 */

export type LinkKind = "agent" | "place" | "topic";
export interface LinkTarget { node: any; kind: LinkKind; label: string; variants: string[]; where: string }

const PLACEHOLDER = /^https?:\/\/(moonlib\.org\/authority\/|(www\.)?example\.(org|com)\/)/;
const AGENT_TYPES = /(Person|Organization|Family|Meeting|Jurisdiction|Agent)$/;
const ARABIC = /[؀-ۿ]/;

const all = (v: any): any[] => (v === undefined || v === null || v === "" ? [] : Array.isArray(v) ? v : [v]);
const get = (n: any, p: string) => n?.[`bf:${p}`] ?? n?.[p];
const typesOf = (n: any): string[] => all(n?.["@type"]).map(String);
const isA = (n: any, cls: string) => typesOf(n).some((t) => t === `bf:${cls}` || t === cls || t.endsWith(`/${cls}`));

function labelsOf(v: any): string[] {
  const out: string[] = [];
  for (const x of all(v)) {
    if (typeof x === "string") { if (x.trim()) out.push(x.trim()); continue; }
    if (x && typeof x === "object") {
      if (x["@value"] !== undefined) { if (String(x["@value"]).trim()) out.push(String(x["@value"]).trim()); continue; }
      out.push(...labelsOf(x["rdfs:label"] ?? x.label ?? x.name));
    }
  }
  return [...new Set(out)];
}

/** Has a real address (LC, VIAF, Wikidata, a vocabulary, or Moon's own authority file). */
function isLinked(node: any): boolean {
  const id = typeof node?.["@id"] === "string" ? node["@id"] : typeof node?.uri === "string" ? node.uri : "";
  return /^https?:\/\//.test(id.trim()) && !PLACEHOLDER.test(id.trim());
}

/**
 * The places in a record where a name or subject should be an authority link, turning plain-text values
 * into nodes in place so the link can be written into them.
 */
export function findUnlinked(document: any): LinkTarget[] {
  const graph: any[] = Array.isArray(document?.["@graph"]) ? document["@graph"] : [];
  const targets: LinkTarget[] = [];
  /** Makes parent[key] (or its i-th value) a node, so a link can be added to it. */
  const nodeAt = (parent: any, key: string, i: number | null): any => {
    const v = i === null ? parent[key] : parent[key][i];
    if (v && typeof v === "object" && v["@value"] === undefined) return v;
    const node = { "rdfs:label": v };
    if (i === null) parent[key] = node; else parent[key][i] = node;
    return node;
  };
  const consider = (parent: any, prop: string, kindOf: (n: any) => LinkKind, where: string) => {
    for (const key of [`bf:${prop}`, prop]) {
      if (parent?.[key] === undefined) continue;
      const list = Array.isArray(parent[key]);
      all(parent[key]).forEach((_v, i) => {
        const node = nodeAt(parent, key, list ? i : null);
        if (isLinked(node)) return;
        const labels = labelsOf(node);
        if (!labels.length) return;
        // Arabic script first as the heading, the other spellings as variants.
        const label = labels.find((l) => ARABIC.test(l)) || labels[0];
        targets.push({ node, kind: kindOf(node), label, variants: labels.filter((l) => l !== label), where });
      });
      return; // the bf: key wins over a bare copy of the same property
    }
  };
  for (const work of graph.filter((n) => isA(n, "Work"))) {
    for (const c of all(get(work, "contribution"))) if (c && typeof c === "object") consider(c, "agent", () => "agent", "contributor");
    consider(work, "subject", (n) => (isA(n, "Place") || isA(n, "GeographicCoverage") ? "place" : typesOf(n).some((t) => AGENT_TYPES.test(t)) ? "agent" : "topic"), "subject");
  }
  for (const instance of graph.filter((n) => isA(n, "Instance"))) {
    for (const p of all(get(instance, "provisionActivity"))) {
      if (!p || typeof p !== "object") continue;
      consider(p, "agent", () => "agent", "publisher");
      consider(p, "place", () => "place", "place of publication");
    }
  }
  return targets;
}

// ---------------------------------------------------------------------------
// Authority-link report (Phase 7, as Alma's URI enrichment report): after a MARC import, how many names
// and subjects reach an international authority (LC, VIAF, Wikidata, FAST, ISNI, ORCID), how many only
// Moon's own entry, and which ones to link next.

const MOON_AUTHORITY = /^https?:\/\/mooon\.site\/resource\/(agent|place|topic|hub)\/([^/?#.]+)$/;

export interface Heading { kind: LinkKind; label: string; uri: string | null; where: string }

/** Every name and subject heading in a record, linked or not (the record is not changed). */
export function headingsOf(document: any): Heading[] {
  const copy = JSON.parse(JSON.stringify(document || {}));
  const unlinked = new Set(findUnlinked(copy).map((t) => t.node));
  const out: Heading[] = [];
  const graph: any[] = Array.isArray(copy["@graph"]) ? copy["@graph"] : [];
  const visit = (parent: any, prop: string, kindOf: (n: any) => LinkKind, where: string) => {
    for (const key of [`bf:${prop}`, prop]) {
      if (parent?.[key] === undefined) continue;
      for (const node of all(parent[key])) {
        if (!node || typeof node !== "object") continue;
        const labels = labelsOf(node);
        const label = labels.find((l) => ARABIC.test(l)) || labels[0] || "";
        const uri = unlinked.has(node) ? null : String(node["@id"] ?? node.uri ?? "").trim() || null;
        if (label || uri) out.push({ kind: kindOf(node), label: label || uri!, uri, where });
      }
      return;
    }
  };
  for (const work of graph.filter((n) => isA(n, "Work"))) {
    for (const c of all(get(work, "contribution"))) if (c && typeof c === "object") visit(c, "agent", () => "agent", "contributor");
    visit(work, "subject", (n) => (isA(n, "Place") || isA(n, "GeographicCoverage") ? "place" : typesOf(n).some((t) => AGENT_TYPES.test(t)) ? "agent" : "topic"), "subject");
  }
  for (const instance of graph.filter((n) => isA(n, "Instance"))) {
    for (const p of all(get(instance, "provisionActivity"))) {
      if (!p || typeof p !== "object") continue;
      visit(p, "agent", () => "agent", "publisher");
      visit(p, "place", () => "place", "place of publication");
    }
  }
  return out;
}

/** The Moon authority entry id in a mooon.site/resource/<kind>/<id> URI. */
export const moonAuthorityId = (uri: string | null) => (uri ? (uri.match(MOON_AUTHORITY) || [])[2] || null : null);

export type LinkStatus = "international" | "moon-linked" | "moon-only" | "none";
export interface ReportRow {
  kind: LinkKind; label: string; uri: string | null; entryId: string | null; status: LinkStatus;
  sameAs: string[]; records: { id: string; title: string }[];
}
export interface AuthorityReport { headings: number; counts: Record<LinkStatus, number>; rows: ReportRow[] }

/**
 * One row per heading (by URI, else by kind + label) across the records. A Moon entry with an owl:sameAs to
 * LC, VIAF … counts as linked; without one it is "moon-only", the cataloguer's to-do list.
 * `entry` looks up a Moon authority entry by id (sameAs links).
 */
export function authorityReport(records: { id: string; title: string; document: any }[], entry: (id: string) => { sameAs: string[] } | null | undefined): AuthorityReport {
  const rows = new Map<string, ReportRow>();
  for (const r of records) {
    for (const h of headingsOf(r.document)) {
      const key = h.uri || `${h.kind}|${h.label}`;
      if (!rows.has(key)) {
        const entryId = moonAuthorityId(h.uri);
        const sameAs = entryId ? (entry(entryId)?.sameAs || []).filter((u) => /^https?:\/\//.test(u)) : [];
        const status: LinkStatus = !h.uri ? "none" : !entryId ? "international" : sameAs.length ? "moon-linked" : "moon-only";
        rows.set(key, { kind: h.kind, label: h.label, uri: h.uri, entryId, status, sameAs, records: [] });
      }
      const row = rows.get(key)!;
      if (!row.records.some((x) => x.id === r.id)) row.records.push({ id: r.id, title: r.title });
    }
  }
  const list = [...rows.values()];
  const counts: Record<LinkStatus, number> = { international: 0, "moon-linked": 0, "moon-only": 0, none: 0 };
  list.forEach((r) => counts[r.status]++);
  // To-do first (no link, then Moon-only), most-used first.
  const order: Record<LinkStatus, number> = { none: 0, "moon-only": 1, "moon-linked": 2, international: 3 };
  list.sort((a, b) => order[a.status] - order[b.status] || b.records.length - a.records.length || a.label.localeCompare(b.label));
  return { headings: list.length, counts, rows: list };
}

/** Links every unlinked name and subject; returns how many were linked. Never throws. */
export async function linkAuthorities(
  document: any,
  add: (input: { kind: LinkKind; label: string; variants: string[] }) => Promise<{ authority: { id: string; kind: string } }>,
  uriOf: (authority: { id: string; kind: string }) => string,
  max = 60,
): Promise<number> {
  let linked = 0;
  // The same name twice in one record is one lookup.
  const seen = new Map<string, Promise<string | null>>();
  for (const t of findUnlinked(document).slice(0, max)) {
    const key = `${t.kind}|${t.label}`;
    if (!seen.has(key)) {
      seen.set(key, add({ kind: t.kind, label: t.label, variants: t.variants }).then((r) => uriOf(r.authority)).catch(() => null));
    }
    const uri = await seen.get(key)!;
    if (!uri) continue;
    t.node["@id"] = uri;
    if (typeof t.node.uri === "string") t.node.uri = uri;
    linked++;
  }
  return linked;
}
