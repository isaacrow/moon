/**
 * Repairs records saved by Moon's early editor, which stored BIBFRAME the old way, so that every tool
 * (JSON-LD processors, the OPAC, SPARQL, LC's bibframe2marc) reads all of their data again:
 *
 * 1. Field names without a prefix ("title") become BIBFRAME terms ("bf:title") when the ontology defines
 *    them; when the prefixed field is already there, the old copy is dropped (it was never read).
 *    "value" becomes rdfs:label on notes, summaries, contents and audiences (as LC writes them) and
 *    rdf:value elsewhere; two old names map to their BIBFRAME terms (topical → bf:subject,
 *    geographicAreaCode → bf:geographicCoverage).
 * 2. Links written as plain text ("http://id.loc.gov/…") become real links ({"@id": …}).
 * 3. Links to placeholders ("http://moon.local/node/…") point to the node of the right class that the
 *    old editor saved beside it (the title link to the one bf:Title, the summary link to the bf:Summary…);
 *    a placeholder with nothing to point to is removed, since it leads nowhere.
 * 4. The Instance points to the record's own Work (bf:instanceOf), instead of a placeholder or nothing.
 *
 * Nothing is invented: every value in the result was in the record. The input is not changed, and running
 * it twice gives the same result.
 */
import {
  BF_OBJECT_PROPERTIES, BF_DATATYPE_PROPERTIES, BFLC_OBJECT_PROPERTIES, BFLC_DATATYPE_PROPERTIES, BF_SUPERCLASSES,
  BF_PROPERTY_DOMAINS,
} from './bibframeTerms.generated';

const PLACEHOLDER = /^https?:\/\/(moon\.local|example\.(org|com))\//;
const RENAMES: Record<string, string> = { topical: 'bf:subject', geographicAreaCode: 'bf:geographicCoverage', label: 'rdfs:label' };
/** Classes whose text LC writes as rdfs:label (a bf:Note's text, a summary …). */
const LABELLED = ['Note', 'Summary', 'TableOfContents', 'IntendedAudience', 'Extent', 'Title', 'Agent', 'Place', 'Topic'];
/** What a placeholder link of each property may point to (subclasses included). */
const LINK_TARGETS: Record<string, string[]> = {
  title: ['Title'], summary: ['Summary'], tableOfContents: ['TableOfContents'], note: ['Note'],
  intendedAudience: ['IntendedAudience'], adminMetadata: ['AdminMetadata'], contribution: ['Contribution'],
  provisionActivity: ['ProvisionActivity'], identifiedBy: ['Identifier'], extent: ['Extent'], classification: ['Classification'],
  subject: ['Topic', 'Place', 'Agent', 'Temporal'], genreForm: ['GenreForm'], dimensions: ['Dimensions'],
  supplementaryContent: ['SupplementaryContent'], illustrativeContent: ['Illustration'], hasSeries: ['Work', 'Hub'],
};

export interface FixReport {
  renamed: number;
  droppedDuplicates: number;
  linksMade: number;
  placeholdersRelinked: number;
  placeholdersRemoved: number;
  instanceLinked: boolean;
}

