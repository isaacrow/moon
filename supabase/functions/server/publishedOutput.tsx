/**
 * The last step before Moon publishes a record as linked data (resource pages, the data dump, SPARQL,
 * OAI-PMH): Phase 12, step 3. The stored record is not changed; what the world reads is strict BIBFRAME 3.0.1.
 *
 * 1. Language: Arabic-script text is tagged @ar; its romanization beside it (the same field in both scripts)
 *    @ar-Latn, as LC tags parallel scripts.
 * 2. Dates: each publication's date as written gets a typed EDTF date beside it (a Hijri year gives the
 *    Gregorian years it runs across: "1445 هـ" → [2023,2024]).
 * 3. Terms outside BIBFRAME 3.0.1 become theirs: bf:creator → a primary bf:contribution, bf:classificationLcc
 *    → bf:classification (bf:ClassificationLcc), bf:topical → bf:subject (bf:Topic), bf:Expression → bf:Work,
 *    bf:catalogerId → bflc:catalogerId, bflc:TemporalCoverage → bf:Temporal; terms BIBFRAME has no place for
 *    (accessibility content, government publication, projected date) move to Moon's own namespace, kept.
 * 4. Kinds of value: an object property given text gets a node (an LC vocabulary address for codes such as
 *    "rda" or "ara", a link for a web address, else a labelled node of the property's class); a text property
 *    given a node gets the node's text.
 */
import { readDate } from "./hijri.tsx";
import { BF_OBJECT_PROPERTIES, BF_DATATYPE_PROPERTIES } from "./bibframeTerms.generated.tsx";

const ARABIC = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;
const LATIN = /[A-Za-zÀ-ɏḀ-ỿ]/;
const VOCAB = "http://id.loc.gov/vocabulary";
const EDTF = "http://id.loc.gov/datatypes/edtf";
const all = (v: any): any[] => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);
const bare = (k: string) => k.replace(/^bf:/, "");

/** Codes that stand for an LC vocabulary term, by property. */
const CODED: Record<string, (code: string) => string | null> = {
  descriptionConventions: (c) => (/^[a-z]{2,12}$/i.test(c) ? `${VOCAB}/descriptionConventions/${c.toLowerCase()}` : null),
  descriptionLanguage: (c) => (/^[a-z]{3}$/.test(c) ? `${VOCAB}/languages/${c}` : null),
  language: (c) => (/^[a-z]{3}$/.test(c) ? `${VOCAB}/languages/${c}` : null),
  issuance: (c) => (/^(mono|serl|intg|mulm)$/.test(c) ? `${VOCAB}/issuance/${c}` : null),
  carrier: (c) => (/^[a-z]{2}$/.test(c) ? `${VOCAB}/carriers/${c}` : null),
  media: (c) => (/^[a-z]$/.test(c) ? `${VOCAB}/mediaTypes/${c}` : null),
  content: (c) => (/^[a-z]{3}$/.test(c) ? `${VOCAB}/contentTypes/${c}` : null),
  descriptionAuthentication: (c) => (/^[a-z]{2,10}$/.test(c) ? `http://id.loc.gov/vocabulary/marcauthen/${c}` : null),
};
/** The class a text value becomes, by property. */
const CLASS_OF: Record<string, string> = {
  source: "bf:Source", shelfMark: "bf:ShelfMark", summary: "bf:Summary", tableOfContents: "bf:TableOfContents",
  note: "bf:Note", title: "bf:Title", genreForm: "bf:GenreForm", illustrativeContent: "bf:Illustration",
  intendedAudience: "bf:IntendedAudience", supplementaryContent: "bf:SupplementaryContent", originPlace: "bf:Place",
  geographicCoverage: "bf:GeographicCoverage", acquisitionSource: "bf:AcquisitionSource", immediateAcquisition: "bf:ImmediateAcquisition",
  generationProcess: "bf:GenerationProcess", translationOf: "bf:Work", extent: "bf:Extent", role: "bf:Role",
  descriptionConventions: "bf:DescriptionConventions", descriptionLanguage: "bf:Language", issuance: "bf:Issuance",
  carrier: "bf:Carrier", media: "bf:Media", content: "bf:Content",
};
const MOVED_TO_MOON: Record<string, string> = {
  "bf:accessibilityContent": "moonext:accessibilityContent", "bf:governmentPublication": "moonext:governmentPublication",
  "bf:projectedProvisionDate": "moonext:projectedProvisionDate", "bf:catalogerId": "bflc:catalogerId",
};
const TYPE_MAP: Record<string, string[]> = {
  "bf:Expression": ["bf:Work", "moonext:Expression"], "bf:AccessibilityContent": ["moonext:AccessibilityContent"],
  "bf:GovernmentPublication": ["moonext:GovernmentPublication"], "bflc:TemporalCoverage": ["bf:Temporal"],
};

const textOf = (v: any): string => {
  for (const x of all(v)) {
    if (typeof x === "string" || typeof x === "number") return String(x);
    if (x && typeof x === "object") { const t = textOf(x["@value"] ?? x["rdfs:label"] ?? x["bf:mainTitle"]); if (t) return t; }
  }
  return "";
};

/** A text value for an object property, as the node it should be. */
function asNode(prop: string, v: string): any {
  const p = bare(prop);
  if (/^https?:\/\/\S+$/.test(v)) return { "@id": v };
  const coded = CODED[p]?.(v.trim());
  if (coded) return { "@id": coded, "rdfs:label": v.trim() };
  if (p === "title") return { "@type": "bf:Title", "bf:mainTitle": v };
  return { ...(CLASS_OF[p] ? { "@type": CLASS_OF[p] } : {}), "rdfs:label": v };
}

