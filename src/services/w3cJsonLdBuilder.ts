/**
 * W3C-Compliant JSON-LD Builder
 * 
 * Produces JSON-LD that passes:
 * - W3C RDF & JSON-LD 1.1 Specifications
 * - JSON-LD Playground (https://json-ld.org/playground/)
 * - Apache Jena / Fuseki triple store ingestion
 * - Blazegraph / GraphDB / Virtuoso import
 * 
 * Key architectural guarantees:
 * 1. Full @context with all canonical BIBFRAME and Linked Data prefixes
 * 2. Proper Work -> Expression -> Instance -> Item WEMI graph linkages
 * 3. Consistent literal ({ "@value": ... }) and node reference ({ "@id": ... }) representation
 * 4. Comprehensive Structural vs. BIBFRAME Semantic validation engine
 * 5. High-fidelity Turtle and N-Triples serialization
 */

import { toTurtle, resolvePropertyUri, KNOWN_NAMESPACES, hoistNamedNodes } from './rdfGraphBuilder';
import { normalizeBibframe, finishForExport } from './bibframeNormalizer';
import { BASE_URI } from './uriMintingService';
import { BF_PROPERTY_DOMAINS, BF_DATATYPE_PROPERTIES, BF_CLASSES } from './bibframeTerms.generated';

// =====================================================
// CANONICAL BIBFRAME & LINKED DATA @context
// =====================================================
export const BIBFRAME_JSONLD_CONTEXT: Record<string, string> = {
  "bf": "http://id.loc.gov/ontologies/bibframe/",
  "bflc": "http://id.loc.gov/ontologies/bflc/",
  "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
  "xsd": "http://www.w3.org/2001/XMLSchema#",
  "owl": "http://www.w3.org/2002/07/owl#",
  "skos": "http://www.w3.org/2004/02/skos/core#",
  "dcterms": "http://purl.org/dc/terms/",
  "foaf": "http://xmlns.com/foaf/0.1/",
  "madsrdf": "http://www.loc.gov/mads/rdf/v1#",
  "lcsh": "http://id.loc.gov/authorities/subjects/",
  "lcnaf": "http://id.loc.gov/authorities/names/",
  "lcgft": "http://id.loc.gov/authorities/genreForms/",
  "lcc": "http://id.loc.gov/vocabulary/classSchemes/",
  "relators": "http://id.loc.gov/vocabulary/relators/",
  "languages": "http://id.loc.gov/vocabulary/languages/",
  "carriers": "http://id.loc.gov/vocabulary/carriers/",
  "mediaTypes": "http://id.loc.gov/vocabulary/mediaTypes/",
  "countries": "http://id.loc.gov/vocabulary/countries/",
  "contentTypes": "http://id.loc.gov/vocabulary/contentTypes/",
  "issuance": "http://id.loc.gov/vocabulary/issuance/",
  "descriptionConventions": "http://id.loc.gov/vocabulary/descriptionConventions/",
  "moon": `${BASE_URI}/`
};

// =====================================================
// TYPES
// =====================================================

export interface W3CJsonLdNode {
  "@id": string;
  "@type": string | string[];
  [key: string]: any;
}

export interface W3CJsonLdDocument {
  "@context": Record<string, string>;
  "@graph": W3CJsonLdNode[];
}

export interface BuilderInput {
  workData: any;
  instanceData: any;
  itemData?: any;
  expressionData?: any;
  adminData?: any;
  uriSet: {
    work: string;
    instance: string;
    item: string;
    expression: string;
    admin: string;
  };
  enableExpression?: boolean;
}

