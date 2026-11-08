/**
 * Open data (Phase 13 S23). Moon's catalogue data is released under CC0 1.0: anyone may copy, change and
 * share it, for any purpose, without asking (as LC, the British Library and most national libraries do).
 *
 * - Each published record says so in its admin metadata (dcterms:license), with who made the description
 *   (bf:assigner) and who licenses it (bflc:metadataLicensor).
 * - A record whose description came from somewhere with other terms can carry its own licence
 *   (metadata.license). The bulk exports (data dump, SPARQL, OAI-PMH, change feed) leave out any record whose
 *   licence does not allow redistribution; its own page still shows it, with its licence.
 * - The dataset is described in VoID (https://mooon.site/resource/void), also saved beside the nightly dump.
 * No imports: the server and the tests use it.
 */

export const CC0 = "http://creativecommons.org/publicdomain/zero/1.0/";

export interface Licence { id: string; uri: string; en: string; ar: string; open: boolean }
export const LICENCES: Licence[] = [
  { id: "cc0", uri: CC0, en: "CC0 1.0 (public domain)", ar: "CC0 1.0 (ملك عام)", open: true },
  { id: "cc-by", uri: "http://creativecommons.org/licenses/by/4.0/", en: "CC BY 4.0 (credit the source)", ar: "CC BY 4.0 (مع نسبة المصدر)", open: true },
  { id: "odc-by", uri: "http://opendatacommons.org/licenses/by/1-0/", en: "ODC-By 1.0 (as WorldCat data)", ar: "ODC-By 1.0 (كبيانات WorldCat)", open: true },
  { id: "restricted", uri: "", en: "Not for redistribution", ar: "لا يُعاد نشره", open: false },
];

/** A record's licence: its own, else CC0. */
export function licenceOf(record: { metadata?: Record<string, unknown> } | null | undefined): Licence {
  const id = String(record?.metadata?.license || "");
  return LICENCES.find((l) => l.id === id || (l.uri && l.uri === id)) || LICENCES[0];
}

/** Whether a record may go in the bulk exports. */
export const mayExport = (record: { metadata?: Record<string, unknown> }) => licenceOf(record).open;

/** Only the records the bulk exports may carry. */
export function openRecords<R extends { metadata?: Record<string, unknown> }>(records: R[]): R[] {
  return records.filter(mayExport);
}

/** A licence id from a request, if it is one of Moon's (anything else is left out). */
export const cleanLicence = (v: unknown): string | undefined => (LICENCES.some((l) => l.id === v) ? String(v) : undefined);

// ---- VoID ----

export interface VoidStats { records: number; triples: number; entities: number; modified?: string; left?: number }

/** The dataset described in VoID (W3C), as JSON-LD. */
export function voidDocument(base: string, stats: VoidStats): any {
  const site = base.replace(/\/resource$/, "");
  return {
    "@context": {
      void: "http://rdfs.org/ns/void#", dcterms: "http://purl.org/dc/terms/", foaf: "http://xmlns.com/foaf/0.1/",
      xsd: "http://www.w3.org/2001/XMLSchema#",
    },
    "@id": `${base}/void#moon`,
    "@type": "void:Dataset",
    "dcterms:title": [{ "@value": "فهرس مون", "@language": "ar" }, { "@value": "Moon catalogue", "@language": "en" }],
    "dcterms:description": [
      { "@value": "كل ما نشره فهرس مون بيانات مترابطة بـ BIBFRAME 3.0.1: الأعمال والطبعات والنسخ، والأشخاص والموضوعات والأماكن والمحاور.", "@language": "ar" },
      { "@value": "Everything Moon has published, as BIBFRAME 3.0.1 linked data: works, instances and items, and the people, subjects, places and hubs they link to.", "@language": "en" },
    ],
    "dcterms:license": { "@id": CC0 },
    "dcterms:publisher": { "@type": "foaf:Organization", "foaf:name": "Moon", "foaf:homepage": { "@id": `${site}/` } },
    ...(stats.modified ? { "dcterms:modified": { "@value": stats.modified.slice(0, 10), "@type": "xsd:date" } } : {}),
    "foaf:homepage": { "@id": `${site}/opac.html` },
    "void:uriSpace": `${base}/`,
    "void:sparqlEndpoint": { "@id": `${base}/sparql` },
    "void:dataDump": [{ "@id": `${base}/dump.nt` }, { "@id": `${base}/dump.jsonld` }],
    "void:feature": [{ "@id": "http://www.w3.org/ns/formats/N-Triples" }, { "@id": "http://www.w3.org/ns/formats/JSON-LD" }],
    "void:vocabulary": [
      "http://id.loc.gov/ontologies/bibframe/", "http://id.loc.gov/ontologies/bflc/", "http://www.loc.gov/mads/rdf/v1#",
      "http://www.w3.org/2004/02/skos/core#", "https://w3id.org/arm/ontology/1.0/",
    ].map((v) => ({ "@id": v })),
    "void:triples": stats.triples,
    "void:entities": stats.records + stats.entities,
    "void:documents": stats.records,
    ...(stats.left ? { "dcterms:rights": `${stats.left} published records are not in the bulk exports: their licence does not allow redistribution.` } : {}),
  };
}

/** The same in Turtle, for tools that read only that. */
export function voidTurtle(base: string, stats: VoidStats): string {
  const site = base.replace(/\/resource$/, "");
  const lines = [
    "@prefix void: <http://rdfs.org/ns/void#> .",
    "@prefix dcterms: <http://purl.org/dc/terms/> .",
    "@prefix foaf: <http://xmlns.com/foaf/0.1/> .",
    "@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .",
    "",
    `<${base}/void#moon> a void:Dataset ;`,
    '  dcterms:title "فهرس مون"@ar, "Moon catalogue"@en ;',
    '  dcterms:description "Everything Moon has published, as BIBFRAME 3.0.1 linked data."@en ;',
    `  dcterms:license <${CC0}> ;`,
    `  dcterms:publisher [ a foaf:Organization ; foaf:name "Moon" ; foaf:homepage <${site}/> ] ;`,
    ...(stats.modified ? [`  dcterms:modified "${stats.modified.slice(0, 10)}"^^xsd:date ;`] : []),
    `  foaf:homepage <${site}/opac.html> ;`,
    `  void:uriSpace "${base}/" ;`,
    `  void:sparqlEndpoint <${base}/sparql> ;`,
    `  void:dataDump <${base}/dump.nt>, <${base}/dump.jsonld> ;`,
    "  void:vocabulary <http://id.loc.gov/ontologies/bibframe/>, <http://id.loc.gov/ontologies/bflc/>, <http://www.loc.gov/mads/rdf/v1#>, <http://www.w3.org/2004/02/skos/core#>, <https://w3id.org/arm/ontology/1.0/> ;",
    `  void:triples ${stats.triples} ;`,
    `  void:entities ${stats.records + stats.entities} ;`,
    `  void:documents ${stats.records} .`,
  ];
  return lines.join("\n") + "\n";
}
