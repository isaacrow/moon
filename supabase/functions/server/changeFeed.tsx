/**
 * Moon's change feed (Phase 13 S19): an ActivityStreams 2.0 OrderedCollection at
 * https://mooon.site/resource/changes, as LC (id.loc.gov/activitystreams) and OCLC publish theirs, so another
 * catalogue, a union catalogue or a cache can follow what Moon publishes without harvesting everything again.
 * Each published record is one activity: Create (first published), Update (changed since) or Delete
 * (withdrawn), newest first, 50 to a page; each names the record's Instance and Work and its page.
 * No imports: the edge function passes the records; the tests run it in Node.
 */

export interface FeedRecord { id: string; title?: string; document?: any; createdAt?: string; saved?: string; deletedAt?: string }
export const PAGE_SIZE = 50;
const AS = "https://www.w3.org/ns/activitystreams";

const types = (n: any): string[] => (Array.isArray(n?.["@type"]) ? n["@type"] : n?.["@type"] ? [n["@type"]] : []).map(String);
const nodeId = (doc: any, t: string) => (Array.isArray(doc?.["@graph"]) ? doc["@graph"] : []).find((n: any) => types(n).some((x) => x === `bf:${t}` || x.endsWith(`/${t}`)))?.["@id"];

/** One activity per record, newest first. */
export function activities(records: FeedRecord[], base: string): any[] {
  const items = records.map((r) => {
    const when = r.deletedAt || r.saved || r.createdAt || new Date(0).toISOString();
    const type = r.deletedAt ? "Delete" : r.createdAt && r.saved && Math.abs(Date.parse(r.saved) - Date.parse(r.createdAt)) < 60_000 ? "Create" : "Update";
    const instance = nodeId(r.document, "Instance") || `${base}/instance/${r.id}`;
    const work = nodeId(r.document, "Work");
    return {
      id: `${base}/changes/${encodeURIComponent(r.id)}/${Date.parse(when) || 0}`,
      type,
      published: new Date(when).toISOString(),
      object: {
        id: instance,
        type: r.deletedAt ? "Tombstone" : ["bf:Instance"],
        ...(r.title && !r.deletedAt ? { name: r.title } : {}),
        ...(r.deletedAt ? {} : { url: [{ type: "Link", href: `${instance}.jsonld`, mediaType: "application/ld+json" }, { type: "Link", href: `${instance}.nt`, mediaType: "application/n-triples" }] }),
        ...(work && !r.deletedAt ? { "bf:instanceOf": work } : {}),
      },
    };
  });
  return items.sort((a, b) => (a.published < b.published ? 1 : a.published > b.published ? -1 : a.id.localeCompare(b.id)));
}

/** The collection (no page) or one page of it (page 1 is the newest). */
export function changeFeed(records: FeedRecord[], base: string, page?: number): any {
  const items = activities(records, base);
  const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const url = (p: number) => `${base}/changes?page=${p}`;
  if (!page) {
    return {
      "@context": AS, id: `${base}/changes`, type: "OrderedCollection",
      summary: "What Moon has published, changed or withdrawn, newest first.",
      totalItems: items.length, first: { id: url(1), type: "OrderedCollectionPage" }, last: { id: url(pages), type: "OrderedCollectionPage" },
    };
  }
  const p = Math.min(Math.max(1, Math.floor(page)), pages);
  return {
    "@context": AS, id: url(p), type: "OrderedCollectionPage", partOf: `${base}/changes`, totalItems: items.length,
    ...(p > 1 ? { prev: url(p - 1) } : {}), ...(p < pages ? { next: url(p + 1) } : {}),
    orderedItems: items.slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE),
  };
}