const list = (v: any): any[] => (Array.isArray(v) ? v : v == null ? [] : [v]);
const local = (t: string) => t.replace(/^.*[:#/]/, '');
const typesOf = (n: any): string[] => list(n?.['@type']).map((t) => local(String(t)));
function isSubclass(cls: string, base: string, seen = new Set<string>()): boolean {
  if (cls === base) return true;
  if (seen.has(cls)) return false;
  seen.add(cls);
  return (BF_SUPERCLASSES[cls] || []).some((s) => isSubclass(s, base, seen));
}
const isA = (n: any, base: string) => typesOf(n).some((t) => isSubclass(t, base));
const isObjectProp = (term: string) => {
  const [ns, name] = term.includes(':') ? term.split(':') : ['', term];
  return ns === 'bf' ? BF_OBJECT_PROPERTIES.has(name) : ns === 'bflc' ? BFLC_OBJECT_PROPERTIES.has(name) : false;
};

/** The BIBFRAME term an unprefixed key stands for, or null when the ontology does not define it. */
function termFor(key: string, node: any): string | null {
  if (key === 'value') return LABELLED.some((c) => isA(node, c)) ? 'rdfs:label' : 'rdf:value';
  if (RENAMES[key]) return RENAMES[key];
  // The early editor also kept shortcut copies of form values on the wrong node (a main title on the
  // Instance, a shelf mark on the Work); a field is only repaired where BIBFRAME allows it.
  const domain = BF_PROPERTY_DOMAINS[key];
  if (domain && typesOf(node).length && !isA(node, domain)) return null;
  if (BF_OBJECT_PROPERTIES.has(key) || BF_DATATYPE_PROPERTIES.has(key)) return `bf:${key}`;
  if (BFLC_OBJECT_PROPERTIES.has(key) || BFLC_DATATYPE_PROPERTIES.has(key)) return `bflc:${key}`;
  return null;
}

export function fixLegacyDocument(document: any): { document: any; report: FixReport; changed: boolean } {
  const doc = structuredClone(document || {});
  const graph: any[] = Array.isArray(doc['@graph']) ? doc['@graph'] : [];
  const report: FixReport = { renamed: 0, droppedDuplicates: 0, linksMade: 0, placeholdersRelinked: 0, placeholdersRemoved: 0, instanceLinked: false };

  // 1–2. Names and plain-text links, on every node and every node nested in it.
  const fixNode = (n: any) => {
    if (!n || typeof n !== 'object' || Array.isArray(n)) return;
    for (const key of Object.keys(n)) {
      if (key.startsWith('@')) continue;
      let k = key;
      if (!key.includes(':')) {
        const term = termFor(key, n);
        if (term) {
          if (n[term] !== undefined) { delete n[key]; report.droppedDuplicates++; continue; }
          n[term] = n[key];
          delete n[key];
          k = term;
          report.renamed++;
        }
      }
      if (isObjectProp(k)) {
        n[k] = Array.isArray(n[k])
          ? n[k].map((v: any) => (typeof v === 'string' && /^https?:\/\//.test(v) ? (report.linksMade++, { '@id': v }) : v))
          : typeof n[k] === 'string' && /^https?:\/\//.test(n[k]) ? (report.linksMade++, { '@id': n[k] }) : n[k];
      }
      for (const v of list(n[k])) if (v && typeof v === 'object' && !('@value' in v)) fixNode(v);
    }
  };
  graph.forEach(fixNode);

  // 3. Placeholder links point to the node of the right class saved beside them.
  const referenced = new Set<string>();
  for (const n of graph) for (const [k, v] of Object.entries(n)) {
    if (k.startsWith('@')) continue;
    for (const x of list(v)) if (x && typeof x === 'object' && typeof x['@id'] === 'string') referenced.add(x['@id']);
  }
  const claimed = new Set<string>();
  const work = graph.find((n) => isA(n, 'Work') && !PLACEHOLDER.test(String(n['@id'] || '')));
  const instance = graph.find((n) => isA(n, 'Instance') && !PLACEHOLDER.test(String(n['@id'] || '')));
  for (const n of graph) {
    for (const k of Object.keys(n)) {
      if (k.startsWith('@')) continue;
      const prop = local(k);
      const values = list(n[k]);
      if (!values.some((v) => v && typeof v === 'object' && PLACEHOLDER.test(String(v['@id'] || '')))) continue;
      const out: any[] = [];
      for (const v of values) {
        const id = v && typeof v === 'object' ? String(v['@id'] || '') : '';
        if (!PLACEHOLDER.test(id)) { out.push(v); continue; }
        // A placeholder for the record's own Work or Instance is that node.
        if (/\/work\//.test(id) && work && n !== work) { out.push({ '@id': work['@id'] }); report.placeholdersRelinked++; continue; }
        if (/\/instance\//.test(id) && instance && n !== instance) { out.push({ '@id': instance['@id'] }); report.placeholdersRelinked++; continue; }
        const classes = LINK_TARGETS[prop] || [];
        const target = graph.find((m) => m !== n && classes.some((c) => isA(m, c)) && typeof m['@id'] === 'string'
          && !claimed.has(m['@id']) && !referenced.has(m['@id']) && !PLACEHOLDER.test(m['@id']));
        if (target) { out.push({ '@id': target['@id'] }); claimed.add(target['@id']); report.placeholdersRelinked++; }
        else report.placeholdersRemoved++;
      }
      if (out.length) n[k] = Array.isArray(n[k]) ? out : out[0];
      else delete n[k];
    }
  }

  // 4. The Instance is an instance of the record's own Work.
  if (work && instance) {
    const links = list(instance['bf:instanceOf']).map((v) => (typeof v === 'string' ? v : v?.['@id']));
    if (!links.includes(work['@id'])) {
      instance['bf:instanceOf'] = { '@id': work['@id'] };
      report.instanceLinked = true;
    }
  }

  const changed = report.renamed + report.droppedDuplicates + report.linksMade + report.placeholdersRelinked
    + report.placeholdersRemoved > 0 || report.instanceLinked;
  return { document: doc, report, changed };
}

/** The Work's main title (and subtitle), for records stored with the title "Untitled". */
export function titleOf(document: any): string | undefined {
  const graph: any[] = Array.isArray(document?.['@graph']) ? document['@graph'] : [];
  const byId = new Map(graph.filter((n) => typeof n?.['@id'] === 'string').map((n) => [n['@id'], n]));
  const text = (v: any): string | undefined => {
    for (const x of list(v)) {
      const t = typeof x === 'string' ? x : x?.['@value'];
      if (typeof t === 'string' && t.trim()) return t.trim();
    }
    return undefined;
  };
  for (const n of graph.filter((m) => isA(m, 'Work')).concat(graph.filter((m) => isA(m, 'Instance')))) {
    for (const t of list(n['bf:title'])) {
      const node = t && typeof t === 'object' && t['@id'] && byId.get(t['@id']) ? byId.get(t['@id']) : t;
      const main = text(node?.['bf:mainTitle']);
      if (main) {
        const sub = text(node?.['bf:subtitle']);
        return (sub ? `${main.replace(/\s*:\s*$/, '')} : ${sub}` : main).slice(0, 300);
      }
    }
  }
  return undefined;
}
