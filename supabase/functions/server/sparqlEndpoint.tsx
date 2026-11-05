/**
 * A read-only SPARQL 1.1 endpoint over Moon's published records (https://mooon.site/resource/sparql).
 *
 * The published records (the same triples as the data dump) are loaded into an in-memory Oxigraph store,
 * rebuilt at most every few minutes, so queries never see drafts or records waiting for review.
 * Only queries run: Oxigraph's query() refuses SPARQL Update (INSERT, DELETE, LOAD, DROP …).
 */
import oxigraph from "npm:oxigraph@0.5.12";

const STORE_TTL_MS = 5 * 60 * 1000;
export const MAX_QUERY_LENGTH = 20_000;

let cached: { store: any; triples: number; builtAt: number } | null = null;
let building: Promise<{ store: any; triples: number; builtAt: number }> | null = null;

/** The store of published triples, rebuilt from `loadNTriples` when older than five minutes. */
export async function getStore(loadNTriples: () => Promise<string>) {
  if (cached && Date.now() - cached.builtAt < STORE_TTL_MS) return cached;
  building ??= (async () => {
    try {
      const store = new oxigraph.Store();
      store.load(await loadNTriples(), { format: "application/n-triples" });
      cached = { store, triples: store.size, builtAt: Date.now() };
      return cached;
    } finally {
      building = null;
    }
  })();
  return await building;
}

export type QueryKind = "select" | "ask" | "construct" | "describe";

/** SELECT / ASK / CONSTRUCT / DESCRIBE, read past comments, PREFIX and BASE; null when it is none of them. */
export function queryKind(query: string): QueryKind | null {
  const body = query
    .replace(/^\s*#.*$/gm, "")
    .replace(/(?:\s*(?:PREFIX\s+[^\s:]*:\s*<[^>]*>|BASE\s*<[^>]*>))*/iy, "");
  const m = body.match(/^\s*(SELECT|ASK|CONSTRUCT|DESCRIBE)\b/i);
  return m ? (m[1].toLowerCase() as QueryKind) : null;
}

const RESULT_TYPES: Record<string, string> = {
  json: "application/sparql-results+json",
  xml: "application/sparql-results+xml",
  csv: "text/csv",
  tsv: "text/tab-separated-values",
};
const GRAPH_TYPES: Record<string, string> = {
  ttl: "text/turtle",
  nt: "application/n-triples",
  rdfxml: "application/rdf+xml",
};

/**
 * The media type to answer in: ?format= first (json, xml, csv, tsv / ttl, nt, rdfxml), then the Accept
 * header, then SPARQL JSON results (SELECT, ASK) or Turtle (CONSTRUCT, DESCRIBE).
 */
export function chooseFormat(kind: QueryKind, format: string | undefined, accept: string | undefined): string {
  const table = kind === "select" || kind === "ask" ? RESULT_TYPES : GRAPH_TYPES;
  if (format && table[format.toLowerCase()]) return table[format.toLowerCase()];
  const types = Object.values(table);
  const wanted = (accept || "").split(",").map((p) => p.split(";")[0].trim().toLowerCase());
  for (const w of wanted) {
    if (types.includes(w)) return w;
    if (w === "application/json" && table === RESULT_TYPES) return RESULT_TYPES.json;
    if (w === "application/xml" && table === RESULT_TYPES) return RESULT_TYPES.xml;
  }
  return types[0];
}

export class SparqlError extends Error {}

/** Runs a read-only query; returns the serialized results and their media type. */
export async function runQuery(
  query: string,
  opts: { format?: string; accept?: string; loadNTriples: () => Promise<string> },
): Promise<{ body: string; contentType: string; triples: number }> {
  if (!query.trim()) throw new SparqlError("A query is required (?query=… or a POST body).");
  if (query.length > MAX_QUERY_LENGTH) throw new SparqlError(`The query is longer than ${MAX_QUERY_LENGTH} characters.`);
  const kind = queryKind(query);
  if (!kind) throw new SparqlError("Only SELECT, ASK, CONSTRUCT and DESCRIBE queries are answered; this endpoint is read-only.");
  const contentType = chooseFormat(kind, opts.format, opts.accept);
  const { store, triples } = await getStore(opts.loadNTriples);
  let body: string;
  try {
    body = store.query(query, { results_format: contentType });
  } catch (e) {
    throw new SparqlError(e instanceof Error ? e.message : String(e));
  }
  return { body, contentType, triples };
}