export interface ValidationSection {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface JsonLdValidationResult {
  valid: boolean;
  structural: ValidationSection;
  semantic: ValidationSection;
  errors: string[];
  warnings: string[];
  info: string[];
  stats: {
    nodeCount: number;
    tripleEstimate: number;
    prefixesUsed: string[];
    typesFound: string[];
    allNodesHaveId: boolean;
    allNodesHaveType: boolean;
    contextComplete: boolean;
    hasWork: boolean;
    hasInstance: boolean;
    hasItem: boolean;
    hasWorkTitle: boolean;
    hasInstanceTitle: boolean;
  };
}

// =====================================================
// BUILDER
// =====================================================

/**
 * Build a W3C-compliant JSON-LD document from cataloging data.
 * Guarantees proper WEMI graph links between Work, Expression, Instance, and Item.
 */
export function buildW3CJsonLd(input: BuilderInput): W3CJsonLdDocument {
  const { workData, instanceData, itemData, expressionData, adminData, uriSet, enableExpression } = input;
  const graph: W3CJsonLdNode[] = [];
  const misplaced: MisplacedProperty[] = [];

  // 1. BUILD WORK NODE
  const workNode = buildWorkNode(workData || {}, uriSet, enableExpression, misplaced);
  graph.push(workNode);

  // 2. BUILD EXPRESSION NODE (optional)
  if (enableExpression) {
    const exprNode = buildExpressionNode(expressionData || {}, uriSet, workNode, misplaced);
    graph.push(exprNode);
  }

  // 3. BUILD INSTANCE NODE
  const instanceNode = buildInstanceNode(instanceData || {}, uriSet, enableExpression, misplaced);
  graph.push(instanceNode);

  // 4. BUILD ITEM NODE
  const itemNode = buildItemNode(itemData || {}, uriSet, misplaced);
  graph.push(itemNode);

  // 5. BUILD ADMIN METADATA NODE
  const adminNode = buildAdminNode(adminData || {}, workData?.["bf:adminMetadata"] || workData?.adminMetadata, uriSet);
  graph.push(adminNode);

  // 6. MOVE PROPERTIES ENTERED ON THE WRONG ENTITY TO THE ONE BIBFRAME DEFINES THEM FOR
  relocateMisplaced(misplaced, { Work: workNode, Instance: instanceNode, Item: itemNode, AdminMetadata: adminNode }, graph);

  // 7. A title entered once (on the Work, or by ISBN lookup) describes the Instance too, and vice versa.
  const sharedTitle = workNode["bf:title"] || instanceNode["bf:title"];
  for (const n of graph) {
    if (sharedTitle && !n["bf:title"] && [].concat(n["@type"]).some((t: string) => t === "bf:Work" || t === "bf:Instance")) {
      n["bf:title"] = JSON.parse(JSON.stringify(sharedTitle));
    }
  }

  // 8. Every link must be a real IRI: an id like "ai-1730…" or "Q42" would make Turtle/N-Triples unparseable.
  for (const n of graph) for (const k of Object.keys(n)) if (!k.startsWith("@")) n[k] = sanitizeIds(n[k]);


  // Only official BIBFRAME/BFLC terms leave the builder (custom fields are preserved as moonext:).
  return normalizeBibframe({
    "@context": { ...BIBFRAME_JSONLD_CONTEXT },
    "@graph": graph
  }) as W3CJsonLdDocument;
}

// =====================================================
// NODE BUILDERS
// =====================================================

function buildWorkNode(data: any, uriSet: any, enableExpression?: boolean, misplaced?: MisplacedProperty[]): W3CJsonLdNode {
  const node: W3CJsonLdNode = {
    "@id": uriSet.work,
    "@type": entityTypes("bf:Work", data),
    "bf:hasInstance": [{ "@id": uriSet.instance }]
  };

  if (enableExpression) {
    node["bf:hasExpression"] = [{ "@id": uriSet.expression }];
  }

  // Titles: every title and every script of it (LC gives romanized and Arabic-script mainTitles).
  // No placeholder titles: an untitled Work is left untitled (validation reports it) or borrows the Instance's.
  const titles = buildTitles(data);
  if (titles.length > 0) node["bf:title"] = titles;

  // Contributions
  const contributions = extractContributions(data, uriSet.work);
  if (contributions.length > 0) {
    node["bf:contribution"] = contributions;
  }

  // Language
  const lang = extractProperty(data, "bf:language", "language");
  if (lang) {
    const refs = asList(lang).map(l => vocabRef(l, "languages", "bf:Language")).filter(Boolean);
    if (refs.length) node["bf:language"] = refs;
  }

  // Subjects and genre/form: authority links keep their IRI; whatever else describes them is kept.
  const subjects = extractArrayProperty(data, "bf:subject", "subject");
  if (subjects.length > 0) node["bf:subject"] = subjects.map(s => describedNode(s, "bf:Topic")).filter(Boolean);
  const genres = extractArrayProperty(data, "bf:genreForm", "genreForm");
  if (genres.length > 0) node["bf:genreForm"] = genres.map(g => describedNode(g, "bf:GenreForm")).filter(Boolean);

  // Classification
  const classifications = extractArrayProperty(data, "bf:classification", "classification");
  if (classifications.length > 0) {
    node["bf:classification"] = classifications.map(c => {
      if (c && typeof c === "object" && c["@value"] === undefined) {
        const out: any = { "@type": c["@type"] || "bf:Classification" };
        const portion = texts(c["bf:classificationPortion"] ?? c["classificationPortion"]);
        const itemPortion = texts(c["bf:itemPortion"] ?? c["itemPortion"]);
        if (portion.length) out["bf:classificationPortion"] = portion;
        if (itemPortion.length) out["bf:itemPortion"] = itemPortion;
        if (c["bf:edition"]) out["bf:edition"] = texts(c["bf:edition"]);
        if (typeof c["bf:source"] === "string") out["bf:source"] = [{ "@id": c["bf:source"] }];
        keepRest(c, out, ["bf:classificationPortion", "bf:itemPortion", "bf:edition", "rdfs:label", ...(typeof c["bf:source"] === "string" ? ["bf:source"] : [])]);
        return out;
      }
      return { "@type": "bf:Classification", "bf:classificationPortion": texts(c) };
    }).filter(c => c["bf:classificationPortion"]?.length || c["bf:itemPortion"]?.length || Object.keys(c).length > 1);
  }

  // Summary
  const summaries = extractArrayProperty(data, "bf:summary", "summary").map(s => labelledNode(s, "bf:Summary")).filter(Boolean);
  if (summaries.length) node["bf:summary"] = summaries;

  // Content type
  const content = extractProperty(data, "bf:content", "content");
  if (content) {
    const refs = asList(content).map(c => vocabRef(c, "contentTypes", "bf:Content")).filter(Boolean);
    if (refs.length) node["bf:content"] = refs;
  }

  // Origin date
  const originDates = texts(extractProperty(data, "bf:originDate", "originDate")).map(t => dateLiteral(t["@value"]));
  if (originDates.length) node["bf:originDate"] = originDates;

  // Notes
  const notes = extractArrayProperty(data, "bf:note", "note").map(n => labelledNode(n, "bf:Note")).filter(Boolean);
  if (notes.length) node["bf:note"] = notes;

  // Preserve other custom properties in workData
  preserveCustomProperties(data, node, [
    "title", "bf:title", "contribution", "bf:contribution", "language", "bf:language",
    "subject", "bf:subject", "genreForm", "bf:genreForm", "classification", "bf:classification",
    "summary", "bf:summary", "content", "bf:content", "originDate", "bf:originDate",
    "note", "bf:note", "hasInstance", "bf:hasInstance", "hasExpression", "bf:hasExpression",
    "adminMetadata", "bf:adminMetadata", "id", "uri", "created", "updated", "_type", "_raw"
  ], "Work", misplaced);

  // Admin metadata reference
  node["bf:adminMetadata"] = [{ "@id": uriSet.admin }];

  return cleanNode(node);
}

function buildExpressionNode(data: any, uriSet: any, workNode: any, misplaced?: MisplacedProperty[]): W3CJsonLdNode {
  const node: W3CJsonLdNode = {
    "@id": uriSet.expression,
    "@type": "bf:Work", // BIBFRAME has no Expression class; expressions are Works with bf:expressionOf
    "bf:expressionOf": { "@id": uriSet.work },
    "bf:hasInstance": [{ "@id": uriSet.instance }]
  };

  // An expression is a Work too, and Works carry a title; it shares its Work's title unless given its own.
  const ownTitles = buildTitles(data);
  node["bf:title"] = ownTitles.length ? ownTitles : JSON.parse(JSON.stringify(workNode["bf:title"] || []));

  const lang = extractProperty(data, "bf:language", "language");
  if (lang) {
    const refs = asList(lang).map(l => vocabRef(l, "languages", "bf:Language")).filter(Boolean);
    if (refs.length) node["bf:language"] = refs;
  }

  preserveCustomProperties(data, node, [
    "title", "bf:title", "language", "bf:language", "expressionOf", "bf:expressionOf", "hasInstance", "bf:hasInstance",
    "id", "uri", "created", "updated", "_type", "_raw"
  ], "Work", misplaced);

  return cleanNode(node);
}

function buildInstanceNode(data: any, uriSet: any, hasExpression?: boolean, misplaced?: MisplacedProperty[]): W3CJsonLdNode {
  const node: W3CJsonLdNode = {
    "@id": uriSet.instance,
    "@type": entityTypes("bf:Instance", data),
    "bf:instanceOf": { "@id": hasExpression ? uriSet.expression : uriSet.work },
    "bf:hasItem": [{ "@id": uriSet.item }]
  };

  const titles = buildTitles(data);
  if (titles.length > 0) node["bf:title"] = titles;

  // Transcribed statements keep every value and script.
  for (const [prefixed, short] of [
    ["bf:editionStatement", "editionStatement"], ["bf:responsibilityStatement", "responsibilityStatement"],
    ["bf:dimensions", "dimensions"], ["bf:seriesStatement", "seriesStatement"]
  ]) {
    const values = texts(extractProperty(data, prefixed, short));
    if (values.length) node[prefixed] = values;
  }

  // Identifiers
  const identifiers = extractArrayProperty(data, "bf:identifiedBy", "identifiedBy").map(id => identifierNode(id, "bf:Identifier")).filter(Boolean);
  if (identifiers.length > 0) node["bf:identifiedBy"] = identifiers;

  // Provision activity (Publication/Distribution/Manufacture)
  const provisions = extractArrayProperty(data, "bf:provisionActivity", "provisionActivity");
  if (provisions.length > 0) {
    node["bf:provisionActivity"] = provisions.filter(p => p && typeof p === "object").map(p => {
      const prov: any = { "@type": p["@type"] || "bf:Publication" };

      const agents = asList(p["bf:agent"] ?? p["agent"]).map(a => namedNode(a, "bf:Agent", "agent")).filter(Boolean);
      if (agents.length) prov["bf:agent"] = agents;

      const places = asList(p["bf:place"] ?? p["place"]).map(pl => namedNode(pl, "bf:Place", "place")).filter(Boolean);
      if (places.length) prov["bf:place"] = places;

      const dates = texts(p["bf:date"] ?? p["date"]).map(t => dateLiteral(t["@value"]));
      if (dates.length) prov["bf:date"] = dates;

      keepRest(p, prov, ["bf:agent", "bf:place", "bf:date"]);
      return prov;
    });
  }

  // Extent
  const extents = extractArrayProperty(data, "bf:extent", "extent").map(e => labelledNode(e, "bf:Extent")).filter(Boolean);
  if (extents.length) node["bf:extent"] = extents;

  // Carrier, media, issuance
  for (const [prefixed, short, vocab, type] of [
    ["bf:carrier", "carrier", "carriers", "bf:Carrier"], ["bf:media", "media", "mediaTypes", "bf:Media"],
    ["bf:issuance", "issuance", "issuance", "bf:Issuance"]
  ]) {
    const v = extractProperty(data, prefixed, short);
    const refs = v ? asList(v).map(x => vocabRef(x, vocab, type)).filter(Boolean) : [];
    if (refs.length) node[prefixed] = refs;
  }

  // Copyright date
  const copyright = texts(extractProperty(data, "bf:copyrightDate", "copyrightDate")).map(t => dateLiteral(t["@value"]));
  if (copyright.length) node["bf:copyrightDate"] = copyright;

  // Notes
  const notes = extractArrayProperty(data, "bf:note", "note").map(n => labelledNode(n, "bf:Note")).filter(Boolean);
  if (notes.length) node["bf:note"] = notes;

  // Preserve other custom properties
  preserveCustomProperties(data, node, [
    "title", "bf:title", "editionStatement", "bf:editionStatement", "responsibilityStatement", "bf:responsibilityStatement",
    "identifiedBy", "bf:identifiedBy", "provisionActivity", "bf:provisionActivity", "extent", "bf:extent",
    "dimensions", "bf:dimensions", "carrier", "bf:carrier", "media", "bf:media", "issuance", "bf:issuance",
    "seriesStatement", "bf:seriesStatement", "copyrightDate", "bf:copyrightDate", "note", "bf:note",
    "instanceOf", "bf:instanceOf", "hasItem", "bf:hasItem", "id", "uri", "created", "updated", "_type", "_raw"
  ], "Instance", misplaced);

  return cleanNode(node);
}

function buildItemNode(data: any, uriSet: any, misplaced?: MisplacedProperty[]): W3CJsonLdNode {
  const node: W3CJsonLdNode = {
    "@id": uriSet.item,
    "@type": "bf:Item",
    "bf:itemOf": { "@id": uriSet.instance }
  };

  // Held by: a typed library name gets a stable Moon URI so the same library is the same agent everywhere.
  const heldBy = asList(extractProperty(data, "bf:heldBy", "heldBy")).map(h => {
    if (h && typeof h === "object" && h["@value"] === undefined) return namedNode(h, "bf:Organization", "org");
    const label = text(h);
    return label ? { "@id": `${BASE_URI}/org/${simpleHash(label)}`, "@type": "bf:Organization", "rdfs:label": label } : null;
  }).filter(Boolean);
  if (heldBy.length) node["bf:heldBy"] = heldBy.length === 1 ? heldBy[0] : heldBy;

  // Shelf mark
  const shelfMarks = extractArrayProperty(data, "bf:shelfMark", "shelfMark").map(s => labelledNode(s, "bf:ShelfMark")).filter(Boolean);
  if (shelfMarks.length) node["bf:shelfMark"] = shelfMarks;

  // Electronic locator
  const elocs = asList(extractProperty(data, "bf:electronicLocator", "electronicLocator"))
    .map(e => (e && typeof e === "object" && e["@id"]) ? { "@id": e["@id"] } : (text(e) ? { "@id": text(e) } : null)).filter(Boolean);
  if (elocs.length) node["bf:electronicLocator"] = elocs;

  // Identifiers / Barcodes
  const identifiers = extractArrayProperty(data, "bf:identifiedBy", "identifiedBy").map(id => identifierNode(id, "bf:Barcode")).filter(Boolean);
  if (identifiers.length > 0) node["bf:identifiedBy"] = identifiers;

  preserveCustomProperties(data, node, [
    "heldBy", "bf:heldBy", "shelfMark", "bf:shelfMark", "electronicLocator", "bf:electronicLocator",
    "identifiedBy", "bf:identifiedBy", "itemOf", "bf:itemOf", "id", "uri", "created", "updated", "_type", "_raw"
  ], "Item", misplaced);

  return cleanNode(node);
}

// =====================================================
// VALUE HELPERS: normalize what the builder knows, keep everything else
// =====================================================

const asList = (v: any): any[] => (v === undefined || v === null || v === "" ? [] : Array.isArray(v) ? v : [v]);

/** All literal values in v as { "@value" } objects, keeping language tags and datatypes (deduplicated). */
function texts(v: any): any[] {
  const out: any[] = [];
  const seen = new Set<string>();
  const add = (lit: any) => {
    const key = JSON.stringify(lit);
    if (String(lit["@value"]).trim() && !seen.has(key)) { seen.add(key); out.push(lit); }
  };
  const walk = (x: any) => {
    if (x === undefined || x === null || x === "") return;
    if (Array.isArray(x)) return x.forEach(walk);
    if (typeof x === "object") {
      if (x["@value"] !== undefined) return add({ ...x, "@value": String(x["@value"]) });
      if (x["@id"] && Object.keys(x).length === 1) return;
      return walk(x["rdfs:label"] ?? x["label"] ?? x["rdf:value"] ?? x["value"] ?? x["bf:mainTitle"]);
    }
    add({ "@value": String(x) }); // kept exactly: LC writes LCCNs as " 2016496993"
  };
  walk(v);
  return out;
}

/** The first literal in v as plain text. */
const text = (v: any): string => texts(v)[0]?.["@value"] || "";

const INTERNAL_FIELDS = new Set(["id", "uri", "created", "updated", "_type", "_raw", "value", "label"]);

/** Copies the properties of src that the builder did not handle itself (bare keys only when no prefixed twin). */
function keepRest(src: any, out: any, handled: string[]) {
  if (!src || typeof src !== "object") return;
  const skip = new Set(handled.map(h => resolvePropertyUri(h, BIBFRAME_JSONLD_CONTEXT).tag));
  const entries = Object.entries(src).sort(([a], [b]) => Number(!a.includes(":")) - Number(!b.includes(":")));
  for (const [k, v] of entries) {
    if (k.startsWith("@") || INTERNAL_FIELDS.has(k) || v === null || v === undefined || v === "") continue;
    const tag = resolvePropertyUri(k, BIBFRAME_JSONLD_CONTEXT).tag;
    if (skip.has(tag) || out[tag] !== undefined) continue;
    out[tag] = v;
  }
}

/** Labels as stored: one plain label stays a string, several (or language-tagged) stay literal objects. */
const labelValue = (labels: any[]) => (labels.length === 1 && !labels[0]["@language"] && !labels[0]["@type"] ? labels[0]["@value"] : labels);

/** A described node (subject, genre...): its IRI if any, a default type, its labels, and anything else it says. */
function describedNode(v: any, defaultType: string): any {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v !== "object" || v["@value"] !== undefined) {
    const labels = texts(v);
    return labels.length ? { "@type": defaultType, "rdfs:label": labelValue(labels) } : null;
  }
  const out: any = {};
  if (v["@id"]) out["@id"] = v["@id"];
  out["@type"] = v["@type"] || defaultType;
  const labels = texts(v["rdfs:label"] ?? v["label"]);
  if (labels.length) out["rdfs:label"] = labelValue(labels);
  keepRest(v, out, ["rdfs:label"]);
  return out["@id"] || out["rdfs:label"] || Object.keys(out).length > 1 ? out : null;
}

