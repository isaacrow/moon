/**
 * RDF/XML → RDF quads, on the browser's own XML parser (DOMParser), so importing LC's and other systems'
 * RDF/XML needs no Node-only library. Covers the RDF/XML syntax (W3C RDF 1.1 XML Syntax) that BIBFRAME
 * records use: node elements (rdf:about, rdf:ID, rdf:nodeID, typed nodes), property elements (rdf:resource,
 * rdf:nodeID, nested nodes, rdf:datatype, xml:lang, parseType Resource / Literal / Collection), property
 * attributes, rdf:li, and xml:base.
 */
import { DataFactory } from 'n3';

const { namedNode, blankNode, literal, quad } = DataFactory;
const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const XML = 'http://www.w3.org/XML/1998/namespace';
const ELEMENT = 1;
const TEXT_NODES = new Set([3, 4]); // text, CDATA

type DOMParserLike = { parseFromString(text: string, type: string): any };

const resolve = (ref: string, base: string) => {
  if (!base) return ref;
  try { return new URL(ref, base).toString(); } catch { return ref; }
};

export function parseRdfXml(text: string, options: { baseIRI?: string; DOMParser?: new () => DOMParserLike } = {}): any[] {
  const Parser = options.DOMParser || (globalThis as any).DOMParser;
  if (!Parser) throw new Error('No XML parser is available to read RDF/XML.');
  let doc: any;
  try {
    doc = new Parser().parseFromString(text, 'application/xml');
  } catch {
    throw new Error('This file is not well-formed XML.');
  }
  const root = doc?.documentElement;
  if (!root || root.localName === 'parsererror' || doc.getElementsByTagName('parsererror').length) {
    throw new Error('This file is not well-formed XML.');
  }
  const quads: any[] = [];
  let bnodeCount = 0;
  const freshBlank = () => blankNode(`rx${bnodeCount++}`);
  const children = (el: any): any[] => Array.from(el.childNodes || []).filter((n: any) => n.nodeType === ELEMENT);
  const iriOf = (el: any) => `${el.namespaceURI || ''}${el.localName}`;
  const attrs = (el: any): any[] => Array.from(el.attributes || []);
  const rdfAttr = (el: any, name: string) => (el.hasAttributeNS?.(RDF, name) ? el.getAttributeNS(RDF, name) : null);
  const scope = (el: any, parent: { lang: string; base: string }) => ({
    lang: el.hasAttributeNS?.(XML, 'lang') ? el.getAttributeNS(XML, 'lang') : parent.lang,
    base: el.hasAttributeNS?.(XML, 'base') ? resolve(el.getAttributeNS(XML, 'base'), parent.base) : parent.base,
  });
  // Attributes that say something about the node (not RDF syntax, not xml:*, not namespace declarations).
  const propertyAttrs = (el: any) => attrs(el).filter((a) => a.namespaceURI !== XML && a.namespaceURI !== 'http://www.w3.org/2000/xmlns/'
    && !(a.namespaceURI === RDF && ['about', 'ID', 'nodeID', 'resource', 'parseType', 'datatype'].includes(a.localName)) && a.namespaceURI);
  const lit = (value: string, lang: string, datatype?: string) =>
    datatype ? literal(value, namedNode(datatype)) : lang ? literal(value, lang) : literal(value);

  function node(el: any, ctx: { lang: string; base: string }): any {
    const c = scope(el, ctx);
    const about = rdfAttr(el, 'about');
    const id = rdfAttr(el, 'ID');
    const nodeID = rdfAttr(el, 'nodeID');
    const subject = about !== null ? namedNode(resolve(about, c.base))
      : id !== null ? namedNode(resolve(`#${id}`, c.base))
      : nodeID !== null ? blankNode(nodeID) : freshBlank();
    if (!(el.namespaceURI === RDF && el.localName === 'Description')) quads.push(quad(subject, namedNode(`${RDF}type`), namedNode(iriOf(el))));
    for (const a of propertyAttrs(el)) {
      const p = `${a.namespaceURI}${a.localName}`;
      quads.push(quad(subject, namedNode(p), p === `${RDF}type` ? namedNode(resolve(a.value, c.base)) : lit(a.value, c.lang)));
    }
    let li = 1;
    for (const child of children(el)) property(child, subject, c, () => li++);
    return subject;
  }

  function property(el: any, subject: any, ctx: { lang: string; base: string }, nextLi: () => number) {
    const c = scope(el, ctx);
    const predicate = namedNode(el.namespaceURI === RDF && el.localName === 'li' ? `${RDF}_${nextLi()}` : iriOf(el));
    const parseType = rdfAttr(el, 'parseType');
    const resource = rdfAttr(el, 'resource');
    const nodeID = rdfAttr(el, 'nodeID');
    const datatype = rdfAttr(el, 'datatype');
    const kids = children(el);

    if (parseType === 'Resource') {
      const object = freshBlank();
      quads.push(quad(subject, predicate, object));
      let li = 1;
      for (const k of kids) property(k, object, c, () => li++);
      return;
    }
    if (parseType === 'Literal') {
      const Serializer = (globalThis as any).XMLSerializer;
      const serializer = Serializer ? new Serializer() : null;
      const xml = Array.from(el.childNodes as ArrayLike<any>)
        .map((n: any) => (n.nodeType === ELEMENT ? (serializer ? serializer.serializeToString(n) : String(n)) : n.nodeValue)).join('');
      quads.push(quad(subject, predicate, literal(xml, namedNode(`${RDF}XMLLiteral`))));
      return;
    }
    if (parseType === 'Collection') {
      let head: any = namedNode(`${RDF}nil`);
      const items = kids.map((k) => node(k, c));
      for (let i = items.length - 1; i >= 0; i--) {
        const cell = freshBlank();
        quads.push(quad(cell, namedNode(`${RDF}first`), items[i]), quad(cell, namedNode(`${RDF}rest`), head));
        head = cell;
      }
      quads.push(quad(subject, predicate, head));
      return;
    }
    if (kids.length) {
      // A nested node element: the value is that node.
      quads.push(quad(subject, predicate, node(kids[0], c)));
      return;
    }
    const extra = propertyAttrs(el);
    if (resource !== null || nodeID !== null || extra.length) {
      // An empty property element: the value is a resource, a blank node, or a node made of its attributes.
      const object = resource !== null ? namedNode(resolve(resource, c.base)) : nodeID !== null ? blankNode(nodeID) : freshBlank();
      quads.push(quad(subject, predicate, object));
      for (const a of extra) {
        const p = `${a.namespaceURI}${a.localName}`;
        quads.push(quad(object, namedNode(p), p === `${RDF}type` ? namedNode(resolve(a.value, c.base)) : lit(a.value, c.lang)));
      }
      return;
    }
    const value = Array.from(el.childNodes).filter((n: any) => TEXT_NODES.has(n.nodeType)).map((n: any) => n.nodeValue).join('');
    quads.push(quad(subject, predicate, lit(value, c.lang, datatype ? resolve(datatype, c.base) : undefined)));
  }

  const ctx = scope(root, { lang: '', base: options.baseIRI || '' });
  const top = root.namespaceURI === RDF && root.localName === 'RDF' ? children(root) : [root];
  for (const el of top) node(el, ctx);
  return quads;
}
