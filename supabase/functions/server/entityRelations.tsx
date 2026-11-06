// Phase 10: how entities relate, read from the records that use them. A person who wrote a book with
// another person "worked with" them; a book's author "wrote about" its subjects; a publisher "is based in"
// the place it published in. Nothing is stored: the relations follow the catalogue as it is edited.
import { headingsOf, moonAuthorityId, type LinkKind } from "./authorityLinking.tsx";

export type Relation =
  | "worked-with" | "wrote-about" | "written-about-by" | "studied-with"
  | "published-by" | "published" | "published-in" | "published-here" | "based-in" | "publishers-here";

/** The entity's role in a record, then the other heading's role, give the relation. */
const RELATIONS: Record<string, Relation> = {
  "contributor>contributor": "worked-with",
  "contributor>subject": "wrote-about",
  "subject>contributor": "written-about-by",
  "subject>subject": "studied-with",
  "contributor>publisher": "published-by",
  "publisher>contributor": "published",
  "contributor>place of publication": "published-in",
  "place of publication>contributor": "published-here",
  "publisher>place of publication": "based-in",
  "place of publication>publisher": "publishers-here",
};

/** One spelling of a link, as the database's moon_link_key compares them. */
export const linkKey = (u: string) =>
  u.trim().toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/\/+$/, "").replace(/^wikidata\.org\/wiki\//, "wikidata.org/entity/");
const nameKey = (s: string) => s.normalize("NFKD").replace(/[̀-ًͯ-ْ]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export interface Related {
  relation: Relation;
  kind: LinkKind;
  label: string;
  uri: string | null;
  /** The Moon entity id, once resolved. */
  entityId?: string;
  count: number;
  records: string[];
}

/**
 * The entities related to one entity (known by its addresses: its Moon URI and its LC, VIAF, Wikidata … links)
 * across the given records, most shared records first.
 */
export function relatedFrom(selfLinks: string[], records: { id: string; document: any }[], max = 80): Related[] {
  const self = new Set(selfLinks.filter(Boolean).map(linkKey));
  const rows = new Map<string, Related & { ids: Set<string> }>();
  for (const rec of records) {
    const hs = headingsOf(rec.document);
    const isSelf = (h: { uri: string | null }) => !!h.uri && self.has(linkKey(h.uri));
    const roles = new Set(hs.filter(isSelf).map((h) => h.where));
    if (!roles.size) continue;
    for (const other of hs) {
      if (isSelf(other)) continue;
      for (const role of roles) {
        const relation = RELATIONS[`${role}>${other.where}`];
        if (!relation) continue;
        const key = `${relation}|${other.uri ? linkKey(other.uri) : `name:${nameKey(other.label)}`}`;
        const row = rows.get(key) || { relation, kind: other.kind, label: other.label, uri: other.uri, count: 0, records: [], ids: new Set<string>() };
        row.ids.add(rec.id);
        rows.set(key, row);
      }
    }
  }
  return finish([...rows.values()], max);
}

function finish(rows: (Related & { ids: Set<string> })[], max: number): Related[] {
  return rows
    .map(({ ids, ...r }) => ({ ...r, count: ids.size, records: [...ids].slice(0, 5) }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, max);
}

/**
 * Gives each related heading its Moon entity (a Moon address directly; an LC, VIAF or Wikidata address
 * through the entity that has that link) and folds rows that turn out to be the same entity.
 */
export async function resolveRelated(
  rows: Related[],
  findByLink: (uri: string, kind: LinkKind) => Promise<{ id: string; label: string } | null>,
): Promise<Related[]> {
  const resolved = await Promise.all(rows.map(async (r) => {
    if (!r.uri) return r;
    const moonId = moonAuthorityId(r.uri);
    if (moonId) return { ...r, entityId: moonId };
    const found = await findByLink(r.uri, r.kind).catch(() => null);
    return found ? { ...r, entityId: found.id, label: found.label || r.label } : r;
  }));
  const folded = new Map<string, Related & { ids: Set<string> }>();
  for (const r of resolved) {
    const key = r.entityId ? `${r.relation}|entity:${r.entityId}` : `${r.relation}|${r.uri ? linkKey(r.uri) : `name:${nameKey(r.label)}`}`;
    const row = folded.get(key);
    if (!row) folded.set(key, { ...r, ids: new Set(r.records) });
    else {
      r.records.forEach((id) => row.ids.add(id));
      row.count += r.count - overlap(row.records, r.records);
      row.records = [...row.ids];
      if (!row.uri?.includes("mooon.site") && r.uri?.includes("mooon.site")) row.uri = r.uri;
    }
  }
  return [...folded.values()]
    .map(({ ids, ...r }) => ({ ...r, records: [...ids].slice(0, 5) }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

const overlap = (a: string[], b: string[]) => a.filter((x) => b.includes(x)).length;
