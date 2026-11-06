/**
 * Two things LC's records carry that Moon's editor does not write itself (BIBFRAME primer):
 *
 * - bflc:aap, the authorized access point: "a convenient label generated programmatically" from the
 *   creator and the title — "Obama, Michelle, 1964-. Becoming" — on Works and Hubs. For Arabic works the
 *   romanized forms are used when the record has them, as LC's are ("Mīr Dāmād, Muḥammad Bāqir. Qabasāt").
 * - Variant title types from LC's vocabulary (id.loc.gov/vocabulary/vartitletype) as rdf:type on
 *   bf:VariantTitle, alongside the plain bf:variantType text Moon writes.
 *
 * Applied when a record is served as linked data. Pure and dependency-free (edge function and node).
 */

const BF = "http://id.loc.gov/ontologies/bibframe/";
export const VARTITLETYPE = "http://id.loc.gov/vocabulary/vartitletype/";

/** LC's variant title types, matched from the words a cataloguer or a MARC 246 uses. */
const VARIANT_TYPES: Array<[RegExp, string]> = [
  [/translat|مترجم|ترجمة/i, "tra"],
  [/portion|part of title|جزء/i, "por"],
  [/cover|غلاف/i, "cov"],
  [/caption/i, "cap"],
  [/running|رأس الصفحة/i, "run"],
  [/spine|كعب/i, "spi"],
  [/added title|title page/i, "atp"],
  [/distinctive/i, "dis"],
  [/former|سابق/i, "for"],
];
export function variantTypeCode(text: string): string | undefined {
  return VARIANT_TYPES.find(([re]) => re.test(text))?.[1];
}

const list = (v: any): any[] => (Array.isArray(v) ? v : v == null ? [] : [v]);
const get = (n: any, key: string) => n?.[`bf:${key}`] ?? n?.[key] ?? n?.[`${BF}${key}`];
const types = (n: any): string[] => list(n?.["@type"]).map(String);
const isA = (n: any, cls: string) => types(n).some((t) => t === `bf:${cls}` || t === cls || t === `${BF}${cls}`);
const ARABIC = /[؀-ۿ]/;
const LATIN = /[A-Za-zÀ-ɏḀ-ỿ]/;

/** The text forms of a value; the romanized (Latin-script) one first when there is one. */
function texts(v: any): string[] {
  const out = list(v).map((x) => (typeof x === "string" ? x : x?.["@value"] ?? (typeof x?.["rdfs:label"] === "string" ? x["rdfs:label"] : undefined)))
    .filter((x): x is string => typeof x === "string" && !!x.trim()).map((x) => x.trim());
  return [...out.filter((x) => LATIN.test(x) && !ARABIC.test(x)), ...out.filter((x) => !(LATIN.test(x) && !ARABIC.test(x)))];
}
/** A heading part without its closing ISBD punctuation (" :", " /", ";", a final period after a word). */
export function bare(s: string): string {
  let v = s.trim().replace(/\s*[\/:;,=]+$/, "").trim();
  if (/\.$/.test(v) && !/(?<![\p{L}\p{M}])\p{L}\.$/u.test(v) && !/-\.$/.test(v)) v = v.slice(0, -1);
  return v.trim();
}

/** "Creator. Title" for a Work or Hub node, or undefined when it has no title. */
export function accessPoint(node: any, byId: Map<string, any>): string | undefined {
  const deref = (x: any) => (x && typeof x === "object" && x["@id"] && byId.has(x["@id"]) ? { ...byId.get(x["@id"]), ...x } : x);
  const titles = list(get(node, "title")).map(deref);
  const main = titles.find((t) => !isA(t, "VariantTitle")) || titles[0];
  const title = texts(get(main, "mainTitle"))[0];
  if (!title) return undefined;
  const parts = [...texts(get(main, "partNumber")), ...texts(get(main, "partName"))].map(bare);
  const contributions = list(get(node, "contribution")).map(deref);
  const primary = contributions.find((c) => isA(c, "PrimaryContribution")) || contributions.find((c) => {
    const roles = list(get(c, "role")).map((r) => (typeof r === "string" ? r : r?.["@id"] || r?.["rdfs:label"] || ""));
    return roles.some((r) => /(^|\/)aut$|author|مؤلف/i.test(String(r)));
  });
  const agent = primary ? deref(get(primary, "agent")) : undefined;
  const name = agent ? texts(agent["rdfs:label"] ?? agent["label"])[0] : undefined;
  return [name && bare(name), bare(title), ...parts].filter(Boolean).join(". ");
}

/** The document with access points on its Works and Hubs and LC types on its variant titles. Input untouched. */
export function withLcLabels(document: any): any {
  const doc = structuredClone(document || {});
  const graph: any[] = Array.isArray(doc["@graph"]) ? doc["@graph"] : [];
  const byId = new Map(graph.filter((n) => typeof n?.["@id"] === "string").map((n) => [n["@id"], n]));
  const visit = (n: any, seen = new Set<any>()) => {
    if (!n || typeof n !== "object" || seen.has(n)) return;
    seen.add(n);
    if (Array.isArray(n)) { n.forEach((x) => visit(x, seen)); return; }
    if ((isA(n, "Work") || isA(n, "Hub")) && n["bflc:aap"] === undefined && n["aap"] === undefined) {
      const aap = accessPoint(n, byId);
      if (aap) n["bflc:aap"] = aap;
    }
    if (isA(n, "VariantTitle")) {
      const code = texts(get(n, "variantType")).map(variantTypeCode).find(Boolean);
      if (code && !types(n).includes(`${VARTITLETYPE}${code}`)) n["@type"] = [...types(n), `${VARTITLETYPE}${code}`];
    }
    for (const [k, v] of Object.entries(n)) if (!k.startsWith("@")) visit(v, seen);
  };
  visit(graph);
  return doc;
}
