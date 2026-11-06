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

export type LinkKind = "agent" | "place" | "topic" | "hub";
/** A name, subject or hub to link. sameAs: the outside links the record already gives it (Wikidata, VIAF,
 *  LC …), which its Moon entity keeps; data: what the entity should know (an agent's type, a hub's title). */
export interface LinkTarget {
  node: any; kind: LinkKind; label: string; variants: string[]; where: string;
  sameAs: string[]; data: Record<string, unknown>;
}

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
/** owl:sameAs (and MADS's exact external authority) links on a node. */
function sameAsOf(node: any): string[] {
  const out: string[] = [];
  for (const key of ["owl:sameAs", "sameAs", "madsrdf:hasExactExternalAuthority"]) {
    for (const x of all(node?.[key])) {
      const u = typeof x === "string" ? x : x?.["@id"];
      if (typeof u === "string" && /^https?:\/\/\S+$/.test(u) && !PLACEHOLDER.test(u)) out.push(u);
    }
  }
  return [...new Set(out)];
}

/** What an entity for this node should know: an agent's LC type and dates, a hub's title and creator. */
function dataOf(node: any, kind: LinkKind, where: string): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  if (kind === "agent") {
    const t = typesOf(node).join(" ");
    data.agentType = /Organization|Corporate/.test(t) ? "organization" : /Family/.test(t) ? "family"
      : /Meeting|Conference/.test(t) ? "meeting" : /Jurisdiction/.test(t) ? "jurisdiction"
      : /Person/.test(t) ? "person" : where === "publisher" ? "organization" : "person";
    for (const [from, to] of [["madsrdf:birthDate", "birthDate"], ["madsrdf:deathDate", "deathDate"]]) {
      const v = labelsOf(node?.[from])[0];
      if (v) data[to] = v;
    }
  }
  if (kind === "hub") {
    const title = all(get(node, "title")).map((t) => (typeof t === "string" ? t : labelsOf(get(t, "mainTitle"))[0])).find(Boolean);
    if (title) data.title = title;
    for (const c of all(get(node, "contribution"))) {
      const agent = get(c, "agent");
      const name = labelsOf(agent)[0];
      if (name) { data.creator = name; if (typeof agent?.["@id"] === "string") data.creatorUri = agent["@id"]; break; }
    }
  }
  return data;
}

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
        const kind = kindOf(node);
        // A hub's name is its authorized access point (bflc:aap), as LC and Moon's MARC import write it.
        const labels = kind === 'hub' && labelsOf(node['bflc:aap'] ?? node.aap).length ? labelsOf(node['bflc:aap'] ?? node.aap) : labelsOf(node);
        if (!labels.length) return;
        // Arabic script first as the heading, the other spellings as variants.
        const label = labels.find((l) => ARABIC.test(l)) || labels[0];
        targets.push({ node, kind, label, variants: labels.filter((l) => l !== label), where, sameAs: sameAsOf(node), data: dataOf(node, kind, where) });
      });
      return; // the bf: key wins over a bare copy of the same property
    }
  };
  for (const work of graph.filter((n) => isA(n, "Work"))) {
    for (const c of all(get(work, "contribution"))) if (c && typeof c === "object") consider(c, "agent", () => "agent", "contributor");
    // The work it expresses (a Hub, LC's "work group"): one Moon hub per access point, shared by every edition.
    consider(work, "expressionOf", () => "hub", "work group");
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

const MOON_AUTHORITY = /^https?:\/\/mooon\.site\/resource\/(agent|place|topic|hub|genre|period)\/([^/?#.]+)$/;

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

// ---------------------------------------------------------------------------
// Headings already linked outside (Phase 10, step 4). A name or subject picked from LC, VIAF or Wikidata keeps
// that address in the record, as LC's own records do (MARC export writes it as $0/$1). Moon's entity store
// still gets an entity for it, linked to that address, so the person, place or subject exists in Moon too:
// with its uses counted, its OPAC page, and one entity however many records and spellings point to it.

/** The outside authority files Moon's entities link to (the same list the server accepts as sameAs). */
const OUTSIDE_AUTHORITY = /^https?:\/\/(id\.loc\.gov\/(authorities|rwo)\/|viaf\.org\/viaf\/|(www\.)?wikidata\.org\/(wiki|entity)\/Q\d+$|id\.worldcat\.org\/fast\/|isni\.org\/isni\/|orcid\.org\/)/;

/** Names, subjects, publishers and places whose address is an LC, VIAF, Wikidata, FAST, ISNI or ORCID link. */
export function findOutsideLinked(document: any): LinkTarget[] {
  const graph: any[] = Array.isArray(document?.["@graph"]) ? document["@graph"] : [];
  const targets: LinkTarget[] = [];
  const visit = (parent: any, prop: string, kindOf: (n: any) => LinkKind, where: string) => {
    for (const key of [`bf:${prop}`, prop]) {
      if (parent?.[key] === undefined) continue;
      for (const node of all(parent[key])) {
        if (!node || typeof node !== "object") continue;
        const id = String(node["@id"] ?? node.uri ?? "").trim();
        if (!OUTSIDE_AUTHORITY.test(id)) continue;
        const labels = labelsOf(node);
        if (!labels.length) continue;
        const kind = kindOf(node);
        const label = labels.find((l) => ARABIC.test(l)) || labels[0];
        const sameAs = [...new Set([id, ...sameAsOf(node)])].filter((u) => OUTSIDE_AUTHORITY.test(u));
        targets.push({ node, kind, label, variants: labels.filter((l) => l !== label), where, sameAs, data: dataOf(node, kind, where) });
      }
      return; // the bf: key wins over a bare copy of the same property
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
  return targets;
}

/**
 * Makes sure every outside-linked heading has its Moon entity (found by that link, else by name, else made).
 * The record is not changed. Returns how many headings were looked up; never throws.
 */
export async function mirrorOutsideLinked(
  document: any,
  add: (input: { kind: LinkKind; label: string; variants: string[]; sameAs: string[]; data: Record<string, unknown> }) => Promise<unknown>,
  max = 40,
): Promise<number> {
  const seen = new Set<string>();
  let n = 0;
  for (const t of findOutsideLinked(document).slice(0, max)) {
    const key = `${t.kind}|${t.sameAs[0]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      await add({ kind: t.kind, label: t.label, variants: t.variants, sameAs: t.sameAs, data: t.data });
      n++;
    } catch {
      // One heading that cannot be stored never stops the save.
    }
  }
  return n;
}

/** Links every unlinked name and subject; returns how many were linked. Never throws. */
export async function linkAuthorities(
  document: any,
  add: (input: { kind: LinkKind; label: string; variants: string[]; sameAs: string[]; data: Record<string, unknown> }) => Promise<{ authority: { id: string; kind: string } }>,
  uriOf: (authority: { id: string; kind: string }) => string,
  max = 60,
): Promise<number> {
  let linked = 0;
  // The same name twice in one record is one lookup.
  const seen = new Map<string, Promise<string | null>>();
  for (const t of findUnlinked(document).slice(0, max)) {
    const key = `${t.kind}|${t.label}`;
    if (!seen.has(key)) {
      seen.set(key, add({ kind: t.kind, label: t.label, variants: t.variants, sameAs: t.sameAs, data: t.data }).then((r) => uriOf(r.authority)).catch(() => null));
    }
    const uri = await seen.get(key)!;
    if (!uri) continue;
    t.node["@id"] = uri;
    if (typeof t.node.uri === "string") t.node.uri = uri;
    linked++;
  }
  return linked;
}