/** A node whose content is its label (note, summary, extent, shelf mark): plain text becomes the label. */
function labelledNode(v: any, type: string): any {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v === "object" && v["@value"] === undefined && !Array.isArray(v)) {
    const out: any = { "@type": v["@type"] || type };
    if (v["@id"]) out["@id"] = v["@id"];
    const labels = texts(v["rdfs:label"] ?? v["label"] ?? v["value"]);
    if (labels.length) out["rdfs:label"] = labelValue(labels);
    keepRest(v, out, ["rdfs:label"]);
    return out["rdfs:label"] || out["@id"] || Object.keys(out).length > 1 ? out : null;
  }
  const labels = texts(v);
  return labels.length ? { "@type": type, "rdfs:label": labelValue(labels) } : null;
}

/** An agent or place: keeps its IRI, or gets a stable Moon URI from its label. */
function namedNode(v: any, defaultType: string, kind: string): any {
  const isObj = v && typeof v === "object" && v["@value"] === undefined;
  const labels = texts(isObj ? (v["rdfs:label"] ?? v["label"]) : v);
  if (!labels.length && !(isObj && v["@id"])) return null;
  const out: any = {
    "@id": isObj && v["@id"] ? v["@id"] : `${BASE_URI}/${kind}/${simpleHash(labels[0]?.["@value"] || "unknown")}`,
    "@type": (isObj && v["@type"]) || defaultType
  };
  if (labels.length) out["rdfs:label"] = labelValue(labels);
  if (isObj) keepRest(v, out, ["rdfs:label"]);
  return out;
}