/** Strings in two scripts on one property: Arabic @ar, the romanized form @ar-Latn. */
function tagLiterals(values: any[]): any[] {
  const strings = values.filter((x) => typeof x === "string");
  const parallel = strings.some((s) => ARABIC.test(s)) && strings.some((s) => LATIN.test(s) && !ARABIC.test(s));
  return values.map((x) => {
    if (typeof x === "string") {
      if (ARABIC.test(x)) return { "@value": x, "@language": "ar" };
      if (parallel && LATIN.test(x)) return { "@value": x, "@language": "ar-Latn" };
      return x;
    }
    if (x && typeof x === "object" && typeof x["@value"] === "string" && !x["@language"] && !x["@type"] && ARABIC.test(x["@value"])) {
      return { ...x, "@language": "ar" };
    }
    return x;
  });
}

function fixNode(n: any, parentKey = ""): any {
  if (Array.isArray(n)) return n.map((x) => fixNode(x, parentKey));
  if (!n || typeof n !== "object" || "@value" in n) return n;
  const out: any = {};
  for (const [k0, v0] of Object.entries(n)) {
    if (k0 === "@type") {
      const types = all(v0).flatMap((t) => (typeof t === "string" && TYPE_MAP[t] ? TYPE_MAP[t] : [t]));
      out["@type"] = types.length === 1 ? types[0] : [...new Set(types)];
      continue;
    }
    if (k0.startsWith("@")) { out[k0] = v0; continue; }
    const k = MOVED_TO_MOON[k0] || k0;
    let values = all(v0);
    const p = k.startsWith("bf:") ? bare(k) : "";
    if (p && BF_OBJECT_PROPERTIES.has(p)) values = values.map((x) => (typeof x === "string" || typeof x === "number" ? asNode(k, String(x)) : x));
    else if (p && BF_DATATYPE_PROPERTIES.has(p)) values = values.map((x) => (x && typeof x === "object" && !("@value" in x) ? textOf(x) : x)).filter((x) => x !== "");
    values = tagLiterals(values.map((x) => fixNode(x, k)));
    const prev = out[k] === undefined ? [] : all(out[k]);
    const merged = [...prev, ...values];
    out[k] = merged.length === 1 && !Array.isArray(v0) && !prev.length ? merged[0] : merged;
  }
  // A publication's date as written, with its EDTF reading beside it.
  if (/provisionActivity$/.test(parentKey) && out["bf:date"] !== undefined) {
    const dates = all(out["bf:date"]);
    if (!dates.some((d) => d && typeof d === "object" && d["@type"] === EDTF)) {
      const r = readDate(textOf(dates));
      if (r.edtf) out["bf:date"] = [...dates, { "@value": r.edtf, "@type": EDTF }];
    }
  }
  return out;
}

/** The Work's bf:creator values as a primary contribution each (unless already a contribution). */
function creatorsToContributions(n: any): any {
  if (!n || typeof n !== "object" || n["bf:creator"] === undefined) return n;
  const { "bf:creator": creators, ...rest } = n;
  const contributions = all(rest["bf:contribution"]);
  const known = new Set(contributions.map((c: any) => JSON.stringify(c?.["bf:agent"]?.["@id"] || textOf(c?.["bf:agent"]))));
  for (const a of all(creators)) {
    const agent = typeof a === "string" ? (/^https?:\/\//.test(a) ? { "@id": a } : { "@type": "bf:Agent", "rdfs:label": a }) : a;
    const key = JSON.stringify(agent?.["@id"] || textOf(agent));
    if (known.has(key)) continue;
    known.add(key);
    contributions.push({ "@type": ["bf:Contribution", "bf:PrimaryContribution"], "bf:agent": agent });
  }
  return { ...rest, "bf:contribution": contributions };
}

/** bf:classificationLcc / bf:topical (older records) as bf:classification / bf:subject. */
function legacyToBibframe(n: any): any {
  if (!n || typeof n !== "object") return n;
  const out = { ...n };
  if (out["bf:classificationLcc"] !== undefined) {
    const cls = all(out["bf:classification"]);
    for (const v of all(out["bf:classificationLcc"])) cls.push({ "@type": "bf:ClassificationLcc", "bf:classificationPortion": textOf(v) });
    out["bf:classification"] = cls;
    delete out["bf:classificationLcc"];
  }
  if (out["bf:topical"] !== undefined) {
    const subjects = all(out["bf:subject"]);
    for (const v of all(out["bf:topical"])) subjects.push(typeof v === "string" ? (/^https?:\/\//.test(v) ? { "@id": v } : { "@type": "bf:Topic", "rdfs:label": v }) : v);
    out["bf:subject"] = subjects;
    delete out["bf:topical"];
  }
  return out;
}

/**
 * Older records' terms in place (bf:creator → a primary contribution, bf:classificationLcc, bf:topical), so
 * a save or the linking job can link those names and subjects too. Changes the document; returns whether
 * anything changed.
 */
export function upgradeLegacyTerms(document: any): boolean {
  const graph = Array.isArray(document?.["@graph"]) ? document["@graph"] : null;
  if (!graph) return false;
  let changed = false;
  for (let i = 0; i < graph.length; i++) {
    const next = legacyToBibframe(creatorsToContributions(graph[i]));
    if (next !== graph[i] && JSON.stringify(next) !== JSON.stringify(graph[i])) { graph[i] = next; changed = true; }
  }
  return changed;
}

/** The record as Moon publishes it: strict BIBFRAME 3.0.1, tagged, typed. The input is not changed. */
export function finishPublished(document: any): any {
  const graph = Array.isArray(document?.["@graph"]) ? document["@graph"] : [];
  return { ...document, "@graph": graph.map((node: any) => fixNode(legacyToBibframe(creatorsToContributions(node)))) };
}
