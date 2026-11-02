/**
 * BIBFRAME import
 *
 * Reads a BIBFRAME description in any JSON-LD form (LC's expanded id.loc.gov records as well as Moon's
 * compact exports), Turtle or N-Triples, and returns the Work, Instance and Item as the editor holds them:
 * compact bf:/bflc: keys, linked descriptions (contributions, titles, provision, admin metadata) embedded.
 */

import { Parser as N3Parser } from 'n3';
import jsonld from 'jsonld';

export type ImportFormat = 'jsonld' | 'turtle' | 'ntriples';

export interface ImportedRecord {
  work: any;
  instance: any;
  item?: any;
}

const PREFIXES: Record<string, string> = {
  bf: 'http://id.loc.gov/ontologies/bibframe/',
  bflc: 'http://id.loc.gov/ontologies/bflc/',
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
  xsd: 'http://www.w3.org/2001/XMLSchema#',
  madsrdf: 'http://www.loc.gov/mads/rdf/v1#'
};
const RDF_TYPE = `${PREFIXES.rdf}type`;
const XSD_STRING = `${PREFIXES.xsd}string`;
const RDF_LANGSTRING = `${PREFIXES.rdf}langString`;

// Links between the record's own entities: the editor rebuilds these, so they stay references.
const ENTITY_LINKS = new Set(['bf:hasInstance', 'bf:instanceOf', 'bf:hasItem', 'bf:itemOf', 'bf:hasExpression', 'bf:expressionOf']);

function compact(iri: string): string {
  for (const [p, ns] of Object.entries(PREFIXES)) {
    if (iri.startsWith(ns) && !iri.slice(ns.length).includes('/')) return `${p}:${iri.slice(ns.length)}`;
  }
  return iri;
}

export async function parseBibframeQuads(text: string, format: ImportFormat): Promise<any[]> {
  if (format === 'jsonld') {
    const nquads = await jsonld.toRDF(JSON.parse(text), { format: 'application/n-quads' }) as unknown as string;
    return new N3Parser({ format: 'N-Quads' }).parse(nquads);
  }
  return new N3Parser({ format: format === 'turtle' ? 'Turtle' : 'N-Triples' }).parse(text);
}

/** Turns RDF quads into the editor's Work / Instance / Item objects. */
export function quadsToEditorRecord(quads: any[]): ImportedRecord | null {
  const bySubject = new Map<string, any[]>();
  for (const q of quads) {
    const key = q.subject.termType === 'BlankNode' ? `_:${q.subject.value}` : q.subject.value;
    if (!bySubject.has(key)) bySubject.set(key, []);
    bySubject.get(key)!.push(q);
  }
  const termKey = (t: any) => (t.termType === 'BlankNode' ? `_:${t.value}` : t.value);
  const typesOf = (s: string) => (bySubject.get(s) || []).filter(q => q.predicate.value === RDF_TYPE).map(q => compact(q.object.value));
  const objectsOf = (s: string, p: string) => (bySubject.get(s) || []).filter(q => compact(q.predicate.value) === p).map(q => termKey(q.object));
  const ofType = (t: string) => [...bySubject.keys()].filter(s => typesOf(s).includes(t));

  // The Instance, the Work it is an instance of (through an expression if there is one), and its Item.
  const instanceId = ofType('bf:Instance').find(s => objectsOf(s, 'bf:instanceOf').length > 0) || ofType('bf:Instance')[0];
  let workId = instanceId ? objectsOf(instanceId, 'bf:instanceOf')[0] : undefined;
  if (workId && objectsOf(workId, 'bf:expressionOf')[0]) workId = objectsOf(workId, 'bf:expressionOf')[0];
  if (!workId || !bySubject.has(workId)) {
    workId = ofType('bf:Work').find(s => objectsOf(s, 'bf:expressionOf').length === 0) || ofType('bf:Work')[0];
  }
  if (!workId && !instanceId) return null;
  const itemId = instanceId
    ? objectsOf(instanceId, 'bf:hasItem')[0] || ofType('bf:Item').find(s => objectsOf(s, 'bf:itemOf').includes(instanceId))
    : undefined;

  const entities = new Set([workId, instanceId, itemId].filter(Boolean) as string[]);

  const value = (term: any, path: Set<string>): any => {
    if (term.termType === 'Literal') {
      const dt = term.datatype?.value;
      if (term.language) return { '@value': term.value, '@language': term.language };
      if (dt && dt !== XSD_STRING && dt !== RDF_LANGSTRING) return { '@value': term.value, '@type': compact(dt) };
      return term.value;
    }
    const key = termKey(term);
    // Described resources are embedded (once per path, so cycles stop); entities and bare IRIs stay links.
    if (!entities.has(key) && bySubject.has(key) && !path.has(key)) return describe(key, new Set([...path, key]));
    return term.termType === 'BlankNode' ? {} : { '@id': key };
  };

  const describe = (s: string, path: Set<string>): any => {
    const node: any = {};
    if (!s.startsWith('_:')) node['@id'] = s;
    const types = typesOf(s);
    if (types.length) node['@type'] = types.length === 1 ? types[0] : types;
    const props = new Map<string, any[]>();
    for (const q of bySubject.get(s) || []) {
      if (q.predicate.value === RDF_TYPE) continue;
      const p = compact(q.predicate.value);
      const v = ENTITY_LINKS.has(p) ? { '@id': termKey(q.object) } : value(q.object, path);
      if (!props.has(p)) props.set(p, []);
      props.get(p)!.push(v);
    }
    for (const [p, vs] of props) node[p] = vs.length === 1 ? vs[0] : vs;
    return node;
  };

  return {
    work: workId ? describe(workId, new Set([workId])) : { '@type': 'bf:Work' },
    instance: instanceId ? describe(instanceId, new Set([instanceId])) : { '@type': 'bf:Instance' },
    ...(itemId && bySubject.has(itemId) ? { item: describe(itemId, new Set([itemId])) } : {})
  };
}

/** Reads a file's text as BIBFRAME; Moon's own saved-record JSON ({ work, instance }) is taken as is. */
export async function importBibframe(text: string, format: ImportFormat): Promise<ImportedRecord | null> {
  if (format === 'jsonld') {
    const parsed = JSON.parse(text);
    if (parsed && !Array.isArray(parsed) && parsed.work && parsed.instance && !parsed['@graph'] && !parsed['@context']) {
      return { work: parsed.work, instance: parsed.instance, ...(parsed.item ? { item: parsed.item } : {}) };
    }
  }
  return quadsToEditorRecord(await parseBibframeQuads(text, format));
}