/** An identifier node (ISBN, LCCN, barcode...) with its value(s) as rdf:value. */
function identifierNode(id: any, defaultType: string): any {
  if (id === undefined || id === null || id === "") return null;
  const isObj = typeof id === "object" && id["@value"] === undefined;
  const values = texts(isObj ? (id["rdf:value"] ?? id["value"]) : id);
  if (!values.length && !(isObj && id["@id"])) return null;
  const out: any = { "@type": (isObj && id["@type"]) || defaultType };
  if (isObj && id["@id"]) out["@id"] = id["@id"];
  if (values.length) out["rdf:value"] = values;
  if (isObj) keepRest(id, out, ["rdf:value"]);
  return out;
}

/** Every title of the entity, each with all its scripts; plain text becomes a bf:Title. */
function buildTitles(data: any): any[] {
  const raw = data["bf:title"] ?? data["title"];
  const source = raw === undefined || raw === null || raw === "" ? (data["rdfs:label"] ?? data["label"]) : raw;
  return asList(source).map(t => {
    if (t === undefined || t === null || t === "") return null;
    if (typeof t !== "object" || t["@value"] !== undefined) {
      const main = texts(t);
      return main.length ? { "@type": "bf:Title", "bf:mainTitle": main } : null;
    }
    const main = texts(t["bf:mainTitle"] ?? t["mainTitle"] ?? t["rdfs:label"] ?? t["label"]);
    if (!main.length) return null;
    const out: any = { "@type": t["@type"] || "bf:Title", "bf:mainTitle": main };
    for (const [prefixed, short] of [["bf:subtitle", "subtitle"], ["bf:partNumber", "partNumber"], ["bf:partName", "partName"], ["bflc:nonSortNum", "nonSortNum"]]) {
      const v = texts(t[prefixed] ?? t[short]);
      if (v.length) out[prefixed] = v;
    }
    keepRest(t, out, ["bf:mainTitle", "bf:subtitle", "bf:partNumber", "bf:partName", "bflc:nonSortNum", "rdfs:label", "mainTitle", "subtitle", "partNumber", "partName", "nonSortNum"]);
    return out;
  }).filter(Boolean);
}

/** The entity's class plus any more specific official class it was given (bf:Text, bf:Manuscript, bf:Print...). */
function entityTypes(base: string, data: any): string | string[] {
  const extra = asList(data?.["@type"]).map((t: any) => resolvePropertyUri(String(t), BIBFRAME_JSONLD_CONTEXT).tag)
    .filter((t: string) => t !== base && t.startsWith("bf:") && BF_CLASSES.has(t.slice(3)) && !["Work", "Instance", "Item"].includes(t.slice(3)));
  return extra.length ? [base, ...new Set(extra)] : base;
}

function buildAdminNode(data: any, recordAdmin: any, uriSet: any): W3CJsonLdNode {
  const now = new Date().toISOString();
  // The record's own bf:adminMetadata (e.g. an imported Arabic record says "ara" / "rda") wins over the
  // editor's session defaults in the admin node; English and RDA are only the last resort.
  const fromRecord = recordAdmin && typeof recordAdmin === "object" && !Array.isArray(recordAdmin) ? recordAdmin : {};
  const pick = (key: string) => fromRecord[`bf:${key}`] || fromRecord[key] || data[`bf:${key}`] || data[key];
  const code = (v: any) => typeof v === "string" && /^[A-Za-z]{1,4}$/.test(v.trim()) ? v.trim().toLowerCase() : v;
  const agency = pick("assigner") || (typeof fromRecord["bf:source"] === "string" ? fromRecord["bf:source"] : undefined);

  const node: W3CJsonLdNode = {
    "@id": uriSet.admin,
    "@type": "bf:AdminMetadata",
    "bf:creationDate": [{ "@value": data["bf:creationDate"] || now.split("T")[0], "@type": "xsd:date" }],
    "bf:changeDate": [{ "@value": now.split("T")[0], "@type": "xsd:date" }],
    "bf:descriptionConventions": [
      vocabRef(code(pick("descriptionConventions")), "descriptionConventions", "bf:DescriptionConventions") ||
      { "@id": "http://id.loc.gov/vocabulary/descriptionConventions/rda" }
    ],
    "bf:descriptionLanguage": [
      vocabRef(code(pick("descriptionLanguage")), "languages", "bf:Language") ||
      { "@id": "http://id.loc.gov/vocabulary/languages/eng" }
    ],
    ...(agency ? {
      "bf:assigner": [typeof agency === "object"
        ? (agency["@id"] ? { "@id": agency["@id"] } : { "@type": "bf:Organization", "rdfs:label": String(agency["rdfs:label"] || "") })
        : { "@type": "bf:Organization", "rdfs:label": String(agency) }]
    } : {}),
    "bf:source": [{
      "@id": BASE_URI.replace(/\/resource$/, ""),
      "@type": "bf:Source",
      "rdfs:label": "Moon Library System"
    }],
    "bf:generationProcess": [{
      "@type": "bf:GenerationProcess",
      "rdfs:label": data["bf:generationProcess"] || "Moon BIBFRAME Template v2.0"
    }],
    ...(data["bf:catalogerId"] || data["bflc:catalogerId"]
      ? { "bflc:catalogerId": [{ "@value": String(data["bf:catalogerId"] || data["bflc:catalogerId"]) }] }
      : {})
  };

  return cleanNode(node);
}

// =====================================================
// PROPERTY PRESERVATION & EXTRACTION HELPERS
// =====================================================

// Links between the record's own entities are always built from uriSet, never copied from form data.
const STRUCTURAL_LINKS = new Set(["hasInstance", "instanceOf", "hasItem", "itemOf", "hasExpression", "expressionOf", "adminMetadata", "adminMetadataFor"]);
const RECORD_ENTITIES = new Set(["Work", "Instance", "Item", "AdminMetadata"]);

interface MisplacedProperty { domain: string; key: string; value: any[]; fromId: string }

