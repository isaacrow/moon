/**
 * What changed between two versions of a record, field by field.
 *
 * Each JSON-LD document is flattened into "field: value" lines, where a field is the node it belongs to
 * (Work, Instance, Item…) followed by its property path, e.g. `Instance › title › mainTitle`. Comparing
 * the lines as multisets keeps a value that only moved within a list from showing as a change.
 */

export interface DiffEntry {
  /** Human-readable field path, e.g. "Instance › provisionActivity › date". */
  field: string;
  kind: 'added' | 'removed' | 'changed';
  before: string[];
  after: string[];
}

// URI and blank-node ids change on every save without meaning anything to a cataloger.
const SKIP_KEYS = new Set(['@id', '@context']);

function shortName(term: string): string {
  const s = term.replace(/^https?:\/\/[^#]*[/#]/, '');
  return s.includes(':') ? s.slice(s.indexOf(':') + 1) : s;
}

function typeOf(node: any): string | null {
  const t = ([] as any[]).concat(node?.['@type'] ?? []).find((x) => typeof x === 'string');
  return t ? shortName(t) : null;
}

function leaf(value: any): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object') return String(value);
  if ('@value' in value) return value['@language'] ? `${value['@value']} (@${value['@language']})` : String(value['@value']);
  const keys = Object.keys(value);
  if (keys.length === 1 && keys[0] === '@id') return String(value['@id']);
  return null;
}

function flatten(value: any, path: string, out: Array<[string, string]>): void {
  if (Array.isArray(value)) {
    for (const v of value) flatten(v, path, out);
    return;
  }
  const l = leaf(value);
  if (l !== null) {
    out.push([path, l]);
    return;
  }
  if (!value || typeof value !== 'object') return;
  const t = typeOf(value);
  const base = t && path ? `${path} [${t}]` : path;
  for (const [k, v] of Object.entries(value)) {
    if (SKIP_KEYS.has(k) || k === '@type') continue;
    flatten(v, base ? `${base} › ${shortName(k)}` : shortName(k), out);
  }
}

/** All "field: value" lines of a JSON-LD document. */
export function recordLines(document: any): Array<[string, string]> {
  const graph: any[] = Array.isArray(document?.['@graph']) ? document['@graph'] : [];
  const seen = new Map<string, number>();
  const out: Array<[string, string]> = [];
  for (const node of graph) {
    const type = typeOf(node) || 'Node';
    const n = (seen.get(type) || 0) + 1;
    seen.set(type, n);
    flatten({ ...node, '@type': undefined }, n > 1 ? `${type} ${n}` : type, out);
  }
  return out;
}

/** Field-by-field differences from `before` to `after`, in the order fields appear. */
export function diffRecords(before: any, after: any): DiffEntry[] {
  const a = recordLines(before);
  const b = recordLines(after);
  const count = (lines: Array<[string, string]>) => {
    const m = new Map<string, number>();
    for (const [f, v] of lines) m.set(`${f}\u0000${v}`, (m.get(`${f}\u0000${v}`) || 0) + 1);
    return m;
  };
  const ca = count(a);
  const cb = count(b);
  const removed = new Map<string, string[]>();
  const added = new Map<string, string[]>();
  const take = (lines: Array<[string, string]>, mine: Map<string, number>, other: Map<string, number>, into: Map<string, string[]>) => {
    const used = new Map<string, number>();
    for (const [f, v] of lines) {
      const key = `${f}\u0000${v}`;
      const extra = (mine.get(key) || 0) - (other.get(key) || 0);
      const u = used.get(key) || 0;
      if (u < extra) {
        used.set(key, u + 1);
        into.set(f, [...(into.get(f) || []), v]);
      }
    }
  };
  take(a, ca, cb, removed);
  take(b, cb, ca, added);

  const order: string[] = [];
  for (const [f] of [...a, ...b]) if ((removed.has(f) || added.has(f)) && !order.includes(f)) order.push(f);
  return order.map((field) => {
    const before = removed.get(field) || [];
    const after = added.get(field) || [];
    return { field, before, after, kind: before.length && after.length ? 'changed' : after.length ? 'added' : 'removed' };
  });
}
