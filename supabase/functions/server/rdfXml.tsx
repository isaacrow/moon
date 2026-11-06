/**
 * RDF/XML for Moon's resource URIs (https://mooon.site/resource/<kind>/<id>.rdf), the format id.loc.gov,
 * MarcEdit and many library tools read. It takes RDF/JS-shaped quads (what N3's parser gives), so it has
 * no dependencies and runs both in the edge function and in node tests.
 */

interface Term { termType: string; value: string; language?: string; datatype?: { value: string } }
export interface Quad { subject: Term; predicate: Term; object: Term }

const RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const XSD_STRING = "http://www.w3.org/2001/XMLSchema#string";
const LANG_STRING = RDF + "langString";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    // XML 1.0 cannot carry these control characters at all.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");

/** A blank node label that is a valid rdf:nodeID (an XML NCName). */
const nodeId = (v: string) => (/^[A-Za-z_]/.test(v) ? v : `b${v}`).replace(/[^A-Za-z0-9_.-]/g, "_");

/** Splits a predicate IRI into namespace + local name; the local name must be an XML NCName. */
function split(iri: string): [string, string] | null {
  const m = iri.match(/^(.*[#/])([A-Za-z_][A-Za-z0-9_.-]*)$/);
  return m ? [m[1], m[2]] : null;
}

export function toRdfXml(quads: Quad[], prefixes: Record<string, string> = {}): string {
  const nsPrefix = new Map<string, string>([[RDF, "rdf"]]);
  for (const [p, ns] of Object.entries(prefixes)) if (!nsPrefix.has(ns) && /^[A-Za-z_][A-Za-z0-9_.-]*$/.test(p)) nsPrefix.set(ns, p);
  const qname = (iri: string): string | null => {
    const parts = split(iri);
    if (!parts) return null;
    const [ns, local] = parts;
    if (!nsPrefix.has(ns)) nsPrefix.set(ns, `ns${nsPrefix.size}`);
    return `${nsPrefix.get(ns)}:${local}`;
  };

  // One rdf:Description per subject, in first-seen order.
  const subjects = new Map<string, { term: Term; lines: string[] }>();
  for (const q of quads) {
    const key = `${q.subject.termType}|${q.subject.value}`;
    if (!subjects.has(key)) subjects.set(key, { term: q.subject, lines: [] });
    const name = qname(q.predicate.value);
    if (!name) throw new Error(`Predicate cannot be written as RDF/XML: ${q.predicate.value}`);
    const o = q.object;
    let line: string;
    if (o.termType === "NamedNode") line = `<${name} rdf:resource="${esc(o.value)}"/>`;
    else if (o.termType === "BlankNode") line = `<${name} rdf:nodeID="${nodeId(o.value)}"/>`;
    else {
      const dt = o.datatype?.value;
      const attr = o.language ? ` xml:lang="${esc(o.language)}"`
        : dt && dt !== XSD_STRING && dt !== LANG_STRING ? ` rdf:datatype="${esc(dt)}"` : "";
      line = `<${name}${attr}>${esc(o.value)}</${name}>`;
    }
    subjects.get(key)!.lines.push(`    ${line}`);
  }

  const blocks = [...subjects.values()].map(({ term, lines }) => {
    const about = term.termType === "BlankNode" ? `rdf:nodeID="${nodeId(term.value)}"` : `rdf:about="${esc(term.value)}"`;
    return `  <rdf:Description ${about}>\n${lines.join("\n")}\n  </rdf:Description>`;
  });
  const xmlns = [...nsPrefix].map(([ns, p]) => `\n    xmlns:${p}="${esc(ns)}"`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rdf:RDF${xmlns}>\n${blocks.join("\n")}\n</rdf:RDF>\n`;
}

const BF = "http://id.loc.gov/ontologies/bibframe/";
const RDF_TYPE = RDF + "type";
/** What LC's tools expect at the top of a description, in this order (bibframe2marc: one Instance, at most one Work). */
const TOP_CLASSES = [BF + "Work", BF + "Instance", BF + "Item"];

/**
 * RDF/XML in the "bounded description" shape LC exchanges with Marva and its bibframe2marc converter
 * ("striped" RDF/XML): the Work, Instance and Items are top-level elements named by their class
 * (<bf:Work rdf:about="…">), linked to each other by rdf:resource; every other node is written inside the
 * property that points to it (<bf:title><bf:Title><bf:mainTitle>…</bf:mainTitle></bf:Title></bf:title>),
 * including labelled outside resources such as agents (<bf:Agent rdf:about="http://id.loc.gov/…">).
 * A node that is pointed to more than once is written once and referred to by rdf:resource / rdf:nodeID
 * after that; nothing is dropped, so the graph is the same as the flat form's.
 */
export function toBoundedRdfXml(quads: Quad[], prefixes: Record<string, string> = {}): string {
  const nsPrefix = new Map<string, string>([[RDF, "rdf"]]);
  for (const [p, ns] of Object.entries(prefixes)) if (!nsPrefix.has(ns) && /^[A-Za-z_][A-Za-z0-9_.-]*$/.test(p)) nsPrefix.set(ns, p);
  const qname = (iri: string): string | null => {
    const parts = split(iri);
    if (!parts) return null;
    const [ns, local] = parts;
    if (!nsPrefix.has(ns)) nsPrefix.set(ns, `ns${nsPrefix.size}`);
    return `${nsPrefix.get(ns)}:${local}`;
  };
  const keyOf = (t: Term) => `${t.termType}|${t.value}`;

  const subjects = new Map<string, { term: Term; quads: Quad[]; types: string[] }>();
  const incoming = new Map<string, number>();
  for (const q of quads) {
    const k = keyOf(q.subject);
    if (!subjects.has(k)) subjects.set(k, { term: q.subject, quads: [], types: [] });
    const s = subjects.get(k)!;
    if (q.predicate.value === RDF_TYPE && q.object.termType === "NamedNode") s.types.push(q.object.value);
    else s.quads.push(q);
    if (q.object.termType !== "Literal") incoming.set(keyOf(q.object), (incoming.get(keyOf(q.object)) || 0) + 1);
  }
  const rank = (types: string[]) => {
    const r = TOP_CLASSES.findIndex((c) => types.includes(c));
    return r < 0 ? Infinity : r;
  };
  const tops = [...subjects.keys()].filter((k) => rank(subjects.get(k)!.types) < Infinity)
    .sort((a, b) => rank(subjects.get(a)!.types) - rank(subjects.get(b)!.types));
  const isTop = new Set(tops);

  /** The element name for a node: its top class, else its first BIBFRAME class, else its first class. */
  const elementType = (types: string[]): string | undefined =>
    TOP_CLASSES.find((c) => types.includes(c)) || types.find((t) => t.startsWith(BF) && qname(t)) || types.find((t) => qname(t));

  const written = new Set<string>();
  const literal = (name: string, o: Term, pad: string) => {
    const dt = o.datatype?.value;
    const attr = o.language ? ` xml:lang="${esc(o.language)}"`
      : dt && dt !== XSD_STRING && dt !== LANG_STRING ? ` rdf:datatype="${esc(dt)}"` : "";
    return `${pad}<${name}${attr}>${esc(o.value)}</${name}>`;
  };
  const ref = (name: string, o: Term, pad: string) => o.termType === "BlankNode"
    ? `${pad}<${name} rdf:nodeID="${nodeId(o.value)}"/>`
    : `${pad}<${name} rdf:resource="${esc(o.value)}"/>`;

  const nodeXml = (k: string, depth: number): string => {
    written.add(k);
    const { term, quads: qs, types } = subjects.get(k)!;
    const pad = "  ".repeat(depth);
    const typeIri = elementType(types);
    const el = (typeIri && qname(typeIri)) || "rdf:Description";
    const attrs = term.termType === "NamedNode" ? ` rdf:about="${esc(term.value)}"`
      : (incoming.get(k) || 0) > 1 || depth === 1 ? ` rdf:nodeID="${nodeId(term.value)}"` : "";
    const lines: string[] = [];
    for (const t of types) if (t !== typeIri) lines.push(`${pad}  <rdf:type rdf:resource="${esc(t)}"/>`);
    for (const q of qs) {
      const name = qname(q.predicate.value);
      if (!name) throw new Error(`Predicate cannot be written as RDF/XML: ${q.predicate.value}`);
      const o = q.object;
      if (o.termType === "Literal") { lines.push(literal(name, o, `${pad}  `)); continue; }
      const ok = keyOf(o);
      // Nest a node that has statements of its own, unless it stands at the top or was already written.
      if (subjects.has(ok) && !isTop.has(ok) && !written.has(ok)) {
        lines.push(`${pad}  <${name}>\n${nodeXml(ok, depth + 2)}\n${pad}  </${name}>`);
      } else lines.push(ref(name, o, `${pad}  `));
    }
    return lines.length ? `${pad}<${el}${attrs}>\n${lines.join("\n")}\n${pad}</${el}>` : `${pad}<${el}${attrs}/>`;
  };

  const blocks: string[] = [];
  for (const k of tops) blocks.push(nodeXml(k, 1));
  // Anything not reached from the Work, Instance or Items (a stray node) still goes out, at the top.
  for (const k of subjects.keys()) if (!written.has(k)) blocks.push(nodeXml(k, 1));
  const xmlns = [...nsPrefix].map(([ns, p]) => `\n    xmlns:${p}="${esc(ns)}"`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rdf:RDF${xmlns}>\n${blocks.join("\n")}\n</rdf:RDF>\n`;
}