function preserveCustomProperties(data: any, targetNode: any, ignoredKeys: string[], nodeClass?: string, misplaced?: MisplacedProperty[]) {
  const ignored = new Set(ignoredKeys);

  // Prefixed keys ("bf:notation", usually the structured value) win over bare form copies ("notation").
  const entries = Object.entries(data).sort(([a], [b]) => Number(!a.includes(":")) - Number(!b.includes(":")));
  for (const [key, value] of entries) {
    if (ignored.has(key) || key.startsWith("@")) continue;
    if (value === null || value === undefined || value === "") continue;

    const resolved = resolvePropertyUri(key, BIBFRAME_JSONLD_CONTEXT);
    const propKey = resolved.tag;
    const local = propKey.startsWith("bf:") ? propKey.slice(3) : "";
    if (STRUCTURAL_LINKS.has(local)) continue;

    let formatted = Array.isArray(value) ? value.map(v => formatCustomValue(v)) : [formatCustomValue(value)];
    // Datatype properties (bf:temporalCoverage, bf:dimensions...) take text, not a node: keep the node's label.
    if (BF_DATATYPE_PROPERTIES.has(local)) {
      formatted = formatted
        .map(v => v && typeof v === "object" && v["@value"] === undefined
          ? (v["rdfs:label"] || v["label"] ? { "@value": String(v["rdfs:label"] || v["label"]) } : null)
          : v)
        .filter(Boolean);
      if (formatted.length === 0) continue;
    }

    // A BIBFRAME property used on the wrong entity (heldBy on an Instance, originDate on an Instance)
    // goes to the entity its rdfs:domain names; title parts are already in bf:title; anything else is
    // kept as a Moon extension rather than published as invalid BIBFRAME.
    const domain = local ? BF_PROPERTY_DOMAINS[local] : undefined;
    if (nodeClass && domain && domain !== nodeClass) {
      if (domain === "Title") continue;
      if (RECORD_ENTITIES.has(domain) && misplaced) {
        misplaced.push({ domain, key: propKey, value: formatted, fromId: targetNode["@id"] });
      } else if (!targetNode[`moonext:${local}`] && !alreadyStated(targetNode, formatted)) {
        targetNode[`moonext:${local}`] = formatted;
      }
      continue;
    }

    if (targetNode[propKey]) continue; // Already mapped
    targetNode[propKey] = formatted;
  }
}

function relocateMisplaced(misplaced: MisplacedProperty[], nodes: Record<string, any>, graph: any[]) {
  for (const { domain, key, value, fromId } of misplaced) {
    const target = nodes[domain];
    const from = graph.find(n => n["@id"] === fromId);
    const local = key.slice(3);
    if (target && !target[key]) {
      target[key] = value;
    } else if (!target || JSON.stringify(target[key]) !== JSON.stringify(value)) {
      if (from && !from[`moonext:${local}`] && !alreadyStated(from, value)) from[`moonext:${local}`] = value;
    }
  }
}

/** True when every literal in `values` already appears as a literal on the node (e.g. edition = editionStatement). */
function alreadyStated(node: any, values: any[]): boolean {
  const texts = new Set<string>();
  for (const [k, v] of Object.entries(node)) {
    if (k.startsWith("@")) continue;
    for (const x of Array.isArray(v) ? v : [v]) if (x && typeof x === "object" && x["@value"] !== undefined) texts.add(String(x["@value"]).trim());
  }
  return values.length > 0 && values.every(v => v && typeof v === "object" && v["@value"] !== undefined && texts.has(String(v["@value"]).trim()));
}

function formatCustomValue(v: any): any {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    if (v["@id"] || v["@value"]) return v;
    return v;
  }
  if (typeof v === "string" && (v.startsWith("http://") || v.startsWith("https://"))) {
    return { "@id": v };
  }
  return { "@value": String(v) };
}

function extractTitle(data: any): { mainTitle: string; subtitle: string; partNumber: string; partName: string; nonSortNum: string } {
  if (!data) return { mainTitle: "", subtitle: "", partNumber: "", partName: "", nonSortNum: "" };
  const t = data["bf:title"] || data["title"] || data["rdfs:label"] || data["label"];
  if (!t) return { mainTitle: "", subtitle: "", partNumber: "", partName: "", nonSortNum: "" };

  const titleObj = Array.isArray(t) ? t[0] : t;
  if (typeof titleObj === "string") return { mainTitle: titleObj.trim(), subtitle: "", partNumber: "", partName: "", nonSortNum: "" };

  let mainTitle = "";
  const mt = titleObj["bf:mainTitle"] || titleObj["mainTitle"] || titleObj["rdfs:label"] || titleObj["label"];
  if (mt) {
    if (Array.isArray(mt)) mainTitle = mt[0]?.["@value"] || mt[0]?.["rdfs:label"] || String(mt[0]);
    else if (typeof mt === "object") mainTitle = mt["@value"] || mt["rdfs:label"] || String(mt);
    else mainTitle = String(mt);
  }

  let subtitle = "";
  const st = titleObj["bf:subtitle"] || titleObj["subtitle"];
  if (st) {
    if (Array.isArray(st)) subtitle = st[0]?.["@value"] || String(st[0]);
    else if (typeof st === "object") subtitle = st["@value"] || String(st);
    else subtitle = String(st);
  }

  const partNumber = titleObj["bf:partNumber"] || titleObj["partNumber"] || "";
  const partName = titleObj["bf:partName"] || titleObj["partName"] || "";
  const nonSortNum = titleObj["bflc:nonSortNum"] || titleObj["nonSortNum"] || "";

  return { mainTitle, subtitle, partNumber: String(partNumber), partName: String(partName), nonSortNum: String(nonSortNum) };
}

function extractContributions(data: any, workUri: string): any[] {
  const c = data["bf:contribution"] || data["contribution"] || [];
  const arr = (Array.isArray(c) ? c : [c]).filter(Boolean)
    .map(x => typeof x === "string" ? { "bf:agent": { "rdfs:label": x } } : x);

  // Primary = the one(s) explicitly marked; when none is, the first author/creator (or first without a role).
  const marked = (x: any) => [].concat(x["@type"] || []).some((t: string) => /PrimaryContribution$/.test(t));
  const roleOf = (x: any) => { const r = x["bf:role"] || x["role"]; return (Array.isArray(r) ? r[0] : r)?.["@id"] || ""; };
  const fallbackPrimary = arr.some(marked) ? -1 : arr.findIndex(x => !roleOf(x) || /\/relators\/(aut|cre)$/.test(roleOf(x)));

  return arr.map((contrib, idx) => {
    const isPrimary = marked(contrib) || idx === fallbackPrimary;

    const rawAgent = contrib["bf:agent"] || contrib["agent"] || {};
    const agent = (Array.isArray(rawAgent) ? rawAgent[0] : rawAgent) || {};
    const agentObj = typeof agent === "object" && agent["@value"] === undefined ? agent : { "rdfs:label": agent };
    const hasIri = typeof agentObj["@id"] === "string" && VALID_IRI.test(agentObj["@id"]);
    const labels = texts(agentObj["rdfs:label"] ?? agentObj["label"]);
    if (!hasIri && !labels.length) return null; // nothing to say about this contributor

    const agentOut: any = { "@id": hasIri ? agentObj["@id"] : `${workUri}/agent/${idx}`, "@type": agentObj["@type"] || "bf:Person" };
    if (labels.length) agentOut["rdfs:label"] = labelValue(labels);
    keepRest(agentObj, agentOut, ["rdfs:label"]);

    // Roles: relator IRIs, relator codes ("aut"), or a labelled role; "contributor" only when none is given.
    const roles = asList(contrib["bf:role"] ?? contrib["role"]).map((r: any) => {
      if (r && typeof r === "object" && r["@id"]) return { "@id": r["@id"] };
      const t = text(r);
      if (/^[a-z]{3}$/.test(t)) return { "@id": `http://id.loc.gov/vocabulary/relators/${t}` };
      return t ? { "@type": "bf:Role", "rdfs:label": t } : null;
    }).filter(Boolean);

    const out: any = {
      "@type": isPrimary ? ["bf:Contribution", "bf:PrimaryContribution"] : "bf:Contribution",
      "bf:agent": agentOut,
      "bf:role": roles.length ? roles : [{ "@id": "http://id.loc.gov/vocabulary/relators/ctb" }]
    };
    keepRest(contrib, out, ["bf:agent", "bf:role"]);
    return out;
  }).filter(Boolean);
}

