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
