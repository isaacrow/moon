/**
 * Protected values (Phase 13 S18): in Moon's shared entity file, a name form, an outside link or a detail
 * that one library added cannot be removed or changed by another library. Only the library that added it,
 * or the Super Admin, may. Each statement remembers which library added it, who and when; that record is
 * kept beside the entity (data._owners), written only by the server, never taken from the request.
 * Statements that were there before Moon kept owners belong to no one and stay open.
 * No imports: index.tsx passes the entity before and after; the tests run it in Node.
 */

export interface EntityShape { label: string; variants: string[]; sameAs: string[]; data?: Record<string, unknown> }
export interface Owner { library: string; by: string; at: string }
export type Owners = Record<string, Owner>;
export interface Blocked { key: string; value: string; library: string; by: string }

export const OWNERS_KEY = "_owners";

/** A library's name as a key: "Kerbala Library " and "kerbala  library" are the same library. */
export const libraryKey = (s: string | undefined) => String(s || "").trim().replace(/\s+/g, " ").toLowerCase();

const linkKey = (u: string) => u.trim().replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "").replace(/^wikidata\.org\/wiki\//, "wikidata.org/entity/");

/** Every statement of an entity, by a key that stays the same while the statement is unchanged. */
export function statementsOf(e: EntityShape): Map<string, string> {
  const out = new Map<string, string>();
  if (e.label?.trim()) out.set(`label:${e.label.trim()}`, e.label.trim());
  for (const v of e.variants || []) if (v?.trim()) out.set(`variant:${v.trim()}`, v.trim());
  for (const u of e.sameAs || []) if (u?.trim()) out.set(`sameAs:${linkKey(u)}`, u.trim());
  for (const [k, v] of Object.entries(e.data || {})) {
    if (k.startsWith("_") || v === undefined || v === null || v === "") continue;
    const text = typeof v === "string" ? v : JSON.stringify(v);
    out.set(`data:${k}=${text}`, `${k}: ${text}`);
  }
  return out;
}

/** The owners stored on an entity (only well-formed entries). */
export function ownersOf(data: Record<string, unknown> | undefined): Owners {
  const raw = (data || {})[OWNERS_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Owners = {};
  for (const [k, o] of Object.entries(raw as Record<string, any>)) {
    if (o && typeof o.library === "string" && typeof o.by === "string" && typeof o.at === "string") out[k] = { library: o.library, by: o.by, at: o.at };
  }
  return out;
}

/**
 * The owners after a save, and what the save may not do: remove or change a statement another library
 * added. The Super Admin may; a statement with no owner is open to all.
 */
export function applyOwnership(before: EntityShape, after: EntityShape, saver: { username: string; library: string; admin: boolean }, at: string): { owners: Owners; blocked: Blocked[] } {
  const prev = statementsOf(before);
  const next = statementsOf(after);
  const owned = ownersOf(before.data);
  const mine = libraryKey(saver.library);
  const blocked: Blocked[] = [];
  for (const [key, value] of prev) {
    const o = owned[key];
    if (next.has(key) || !o || saver.admin) continue;
    if (libraryKey(o.library) !== mine) blocked.push({ key, value, library: o.library, by: o.by });
  }
  const owners: Owners = {};
  for (const key of next.keys()) {
    owners[key] = prev.has(key) ? owned[key] : { library: saver.library, by: saver.username, at };
    if (!owners[key]) delete owners[key];
  }
  return { owners, blocked };
}

/** The entity's data with the owners written in (whatever the request sent for them is ignored). */
export function withOwners(data: Record<string, unknown>, owners: Owners): Record<string, unknown> {
  const { [OWNERS_KEY]: _ignored, ...rest } = data || {};
  return Object.keys(owners).length ? { ...rest, [OWNERS_KEY]: owners } : rest;
}

/** The data as the public sees it: who added what stays with signed-in cataloguers. */
export function withoutOwners(data: Record<string, unknown> | undefined): Record<string, unknown> {
  const { [OWNERS_KEY]: _o, ...rest } = data || {};
  return rest;
}

/** The refusal in plain words. */
export function blockedMessage(blocked: Blocked[]): string {
  const list = blocked.slice(0, 6).map((b) => `"${b.value}" (${b.library})`).join(", ");
  return `These values were added by another library and only they or the Super Admin can remove or change them: ${list}`;
}