/**
 * Link to an id.loc.gov vocabulary only when the value is a URI or a code (eng, txt, nc, mono).
 * Free text ("مخطوط وحيد", "Single unit") becomes a labelled node instead of a broken IRI.
 */
function vocabRef(value: any, vocab: string, type: string): any {
  const v = Array.isArray(value) ? value[0] : value;
  if (!v) return null;
  if (typeof v === "object") {
    if (v["@value"] !== undefined) return vocabRef(String(v["@value"]), vocab, type);
    const labels = texts(v["rdfs:label"] ?? v["label"]);
    if (v["@id"]) {
      // Keep what the record says about the term (e.g. carriers/nc "volume"), as LC's own records do.
      return { "@id": v["@id"], ...(v["@type"] ? { "@type": v["@type"] } : {}), ...(labels.length ? { "rdfs:label": labelValue(labels) } : {}) };
    }
    return labels.length ? { "@type": v["@type"] || type, "rdfs:label": labelValue(labels) } : null;
  }
  const s = String(v).trim();
  if (!s) return null;
  if (s.startsWith("http://") || s.startsWith("https://")) return { "@id": s };
  // LC codes in these vocabularies are 1-4 lowercase letters; "English" or "Print" is a label, not a code.
  if (/^[a-z]{1,4}$/.test(s)) return { "@id": `http://id.loc.gov/vocabulary/${vocab}/${s}` };
  return { "@type": type, "rdfs:label": s };
}

