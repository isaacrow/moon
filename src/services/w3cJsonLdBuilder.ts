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
import { normalizeBibframe } from './bibframeNormalizer';
import { BASE_URI } from './uriMintingService';
import { BF_PROPERTY_DOMAINS, BF_DATATYPE_PROPERTIES } from './bibframeTerms.generated';

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
    "@type": "bf:Work",
    "bf:hasInstance": [{ "@id": uriSet.instance }]
  };

  if (enableExpression) {
    node["bf:hasExpression"] = [{ "@id": uriSet.expression }];
  }

  // Title
  const title = extractTitle(data);
  const mainTitleText = title.mainTitle?.trim() || (typeof data["rdfs:label"] === "string" ? data["rdfs:label"].trim() : "") || (typeof data.label === "string" ? data.label.trim() : "") || "Untitled Work / عمل ببليوغرافي";
  
  const titleObj: any = {
    "@type": "bf:Title",
    "bf:mainTitle": [{ "@value": mainTitleText }]
  };
  if (title.subtitle) titleObj["bf:subtitle"] = [{ "@value": title.subtitle }];
  if (title.partNumber) titleObj["bf:partNumber"] = [{ "@value": title.partNumber }];
  if (title.partName) titleObj["bf:partName"] = [{ "@value": title.partName }];
  if (title.nonSortNum !== undefined && title.nonSortNum !== '') {
    titleObj["bflc:nonSortNum"] = [{ "@value": String(title.nonSortNum) }];
  }
  node["bf:title"] = [titleObj];

  // Contributions
  const contributions = extractContributions(data, uriSet.work);
  if (contributions.length > 0) {
    node["bf:contribution"] = contributions;
  }

  // Language
  const lang = extractProperty(data, "bf:language", "language");
  if (lang) {
    const ref = vocabRef(lang, "languages", "bf:Language");
    if (ref) node["bf:language"] = [ref];
  }

  // Subjects
  const subjects = extractArrayProperty(data, "bf:subject", "subject");
  if (subjects.length > 0) {
    node["bf:subject"] = subjects.map(s => {
      if (typeof s === "object" && s !== null) {
        if (s["@id"]) {
          const res: any = { "@id": s["@id"], "@type": s["@type"] || "bf:Topic" };
          if (s["rdfs:label"]) res["rdfs:label"] = s["rdfs:label"];
          return res;
        }
        if (s["rdfs:label"]) return { "@type": s["@type"] || "bf:Topic", "rdfs:label": s["rdfs:label"] };
      }
      return { "@type": "bf:Topic", "rdfs:label": String(s) };
    });
  }

  // Genre/Form
  const genres = extractArrayProperty(data, "bf:genreForm", "genreForm");
  if (genres.length > 0) {
    node["bf:genreForm"] = genres.map(g => {
      if (typeof g === "object" && g !== null) {
        if (g["@id"]) return { "@id": g["@id"], "@type": g["@type"] || "bf:GenreForm", ...(g["rdfs:label"] ? { "rdfs:label": g["rdfs:label"] } : {}) };
        if (g["rdfs:label"]) return { "@type": "bf:GenreForm", "rdfs:label": g["rdfs:label"] };
      }
      return { "@type": "bf:GenreForm", "rdfs:label": String(g) };
    });
  }

  // Classification
  const classifications = extractArrayProperty(data, "bf:classification", "classification");
  if (classifications.length > 0) {
    node["bf:classification"] = classifications.map(c => {
      if (typeof c === "object" && c !== null) {
        const portion = c["bf:classificationPortion"] || c["classificationPortion"];
        const itemPortion = c["bf:itemPortion"] || c["itemPortion"];
        return {
          "@type": c["@type"] || "bf:Classification",
          ...(portion ? { "bf:classificationPortion": [{ "@value": String(portion) }] } : {}),
          ...(itemPortion ? { "bf:itemPortion": [{ "@value": String(itemPortion) }] } : {}),
          ...(c["bf:source"] ? { "bf:source": [{ "@id": typeof c["bf:source"] === "object" ? c["bf:source"]["@id"] : c["bf:source"] }] } : {}),
          ...(c["bf:edition"] ? { "bf:edition": [{ "@value": String(c["bf:edition"]) }] } : {})
        };
      }
      return {
        "@type": "bf:Classification",
        "bf:classificationPortion": [{ "@value": String(c) }]
      };
    });
  }

  // Summary
  const summary = extractProperty(data, "bf:summary", "summary");
  if (summary) {
    const label = typeof summary === "object" ? (summary["rdfs:label"] || summary["@value"] || "") : String(summary);
    if (label) {
      node["bf:summary"] = [{ "@type": "bf:Summary", "rdfs:label": label }];
    }
  }

  // Content type
  const content = extractProperty(data, "bf:content", "content");
  if (content) {
    const ref = vocabRef(content, "contentTypes", "bf:Content");
    if (ref) node["bf:content"] = [ref];
  }

  // Origin date
  const originDate = extractProperty(data, "bf:originDate", "originDate");
  if (originDate) {
    const dateStr = String(typeof originDate === "object" ? originDate["@value"] || originDate.value || originDate : originDate);
    node["bf:originDate"] = [dateLiteral(dateStr)];
  }

  // Notes
  const notes = extractArrayProperty(data, "bf:note", "note");
  if (notes.length > 0) {
    node["bf:note"] = notes.map(n => ({
      "@type": "bf:Note",
      "rdfs:label": typeof n === "object" ? (n["rdfs:label"] || n["@value"] || JSON.stringify(n)) : String(n)
    }));
  }

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
  const ownTitle = extractTitle(data).mainTitle.trim();
  node["bf:title"] = ownTitle
    ? [{ "@type": "bf:Title", "bf:mainTitle": [{ "@value": ownTitle }] }]
    : JSON.parse(JSON.stringify(workNode["bf:title"] || []));

  const lang = extractProperty(data, "bf:language", "language");
  if (lang) {
    const ref = vocabRef(lang, "languages", "bf:Language");
    if (ref) node["bf:language"] = [ref];
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
    "@type": "bf:Instance",
    "bf:instanceOf": { "@id": hasExpression ? uriSet.expression : uriSet.work },
    "bf:hasItem": [{ "@id": uriSet.item }]
  };

  // Title
  const title = extractTitle(data);
  const instMain = title.mainTitle?.trim() || "Untitled Instance / وعاء بدون عنوان";
  const titleObj: any = {
    "@type": "bf:Title",
    "bf:mainTitle": [{ "@value": instMain }]
  };
  if (title.subtitle) titleObj["bf:subtitle"] = [{ "@value": title.subtitle }];
  if (title.partNumber) titleObj["bf:partNumber"] = [{ "@value": title.partNumber }];
  if (title.partName) titleObj["bf:partName"] = [{ "@value": title.partName }];
  node["bf:title"] = [titleObj];

  // Edition statement
  const edition = extractProperty(data, "bf:editionStatement", "editionStatement");
  if (edition) node["bf:editionStatement"] = [{ "@value": String(edition) }];

  // Responsibility statement
  const resp = extractProperty(data, "bf:responsibilityStatement", "responsibilityStatement");
  if (resp) node["bf:responsibilityStatement"] = [{ "@value": String(resp) }];

  // Identifiers
  const identifiers = extractArrayProperty(data, "bf:identifiedBy", "identifiedBy");
  if (identifiers.length > 0) {
    node["bf:identifiedBy"] = identifiers.map(id => {
      const idType = id["@type"] || "bf:Identifier";
      const idValue = id["rdf:value"] || id["value"] || id;
      return {
        "@type": idType,
        "rdf:value": [{ "@value": typeof idValue === "object" ? (idValue["@value"] || JSON.stringify(idValue)) : String(idValue) }]
      };
    });
  }

  // Provision activity (Publication/Distribution/Manufacture)
  const provisions = extractArrayProperty(data, "bf:provisionActivity", "provisionActivity");
  if (provisions.length > 0) {
    node["bf:provisionActivity"] = provisions.map(p => {
      const prov: any = {
        "@type": p["@type"] || "bf:Publication"
      };

      const agent = p["bf:agent"] || p["agent"];
      if (agent) {
        prov["bf:agent"] = {
          "@id": agent["@id"] || `${BASE_URI}/agent/${simpleHash(agent["rdfs:label"] || "unknown")}`,
          "@type": agent["@type"] || "bf:Agent",
          "rdfs:label": agent["rdfs:label"] || ""
        };
      }

      const place = p["bf:place"] || p["place"];
      if (place) {
        prov["bf:place"] = {
          "@id": place["@id"] || `${BASE_URI}/place/${simpleHash(place["rdfs:label"] || "unknown")}`,
          "@type": "bf:Place",
          "rdfs:label": place["rdfs:label"] || ""
        };
      }

      const date = p["bf:date"] || p["date"];
      if (date) {
        const dateStr = typeof date === "object" ? (date["@value"] || date.value || String(date)) : String(date);
        prov["bf:date"] = [dateLiteral(dateStr)];
      }

      return prov;
    });
  }

  // Extent
  const extent = extractProperty(data, "bf:extent", "extent");
  if (extent) {
    const extVal = typeof extent === "object" ? (extent["value"] || extent["rdfs:label"] || extent["@value"] || "") : String(extent);
    if (extVal) node["bf:extent"] = [{ "@type": "bf:Extent", "rdfs:label": extVal }];
  }

  // Dimensions
  const dimensions = extractProperty(data, "bf:dimensions", "dimensions");
  if (dimensions) node["bf:dimensions"] = [{ "@value": String(dimensions) }];

  // Carrier
  const carrier = extractProperty(data, "bf:carrier", "carrier");
  if (carrier) {
    const ref = vocabRef(carrier, "carriers", "bf:Carrier");
    if (ref) node["bf:carrier"] = [ref];
  }

  // Media
  const media = extractProperty(data, "bf:media", "media");
  if (media) {
    const ref = vocabRef(media, "mediaTypes", "bf:Media");
    if (ref) node["bf:media"] = [ref];
  }

  // Issuance
  const issuance = extractProperty(data, "bf:issuance", "issuance");
  if (issuance) {
    const ref = vocabRef(issuance, "issuance", "bf:Issuance");
    if (ref) node["bf:issuance"] = [ref];
  }

  // Series statement
  const series = extractProperty(data, "bf:seriesStatement", "seriesStatement");
  if (series) node["bf:seriesStatement"] = [{ "@value": String(series) }];

  // Copyright date
  const copyright = extractProperty(data, "bf:copyrightDate", "copyrightDate");
  if (copyright) node["bf:copyrightDate"] = [dateLiteral(String(copyright))];

  // Notes
  const notes = extractArrayProperty(data, "bf:note", "note");
  if (notes.length > 0) {
    node["bf:note"] = notes.map(n => ({
      "@type": "bf:Note",
      "rdfs:label": typeof n === "object" ? (n["rdfs:label"] || n["@value"] || JSON.stringify(n)) : String(n)
    }));
  }

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

  // Held by
  const heldBy = extractProperty(data, "bf:heldBy", "heldBy");
  if (heldBy) {
    node["bf:heldBy"] = typeof heldBy === "object" && heldBy["@id"]
      ? { "@id": heldBy["@id"], "@type": heldBy["@type"] || "bf:Agent", "rdfs:label": heldBy["rdfs:label"] || "" }
      : { "@id": `${BASE_URI}/org/${simpleHash(String(heldBy))}`, "@type": "bf:Organization", "rdfs:label": String(heldBy) };
  }

  // Shelf mark
  const shelf = extractProperty(data, "bf:shelfMark", "shelfMark");
  if (shelf) {
    node["bf:shelfMark"] = [{ "@type": "bf:ShelfMark", "rdfs:label": String(shelf) }];
  }

  // Electronic locator
  const eloc = extractProperty(data, "bf:electronicLocator", "electronicLocator");
  if (eloc) {
    node["bf:electronicLocator"] = [{ "@id": String(eloc) }];
  }

  // Identifiers / Barcodes
  const identifiers = extractArrayProperty(data, "bf:identifiedBy", "identifiedBy");
  if (identifiers.length > 0) {
    node["bf:identifiedBy"] = identifiers.map(id => ({
      "@type": id["@type"] || "bf:Barcode",
      "rdf:value": [{ "@value": typeof id === "object" ? (id["rdf:value"] || id["value"] || "") : String(id) }]
    }));
  }

  preserveCustomProperties(data, node, [
    "heldBy", "bf:heldBy", "shelfMark", "bf:shelfMark", "electronicLocator", "bf:electronicLocator",
    "identifiedBy", "bf:identifiedBy", "itemOf", "bf:itemOf", "id", "uri", "created", "updated", "_type", "_raw"
  ], "Item", misplaced);

  return cleanNode(node);
}

