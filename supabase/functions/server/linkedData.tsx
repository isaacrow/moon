/**
 * Serves a published record as linked data: JSON-LD, N-Triples or Turtle, chosen by the URL's
 * extension or the request's Accept header (content negotiation, as id.loc.gov does).
 *
 * Records are stored with prefixed keys (bf:title…) under a bare BIBFRAME @context; here they get a
 * full context so standard JSON-LD tools read them, and keys outside it (app bookkeeping such as
 * recordId or createdAt) are dropped, as the app's own export does.
 */
import jsonld from "npm:jsonld@8.3.3";
import { Parser, Writer } from "npm:n3@1.17.4";

export const BASE_URI = (Deno.env.get("MOON_URI_BASE") || "https://mooon.site/resource").replace(/\/+$/, "");

export const CONTEXT: Record<string, string> = {
  bf: "http://id.loc.gov/ontologies/bibframe/",
  bflc: "http://id.loc.gov/ontologies/bflc/",
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  xsd: "http://www.w3.org/2001/XMLSchema#",
  madsrdf: "http://www.loc.gov/mads/rdf/v1#",
  moonext: new URL("/ontology/", BASE_URI).toString(),
};

export type Format = "jsonld" | "nt" | "ttl" | "html";

export const MEDIA_TYPES: Record<Exclude<Format, "html">, string> = {
  jsonld: "application/ld+json",
  nt: "application/n-triples",
  ttl: "text/turtle",
};

const EXTENSIONS: Record<string, Format> = { jsonld: "jsonld", json: "jsonld", nt: "nt", ttl: "ttl", html: "html" };

/** Splits "abc123.ttl" into the id and the format its extension asks for. */
export function splitExtension(id: string): { id: string; format?: Format } {
  const m = id.match(/^(.+)\.([a-z]+)$/i);
  const format = m ? EXTENSIONS[m[2].toLowerCase()] : undefined;
  return format ? { id: m![1], format } : { id };
}

/** The format an Accept header prefers; browsers (text/html, or nothing specific) get the web page. */
export function negotiate(accept: string | null | undefined): Format {
  const wanted = (accept || "")
    .split(",")
    .map((part) => {
      const [type, ...params] = part.trim().toLowerCase().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      return { type: type.trim(), q: q ? Number(q.slice(2)) || 0 : 1 };
    })
    .filter((w) => w.type && w.q > 0)
    .sort((a, b) => b.q - a.q);
  for (const { type } of wanted) {
    if (type === "text/html" || type === "application/xhtml+xml") return "html";
    if (type === "application/ld+json" || type === "application/json") return "jsonld";
    if (type === "text/turtle" || type === "application/x-turtle") return "ttl";
    if (type === "application/n-triples" || type === "text/plain") return "nt";
  }
  return "html";
}

/** The stored document with a full @context, ready for any JSON-LD processor. */
export function toJsonLd(document: any): any {
  return { "@context": CONTEXT, "@graph": Array.isArray(document?.["@graph"]) ? document["@graph"] : [] };
}

export async function toNTriples(document: any): Promise<string> {
  return await jsonld.toRDF(toJsonLd(document), { format: "application/n-quads" }) as string;
}

export async function toTurtle(document: any): Promise<string> {
  const quads = new Parser({ format: "N-Triples" }).parse(await toNTriples(document));
  const writer = new Writer({ prefixes: CONTEXT });
  writer.addQuads(quads);
  return await new Promise<string>((resolve, reject) =>
    writer.end((err: Error | null, out: string) => (err ? reject(err) : resolve(out))));
}

const AUTHORITY_CONTEXT: Record<string, string> = {
  ...CONTEXT,
  skos: "http://www.w3.org/2004/02/skos/core#",
  owl: "http://www.w3.org/2002/07/owl#",
};

/**
 * A local authority entry as linked data: the thing itself (bf:Person, bf:Organization, bf:Place or
 * bf:Topic) with its preferred and variant names, owl:sameAs links to LC / VIAF / Wikidata, and dates.
 */
export function authorityDocument(a: {
  id: string; kind: string; label: string; variants: string[]; sameAs: string[]; note?: string | null; data?: any;
}): any {
  const uri = `${BASE_URI}/${a.kind}/${a.id}`;
  const agentType = String(a.data?.agentType || "").toLowerCase();
  const type = a.kind === "place" ? "bf:Place" : a.kind === "topic" ? "bf:Topic"
    : agentType === "organization" ? "bf:Organization" : agentType === "family" ? "bf:Family" : "bf:Person";
  const node: any = { "@id": uri, "@type": [type], "rdfs:label": a.label, "skos:prefLabel": a.label };
  if (a.variants.length) node["skos:altLabel"] = a.variants;
  if (a.sameAs.length) node["owl:sameAs"] = a.sameAs.map((s) => ({ "@id": s }));
  if (a.note) node["skos:note"] = a.note;
  if (a.data?.birthDate) node["madsrdf:birthDate"] = String(a.data.birthDate);
  if (a.data?.deathDate) node["madsrdf:deathDate"] = String(a.data.deathDate);
  return { "@context": AUTHORITY_CONTEXT, "@graph": [node] };
}

export async function authorityNTriples(doc: any): Promise<string> {
  return await jsonld.toRDF(doc, { format: "application/n-quads" }) as string;
}

export async function authorityTurtle(doc: any): Promise<string> {
  const quads = new Parser({ format: "N-Triples" }).parse(await authorityNTriples(doc));
  const writer = new Writer({ prefixes: AUTHORITY_CONTEXT });
  writer.addQuads(quads);
  return await new Promise<string>((resolve, reject) =>
    writer.end((err: Error | null, out: string) => (err ? reject(err) : resolve(out))));
}