const VALID_IRI = /^(https?:\/\/[^\s<>"{}|\\^`]+|urn:[^\s<>"{}|\\^`]+|_:[A-Za-z0-9_.-]+)$/;

/** Turns nodes with an invalid @id into anonymous nodes, keeping a bare invalid reference as its label. */
function sanitizeIds(value: any): any {
  if (Array.isArray(value)) return value.map(sanitizeIds);
  if (!value || typeof value !== "object" || value["@value"] !== undefined) return value;
  const out: any = {};
  for (const [k, v] of Object.entries(value)) out[k] = k.startsWith("@") ? v : sanitizeIds(v);
  const id = out["@id"];
  if (typeof id === "string" && !VALID_IRI.test(id)) {
    delete out["@id"];
    if (Object.keys(out).length === 0) return { "rdfs:label": id };
  }
  return out;
}

/** Types a date only when it is a valid xsd:gYear or xsd:date; "1061 هـ. = [1650]" or "c2002" stay plain. */
function dateLiteral(value: string): any {
  const v = value.trim();
  if (/^-?\d{4}$/.test(v)) return { "@value": v, "@type": "xsd:gYear" };
  if (/^-?\d{4}-\d{2}-\d{2}$/.test(v)) return { "@value": v, "@type": "xsd:date" };
  return { "@value": v };
}

function extractProperty(data: any, prefixedKey: string, shortKey: string): any {
  return data[prefixedKey] || data[shortKey] || null;
}

function extractArrayProperty(data: any, prefixedKey: string, shortKey: string): any[] {
  const val = data[prefixedKey] || data[shortKey];
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

function cleanNode(node: any): any {
  const cleaned: any = {};
  for (const [key, value] of Object.entries(node)) {
    if (value === null || value === undefined || value === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    cleaned[key] = value;
  }
  return cleaned;
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// =====================================================
// VALIDATION ENGINE (STRUCTURAL & BIBFRAME SEMANTIC)
// =====================================================

/**
 * Validates a JSON-LD document.
 * Clearly separates Structural checks (JSON-LD syntax, prefix resolution, URI formatting)
 * from Semantic checks (WEMI entity presence, reciprocal links, required cataloging properties).
 */
export function validateW3CJsonLd(doc: any): JsonLdValidationResult {
  const structuralErrors: string[] = [];
  const structuralWarnings: string[] = [];
  const semanticErrors: string[] = [];
  const semanticWarnings: string[] = [];
  const info: string[] = [];

  const prefixesUsed = new Set<string>();
  const typesFound = new Set<string>();

  let allNodesHaveId = true;
  let allNodesHaveType = true;
  let hasWork = false;
  let hasInstance = false;
  let hasItem = false;
  let hasWorkTitle = false;
  let hasInstanceTitle = false;

  // ── 1. STRUCTURAL CHECKS ──
  if (typeof doc !== "object" || doc === null) {
    structuralErrors.push("Document must be a valid JSON object");
    return createValidationResponse(structuralErrors, structuralWarnings, semanticErrors, semanticWarnings, info, {
      nodeCount: 0, tripleEstimate: 0, prefixesUsed: [], typesFound: [],
      allNodesHaveId: false, allNodesHaveType: false, contextComplete: false,
      hasWork: false, hasInstance: false, hasItem: false, hasWorkTitle: false, hasInstanceTitle: false
    });
  }

  // @context check
  if (!doc["@context"] || typeof doc["@context"] !== "object") {
    structuralErrors.push("Missing or invalid @context: must be an object mapping namespace prefixes to URIs");
  } else {
    for (const [prefix, uri] of Object.entries(doc["@context"])) {
      if (typeof uri !== "string" || (!uri.startsWith("http://") && !uri.startsWith("https://"))) {
        structuralErrors.push(`@context prefix "${prefix}" has invalid namespace URI: "${uri}"`);
      }
    }
  }

  // @graph check
  if (!doc["@graph"] || !Array.isArray(doc["@graph"])) {
    structuralErrors.push("Missing @graph: root document must contain an array of named resource nodes");
    return createValidationResponse(structuralErrors, structuralWarnings, semanticErrors, semanticWarnings, info, {
      nodeCount: 0, tripleEstimate: 0, prefixesUsed: [], typesFound: [],
      allNodesHaveId: false, allNodesHaveType: false, contextComplete: false,
      hasWork: false, hasInstance: false, hasItem: false, hasWorkTitle: false, hasInstanceTitle: false
    });
  }

  const graph = doc["@graph"];
  info.push(`Document graph contains ${graph.length} top-level entity node(s)`);

  const declaredContext = doc["@context"] || {};

  // Inspect each node in @graph
  graph.forEach((node: any, idx: number) => {
    if (!node || typeof node !== "object") {
      structuralErrors.push(`Node [${idx}] is not a valid object`);
      return;
    }

    // Node @id
    if (!node["@id"]) {
      allNodesHaveId = false;
      structuralErrors.push(`Node [${idx}] missing @id: every named entity in @graph must have an IRI or blank node identifier`);
    } else if (typeof node["@id"] !== "string") {
      structuralErrors.push(`Node [${idx}] @id must be a string IRI`);
    } else if (!node["@id"].startsWith("http://") && !node["@id"].startsWith("https://") && !node["@id"].startsWith("_:")) {
      structuralErrors.push(`Node [${idx}] @id="${node["@id"]}" must be an absolute HTTP/HTTPS IRI or blank node identifier (_:)`);
    }

    // Node @type
    if (!node["@type"]) {
      allNodesHaveType = false;
      structuralWarnings.push(`Node [${idx}] (${node["@id"] || "unnamed"}) missing @type`);
    } else {
      const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
      types.forEach((t: string) => {
        typesFound.add(t);
        if (t.includes(":") && !t.startsWith("http")) {
          const prefix = t.split(":")[0];
          prefixesUsed.add(prefix);
          if (!declaredContext[prefix]) {
            structuralErrors.push(`Node [${idx}] uses undeclared prefix "${prefix}" in @type="${t}"`);
          }
        }
      });
    }

    // Properties
    for (const key of Object.keys(node)) {
      if (key.startsWith("@")) continue;

      if (key.includes(":") && !key.startsWith("http")) {
        const prefix = key.split(":")[0];
        prefixesUsed.add(prefix);
        if (!declaredContext[prefix]) {
          structuralErrors.push(`Node [${idx}] property "${key}" uses undeclared prefix "${prefix}"`);
        }
      } else if (!key.startsWith("http")) {
        structuralWarnings.push(`Node [${idx}] property "${key}" lacks a namespace prefix and is unmapped to an ontology`);
      }

      // Check nested values
      validateNestedValue(node[key], key, idx, declaredContext, structuralErrors, structuralWarnings, prefixesUsed);
    }
  });

  // ── 2. BIBFRAME SEMANTIC CHECKS ──
  const workNode = graph.find((n: any) => nodeHasType(n, "bf:Work"));
  const instanceNode = graph.find((n: any) => nodeHasType(n, "bf:Instance"));
  const itemNode = graph.find((n: any) => nodeHasType(n, "bf:Item"));

  hasWork = !!workNode;
  hasInstance = !!instanceNode;
  hasItem = !!itemNode;

  if (hasWork) {
    info.push("Found bf:Work entity");
  } else {
    semanticErrors.push("BIBFRAME compliance requires a bf:Work entity");
  }

  if (hasInstance) {
    info.push("Found bf:Instance entity");
  } else {
    semanticErrors.push("BIBFRAME compliance requires a bf:Instance entity");
  }

  if (hasItem) {
    info.push("Found bf:Item entity");
  } else {
    semanticWarnings.push("No bf:Item entity present in the graph");
  }

  // WEMI Linkages
  if (workNode && instanceNode) {
    const hasInstLink = hasRefTo(workNode["bf:hasInstance"], instanceNode["@id"]) || 
                        hasRefTo(workNode["bf:hasExpression"], instanceNode["@id"]);
    if (!hasInstLink && !workNode["bf:hasInstance"]) {
      semanticErrors.push("Work entity is missing a bf:hasInstance link to the Instance");
    }

    const isInstanceOfWork = hasRefTo(instanceNode["bf:instanceOf"], workNode["@id"]);
    if (!isInstanceOfWork && !instanceNode["bf:instanceOf"]) {
      semanticErrors.push("Instance entity is missing a bf:instanceOf link to the Work");
    }
  }

  if (instanceNode && itemNode) {
    const hasItemLink = hasRefTo(instanceNode["bf:hasItem"], itemNode["@id"]);
    if (!hasItemLink && !instanceNode["bf:hasItem"]) {
      semanticWarnings.push("Instance entity is missing a bf:hasItem link to the Item");
    }

    const isItemOfInstance = hasRefTo(itemNode["bf:itemOf"], instanceNode["@id"]);
    if (!isItemOfInstance && !itemNode["bf:itemOf"]) {
      semanticErrors.push("Item entity is missing a bf:itemOf link to the Instance");
    }
  }

  // Titles
  if (workNode) {
    hasWorkTitle = nodeHasMainTitle(workNode, graph);
    if (!hasWorkTitle) {
      semanticErrors.push("Work entity must contain a bf:title with bf:mainTitle");
    }
  }

  if (instanceNode) {
    hasInstanceTitle = nodeHasMainTitle(instanceNode, graph);
    if (!hasInstanceTitle) {
      semanticWarnings.push("Instance entity is missing a distinct bf:title");
    }
  }

  // Estimate triples
  let tripleEstimate = 0;
  graph.forEach((node: any) => {
    tripleEstimate++; // type triple
    for (const key of Object.keys(node)) {
      if (key.startsWith("@")) continue;
      const val = node[key];
      if (Array.isArray(val)) tripleEstimate += val.length;
      else tripleEstimate++;
    }
  });

  const contextComplete = Array.from(prefixesUsed).every(p => !!declaredContext[p]);

  return createValidationResponse(
    structuralErrors, structuralWarnings,
    semanticErrors, semanticWarnings,
    info,
    {
      nodeCount: graph.length,
      tripleEstimate,
      prefixesUsed: Array.from(prefixesUsed),
      typesFound: Array.from(typesFound),
      allNodesHaveId,
      allNodesHaveType,
      contextComplete,
      hasWork,
      hasInstance,
      hasItem,
      hasWorkTitle,
      hasInstanceTitle
    }
  );
}

function createValidationResponse(
  structuralErrors: string[],
  structuralWarnings: string[],
  semanticErrors: string[],
  semanticWarnings: string[],
  info: string[],
  stats: any
): JsonLdValidationResult {
  const structuralValid = structuralErrors.length === 0;
  const semanticValid = semanticErrors.length === 0;
  const overallValid = structuralValid && semanticValid;

  return {
    valid: overallValid,
    structural: {
      valid: structuralValid,
      errors: structuralErrors,
      warnings: structuralWarnings
    },
    semantic: {
      valid: semanticValid,
      errors: semanticErrors,
      warnings: semanticWarnings
    },
    errors: [...structuralErrors, ...semanticErrors],
    warnings: [...structuralWarnings, ...semanticWarnings],
    info,
    stats
  };
}

function nodeHasType(node: any, targetType: string): boolean {
  if (!node || !node["@type"]) return false;
  const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
  return types.includes(targetType);
}

function hasRefTo(linkVal: any, targetUri: string): boolean {
  if (!linkVal || !targetUri) return false;
  if (Array.isArray(linkVal)) {
    return linkVal.some(item => hasRefTo(item, targetUri));
  }
  if (typeof linkVal === "object") {
    return linkVal["@id"] === targetUri;
  }
  return linkVal === targetUri;
}

function nodeHasMainTitle(node: any, graph?: any[]): boolean {
  if (!node) return false;
  // Direct label check on node
  if (typeof node["rdfs:label"] === "string" && node["rdfs:label"].trim().length > 0) return true;
  if (typeof node["label"] === "string" && node["label"].trim().length > 0) return true;

  const titles = node["bf:title"] || node["title"];
  if (!titles) {
    // Check if graph contains a Title node associated with or matching this entity
    if (graph && Array.isArray(graph)) {
      const titleNode = graph.find(n => n && (n["@type"] === "bf:Title" || (Array.isArray(n["@type"]) && n["@type"].includes("bf:Title"))));
      if (titleNode) {
        const mt = titleNode["bf:mainTitle"] || titleNode["mainTitle"] || titleNode["rdfs:label"];
        if (typeof mt === "string" && mt.trim().length > 0) return true;
      }
    }
    return false;
  }
  const titleArr = Array.isArray(titles) ? titles : [titles];
  return titleArr.some(t => {
    if (typeof t === "string" && t.trim().length > 0) {
      if (graph && Array.isArray(graph)) {
        const refNode = graph.find(n => n && n["@id"] === t.trim());
        if (refNode) {
          const mt = refNode["bf:mainTitle"] || refNode["mainTitle"] || refNode["rdfs:label"];
          if (typeof mt === "string" && mt.trim().length > 0) return true;
        }
      }
      return true;
    }
    if (typeof t === "object" && t !== null) {
      // If reference object with @id
      if (t["@id"] && graph && Array.isArray(graph)) {
        const refNode = graph.find(n => n && n["@id"] === t["@id"]);
        if (refNode) {
          const mt = refNode["bf:mainTitle"] || refNode["mainTitle"] || refNode["rdfs:label"];
          if (typeof mt === "string" && mt.trim().length > 0) return true;
        }
      }
      const mt = t["bf:mainTitle"] || t["mainTitle"] || t["rdfs:label"];
      if (typeof mt === "string" && mt.trim().length > 0) return true;
      if (Array.isArray(mt) && mt.length > 0) {
        const first = mt[0];
        if (typeof first === "string" && first.trim().length > 0) return true;
        if (typeof first === "object" && first?.["@value"]?.trim()?.length > 0) return true;
      }
      if (typeof mt === "object" && mt?.["@value"]?.trim()?.length > 0) return true;
    }
    return false;
  });
}

function validateNestedValue(
  value: any,
  parentKey: string,
  nodeIdx: number,
  context: Record<string, string>,
  errors: string[],
  warnings: string[],
  prefixesUsed: Set<string>
) {
  if (value === null || value === undefined) return;

  if (Array.isArray(value)) {
    value.forEach((v, i) => validateNestedValue(v, `${parentKey}[${i}]`, nodeIdx, context, errors, warnings, prefixesUsed));
    return;
  }

  if (typeof value === "object") {
    if (value["@type"]) {
      const types = Array.isArray(value["@type"]) ? value["@type"] : [value["@type"]];
      types.forEach((t: string) => {
        if (t.includes(":") && !t.startsWith("http")) {
          const prefix = t.split(":")[0];
          prefixesUsed.add(prefix);
          if (!context[prefix]) {
            errors.push(`Nested object at [${nodeIdx}].${parentKey} uses undeclared prefix "${prefix}" in @type="${t}"`);
          }
        }
      });
    }

    if (value["@value"] !== undefined) {
      if (value["@language"]) {
        const lang = String(value["@language"]);
        if (!/^[a-zA-Z]{1,8}(-[a-zA-Z0-9]{1,8})*$/.test(lang)) {
          warnings.push(`Literal at [${nodeIdx}].${parentKey} has non-standard language tag "${lang}"`);
        }
      }
    }

    for (const key of Object.keys(value)) {
      if (key.startsWith("@")) continue;
      if (key.includes(":") && !key.startsWith("http")) {
        const prefix = key.split(":")[0];
        prefixesUsed.add(prefix);
        if (!context[prefix]) {
          errors.push(`Nested property [${nodeIdx}].${parentKey}.${key} uses undeclared prefix "${prefix}"`);
        }
      }
      validateNestedValue(value[key], `${parentKey}.${key}`, nodeIdx, context, errors, warnings, prefixesUsed);
    }
  }
}

// =====================================================
// TURTLE & N-TRIPLES SERIALIZERS
// =====================================================

/**
 * Convert W3C JSON-LD Document to valid W3C Turtle
 */
export function jsonLdToTurtle(doc: W3CJsonLdDocument): string {
  return toTurtle(doc);
}

/**
 * Convert W3C JSON-LD Document to standard N-Triples
 */
export function jsonLdToNTriples(doc: W3CJsonLdDocument): string {
  doc = finishForExport(doc) as W3CJsonLdDocument;
  const context = doc["@context"] || BIBFRAME_JSONLD_CONTEXT;
  const lines: string[] = [];
  const graph = hoistNamedNodes(doc["@graph"] || []);
  let blankNodeCounter = 0;

  function fmtSubject(s: string): string {
    if (s.startsWith("_:")) return s;
    return `<${s}>`;
  }

  function expandUri(term: string): string {
    if (term.startsWith("http://") || term.startsWith("https://")) return term;
    if (term.startsWith("_:")) return term;
    if (term.includes(":")) {
      const [prefix, ...rest] = term.split(":");
      const local = rest.join(":");
      if (context[prefix]) return `${context[prefix]}${local}`;
    }
    return `http://id.loc.gov/ontologies/bibframe/${term}`;
  }

  for (const node of graph) {
    const subject = node["@id"];
    if (!subject) continue;
    const subStr = fmtSubject(subject);

    // rdf:type
    if (node["@type"]) {
      const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
      for (const t of types) {
        lines.push(`${subStr} <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <${expandUri(t)}> .`);
      }
    }

    // Properties
    for (const [key, value] of Object.entries(node)) {
      if (key.startsWith("@")) continue;
      const predUri = expandUri(key);
      const values = Array.isArray(value) ? value : [value];

      for (const val of values) {
        emitNTriple(subStr, predUri, val, lines, () => `_:b${blankNodeCounter++}`);
      }
    }
  }

  function emitNTriple(subStr: string, predicate: string, val: any, extraLines: string[], nextBnode: () => string) {
    if (val === null || val === undefined) return;

    if (typeof val === "object" && val["@value"] !== undefined) {
      const escaped = String(val["@value"]).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r");
      if (val["@type"]) {
        extraLines.push(`${subStr} <${predicate}> "${escaped}"^^<${expandUri(val["@type"])}> .`);
      } else if (val["@language"]) {
        extraLines.push(`${subStr} <${predicate}> "${escaped}"@${val["@language"]} .`);
      } else {
        extraLines.push(`${subStr} <${predicate}> "${escaped}" .`);
      }
      return;
    }

    if (typeof val === "object" && val["@id"]) {
      const objId = val["@id"];
      const objStr = fmtSubject(objId.startsWith("http") ? objId : expandUri(objId));
      extraLines.push(`${subStr} <${predicate}> ${objStr} .`);
      return;
    }

    if (typeof val === "object" && val !== null) {
      const bnodeId = nextBnode();
      extraLines.push(`${subStr} <${predicate}> ${bnodeId} .`);
      if (val["@type"]) {
        const types = Array.isArray(val["@type"]) ? val["@type"] : [val["@type"]];
        types.forEach((t: string) => {
          extraLines.push(`${bnodeId} <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <${expandUri(t)}> .`);
        });
      }
      for (const [k, v] of Object.entries(val)) {
        if (k.startsWith("@")) continue;
        const pUri = expandUri(k);
        const vs = Array.isArray(v) ? v : [v];
        vs.forEach(vv => emitNTriple(bnodeId, pUri, vv, extraLines, nextBnode));
      }
      return;
    }

    if (typeof val === "string") {
      if (val.startsWith("http://") || val.startsWith("https://")) {
        extraLines.push(`${subStr} <${predicate}> <${val}> .`);
      } else if (val.startsWith("_:")) {
        extraLines.push(`${subStr} <${predicate}> ${val} .`);
      } else {
        const escaped = val.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r");
        extraLines.push(`${subStr} <${predicate}> "${escaped}" .`);
      }
      return;
    }

    extraLines.push(`${subStr} <${predicate}> "${String(val)}" .`);
  }

  return lines.join("\n");
}
