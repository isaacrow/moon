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
