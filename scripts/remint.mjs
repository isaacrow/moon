// Gives a record's own entities permanent, resolvable URIs under BASE_URI, replacing the placeholder
// ids older records were saved with (http://example.org/..., http://moon.local/..., moonlib.org, ...).
//
//   Work → <base>/work/<id>, Instance → <base>/instance/<id>, Expression → <base>/expression/<id>-<n>,
//   Item → <base>/item/<id>-<n>, AdminMetadata → <base>/admin/<id>
//   Any other placeholder id (titles, contributions…) → a blank node (_:b1, _:b2…).
//
// Ids that are not placeholders (id.loc.gov, VIAF, Wikidata… and URIs already under <base>) are kept.
// Every reference to a changed id elsewhere in the record changes with it.

export const BASE_URI = (process.env.MOON_URI_BASE || 'https://mooon.site/resource').replace(/\/+$/, '');

const PLACEHOLDER = /^https?:\/\/(example\.org|moon\.local|moonlib\.org|localhost)(\/|$)/i;
const ROLES = [
  ['Work', 'work'],
  ['Instance', 'instance'],
  ['Expression', 'expression'],
  ['Item', 'item'],
  ['AdminMetadata', 'admin'],
];

const isPlaceholder = (id) => typeof id === 'string' && PLACEHOLDER.test(id);

function roleOf(node) {
  const types = [].concat(node?.['@type'] ?? []).map(String);
  for (const [cls, kind] of ROLES) {
    if (types.some((t) => t === `bf:${cls}` || t === cls || t.endsWith(`/bibframe/${cls}`))) return kind;
  }
  return null;
}

/** The new id for every placeholder id in the record; an empty map means nothing to change. */
export function plan(recordId, document) {
  const graph = Array.isArray(document?.['@graph']) ? document['@graph'] : [];
  const mapping = new Map();
  const counters = { expression: 0, item: 0 };
  // Top-level entities first, so the Work, Instance… get the readable URIs.
  for (const node of graph) {
    const kind = roleOf(node);
    const id = node?.['@id'];
    if (!kind || !isPlaceholder(id) || mapping.has(id)) continue;
    const taken = [...mapping.values()].some((v) => v === `${BASE_URI}/${kind}/${recordId}`);
    if ((kind === 'work' || kind === 'instance' || kind === 'admin') && taken) continue;
    mapping.set(id, kind === 'expression' || kind === 'item'
      ? `${BASE_URI}/${kind}/${recordId}-${++counters[kind]}`
      : `${BASE_URI}/${kind}/${recordId}`);
  }
  // Every other placeholder id, wherever it appears, becomes a blank node.
  let blank = 0;
  (function walk(v) {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!v || typeof v !== 'object') return;
    for (const [k, x] of Object.entries(v)) {
      if (k === '@id' && isPlaceholder(x) && !mapping.has(x)) mapping.set(x, `_:b${++blank}`);
      else walk(x);
    }
  })(graph);
  return mapping;
}

/** The record with its ids replaced (a deep copy); references to changed ids change with them. */
export function apply(document, mapping) {
  const swap = (v) => {
    if (Array.isArray(v)) return v.map(swap);
    if (v && typeof v === 'object') {
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === '@id' && mapping.has(x) ? mapping.get(x) : swap(x)]));
    }
    return v;
  };
  return { ...document, '@graph': swap(document['@graph'] || []) };
}

/** The URI set the editor uses for a record, for the record's metadata. */
export function uriSet(recordId) {
  return {
    work: `${BASE_URI}/work/${recordId}`,
    expression: `${BASE_URI}/expression/${recordId}-1`,
    instance: `${BASE_URI}/instance/${recordId}`,
    item: `${BASE_URI}/item/${recordId}-1`,
    admin: `${BASE_URI}/admin/${recordId}`,
  };
}