function buildAdminNode(data: any, recordAdmin: any, uriSet: any): W3CJsonLdNode {
  const now = new Date().toISOString();
  // Values from the admin node first, then from the record's own bf:adminMetadata (e.g. an imported
  // Arabic record says "ara" / "rda"); English and RDA are only defaults.
  const fromRecord = recordAdmin && typeof recordAdmin === "object" && !Array.isArray(recordAdmin) ? recordAdmin : {};
  const pick = (key: string) => data[`bf:${key}`] || data[key] || fromRecord[`bf:${key}`] || fromRecord[key];
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
    }]
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

    const agent = contrib["bf:agent"] || contrib["agent"] || {};
    const rawRole = contrib["bf:role"] || contrib["role"] || {};
    const role = Array.isArray(rawRole) ? rawRole[0] || {} : rawRole;

    const agentUri = agent["@id"] || `${workUri}/agent/${idx}`;
    const agentLabel = agent["rdfs:label"] || agent["label"] || "Unknown";
    const agentType = agent["@type"] || "bf:Person";
    const roleUri = role["@id"] || "http://id.loc.gov/vocabulary/relators/ctb";

    return {
      "@type": isPrimary ? ["bf:Contribution", "bflc:PrimaryContribution"] : "bf:Contribution",
      "bf:agent": {
        "@id": agentUri,
        "@type": agentType,
        "rdfs:label": agentLabel
      },
      "bf:role": [{
        "@id": roleUri
      }]
    };
  });
}

/**
 * Link to an id.loc.gov vocabulary only when the value is a URI or a code (eng, txt, nc, mono).
 * Free text ("مخطوط وحيد", "Single unit") becomes a labelled node instead of a broken IRI.
 */
function vocabRef(value: any, vocab: string, type: string): any {
  const v = Array.isArray(value) ? value[0] : value;
  if (!v) return null;
  if (typeof v === "object") {
    if (v["@id"]) return { "@id": v["@id"] };
    const label = v["rdfs:label"] || v["label"] || v["@value"];
    return label ? { "@type": v["@type"] || type, "rdfs:label": String(label) } : null;
  }
  const s = String(v).trim();
  if (!s) return null;
  if (s.startsWith("http://") || s.startsWith("https://")) return { "@id": s };
  // LC codes in these vocabularies are 1-4 lowercase letters; "English" or "Print" is a label, not a code.
  if (/^[a-z]{1,4}$/.test(s)) return { "@id": `http://id.loc.gov/vocabulary/${vocab}/${s}` };
  return { "@type": type, "rdfs:label": s };
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
  doc = normalizeBibframe(doc) as W3CJsonLdDocument;
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
