/**
 * BIBFRAME record storage: the records and record_versions tables, with the old key-value rows kept
 * in step while the move finishes.
 *
 * - Reads come from the records table. A record not copied there yet is read from the key-value
 *   table, so nothing disappears during the switch.
 * - Every save, review decision and delete goes to the tables first (one database call, so the record
 *   and its new version row are written together), then to the key-value row as before, which other
 *   parts of the server (AI search, discovery) still read.
 *
 * Records keep the shape the app has always received from the key-value table, plus `version`.
 */

import * as kv from "./kv_store.tsx";
import { getClient } from "./db.tsx";

const kvKey = (id: string) => `bibframe:record:${id}`;
// The client has no generated database types, so its table and function calls are untyped.
const sb = (): any => getClient();

export interface StoredRecord {
  id: string;
  title: string;
  document: any;
  metadata: Record<string, any>;
  status: string;
  cataloger?: string;
  createdAt?: string;
  saved?: string;
  approvedBy?: string;
  approvedAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  version?: number;
  /** The version the public catalogue shows; may be older than `version` while an edit waits for review. */
  publishedVersion?: number;
}

function fromRow(row: any): StoredRecord {
  return {
    id: row.id,
    title: row.title,
    document: row.document,
    metadata: row.metadata || {},
    status: row.status,
    cataloger: row.cataloger ?? undefined,
    createdAt: row.created_at,
    saved: row.updated_at,
    approvedBy: row.approved_by ?? undefined,
    approvedAt: row.approved_at ?? undefined,
    reviewedBy: row.reviewed_by ?? undefined,
    reviewedAt: row.reviewed_at ?? undefined,
    version: row.current_version,
    publishedVersion: row.published_version ?? undefined,
  };
}

/** A row of the published_records view: the record as the public catalogue shows it. */
function fromPublishedRow(row: any): StoredRecord {
  return {
    id: row.id,
    title: row.title,
    document: row.document,
    metadata: row.metadata || {},
    status: "complete",
    cataloger: row.cataloger ?? undefined,
    createdAt: row.created_at,
    saved: row.updated_at,
    approvedBy: row.approved_by ?? undefined,
    approvedAt: row.approved_at ?? undefined,
    version: row.published_version,
    publishedVersion: row.published_version,
  };
}

function fromKv(raw: any): StoredRecord | null {
  if (!raw) return null;
  const rec = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!rec || typeof rec !== "object") return null;
  // Older rows keep the status in metadata, or have none: those count as published, as they always have.
  const status = rec.status || rec.metadata?.status;
  return {
    ...rec,
    title: rec.title || "Untitled",
    status: status === "pending-review" || status === "needs-review" ? status : "complete",
    cataloger: rec.cataloger || rec.metadata?.catalogerId,
    createdAt: rec.createdAt || rec.saved,
  };
}

/** One record, or null when it does not exist or was deleted. */
export async function getRecord(id: string): Promise<StoredRecord | null> {
  const { data, error } = await sb().from("records").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`[records] read ${id} failed: ${error.message}`);
  if (data) return data.deleted_at ? null : fromRow(data);
  return fromKv(await kv.get(kvKey(id)));
}

/** Every record that is not deleted, from the table plus any not copied there yet. */
export async function listRecords(): Promise<StoredRecord[]> {
  const { data, error } = await sb().from("records").select("*");
  if (error) throw new Error(`[records] list failed: ${error.message}`);
  const rows = data || [];
  const inTable = new Set(rows.map((r: any) => r.id));
  const fromTable = rows.filter((r: any) => !r.deleted_at).map(fromRow);
  const notCopied = (await kv.getByPrefix("bibframe:record:"))
    .map(fromKv)
    .filter((r): r is StoredRecord => !!r && !!r.id && !inTable.has(r.id));
  return [...fromTable, ...notCopied];
}

/**
 * One record as the public catalogue shows it: its published version, even while a newer edit waits
 * for review. Null when it was never published, was deleted or does not exist.
 */
export async function getPublishedRecord(id: string): Promise<StoredRecord | null> {
  const { data, error } = await sb().from("published_records").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`[records] published read ${id} failed: ${error.message}`);
  if (data) return fromPublishedRow(data);
  // A record not copied to the table yet is public if its key-value row is published.
  const { data: row } = await sb().from("records").select("id").eq("id", id).maybeSingle();
  if (row) return null;
  const rec = fromKv(await kv.get(kvKey(id)));
  return rec?.status === "complete" ? rec : null;
}

/** Every published record, each at its published version. */
export async function listPublishedRecords(): Promise<StoredRecord[]> {
  const [published, all] = await Promise.all([
    sb().from("published_records").select("*"),
    sb().from("records").select("id"),
  ]);
  if (published.error) throw new Error(`[records] published list failed: ${published.error.message}`);
  if (all.error) throw new Error(`[records] list failed: ${all.error.message}`);
  const inTable = new Set((all.data || []).map((r: any) => r.id));
  const notCopied = (await kv.getByPrefix("bibframe:record:"))
    .map(fromKv)
    .filter((r): r is StoredRecord => !!r && !!r.id && !inTable.has(r.id) && r.status === "complete");
  return [...(published.data || []).map(fromPublishedRow), ...notCopied];
}

/** Thrown when a save starts from an older version than the record's current one. */
export class VersionConflictError extends Error {
  constructor(readonly currentVersion: number) {
    super(`The record is now at version ${currentVersion}`);
  }
}

/**
 * Saves a record as its next version and returns the version number. With `baseVersion` (the version
 * the editor started from), a record that has moved on since is not saved: VersionConflictError.
 */
export async function saveRecord(
  record: StoredRecord & { saved: string },
  savedBy: string,
  note = "save",
  baseVersion?: number,
): Promise<number> {
  const { data, error } = await sb().rpc("moon_save_record", {
    p_id: record.id,
    p_title: record.title,
    p_status: record.status,
    p_cataloger: record.cataloger ?? null,
    p_document: record.document,
    p_metadata: record.metadata || {},
    p_saved_by: savedBy,
    p_saved_at: record.saved,
    p_note: note,
    p_approved_by: record.approvedBy ?? null,
    p_approved_at: record.approvedAt ?? null,
    p_base_version: baseVersion ?? null,
  });
  const conflict = error?.message?.match(/version_conflict:(\d+)/);
  if (conflict) throw new VersionConflictError(Number(conflict[1]));
  if (error) throw new Error(`[records] save ${record.id} failed: ${error.message}`);
  const { version: _version, publishedVersion: _published, ...kvRecord } = record;
  await kv.set(kvKey(record.id), JSON.stringify(kvRecord));
  return data as number;
}

/** Publishes or returns a record. Returns the updated record, or null when it does not exist. */
export async function reviewRecord(
  id: string,
  status: "complete" | "needs-review",
  by: string,
): Promise<StoredRecord | null> {
  const existing = await getRecord(id);
  if (!existing) return null;
  const now = new Date().toISOString();
  // A record still only in the key-value table is copied over by saving it first.
  if (existing.version === undefined) {
    await saveRecord({ ...existing, saved: existing.saved || now }, existing.cataloger || by);
  }
  const { data, error } = await sb().rpc("moon_review_record", {
    p_id: id,
    p_status: status,
    p_by: by,
    p_at: now,
  });
  if (error) throw new Error(`[records] review ${id} failed: ${error.message}`);
  if (data === null) return null;

  const updated: StoredRecord = {
    ...existing,
    status,
    metadata: { ...(existing.metadata || {}), status },
    reviewedBy: by,
    reviewedAt: now,
    ...(status === "complete" ? { approvedBy: by, approvedAt: now } : {}),
    version: data as number,
  };
  const { version: _version, publishedVersion: _published, ...kvRecord } = updated;
  await kv.set(kvKey(id), JSON.stringify(kvRecord));
  return updated;
}

/** Deletes a record: kept in the table (restorable), removed from the key-value table. */
export async function deleteRecord(id: string): Promise<void> {
  const { error } = await sb().rpc("moon_delete_record", { p_id: id, p_at: new Date().toISOString() });
  if (error) throw new Error(`[records] delete ${id} failed: ${error.message}`);
  await kv.del(kvKey(id));
}

export interface VersionSummary {
  version: number;
  title: string;
  status: string;
  savedBy?: string;
  savedAt: string;
  note?: string;
}

/** A record's versions, newest first, without their documents. */
export async function listVersions(id: string): Promise<VersionSummary[]> {
  const { data, error } = await sb()
    .from("record_versions")
    .select("version, title, status, saved_by, saved_at, note")
    .eq("record_id", id)
    .order("version", { ascending: false });
  if (error) throw new Error(`[records] versions of ${id} failed: ${error.message}`);
  return (data || []).map((v: any) => ({
    version: v.version,
    title: v.title,
    status: v.status,
    savedBy: v.saved_by ?? undefined,
    savedAt: v.saved_at,
    note: v.note ?? undefined,
  }));
}

/** One version with its document, or null. */
export async function getVersion(id: string, version: number): Promise<(VersionSummary & { document: any }) | null> {
  const { data, error } = await sb()
    .from("record_versions")
    .select("*")
    .eq("record_id", id)
    .eq("version", version)
    .maybeSingle();
  if (error) throw new Error(`[records] version ${version} of ${id} failed: ${error.message}`);
  if (!data) return null;
  return {
    version: data.version,
    title: data.title,
    status: data.status,
    savedBy: data.saved_by ?? undefined,
    savedAt: data.saved_at,
    note: data.note ?? undefined,
    document: data.document,
  };
}

/**
 * Makes an earlier version current again, as a new version: nothing in the history is lost, and a
 * revert can itself be reverted. The status follows the same rule as a save. Returns the new version.
 */
export async function revertRecord(
  current: StoredRecord,
  to: { version: number; title: string; document: any },
  by: string,
  status: string,
): Promise<number> {
  const now = new Date().toISOString();
  return saveRecord({
    ...current,
    title: to.title,
    document: to.document,
    status,
    metadata: { ...(current.metadata || {}), status },
    ...(status === "complete" ? { approvedBy: by, approvedAt: now } : {}),
    saved: now,
  }, by, `revert to v${to.version}`);
}

export interface ActiveEditor {
  username: string;
  since: string;
  lastSeen: string;
}

/** Marks `username` as editing the record now; returns the others active on it in the last 90 seconds. */
export async function editingHeartbeat(id: string, username: string): Promise<ActiveEditor[]> {
  const { data, error } = await sb().rpc("moon_editing_heartbeat", { p_id: id, p_user: username });
  if (error) throw new Error(`[records] editing heartbeat ${id} failed: ${error.message}`);
  return (data as ActiveEditor[]) || [];
}

/** `username` closed the record. */
export async function editingLeave(id: string, username: string): Promise<void> {
  const { error } = await sb().rpc("moon_editing_leave", { p_id: id, p_user: username });
  if (error) throw new Error(`[records] editing leave ${id} failed: ${error.message}`);
}

export interface SearchOptions {
  query?: string;
  published?: boolean;
  status?: string;
  cataloger?: string;
  language?: string;
  template?: string;
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  total: number;
  records: Array<StoredRecord & { language?: string; template?: string }>;
  facets: Record<"status" | "cataloger" | "language" | "template", Record<string, number>>;
}

/**
 * One page of records matching every word of the query, however it is spelled (Arabic letter variants,
 * diacritics and romanization marks are folded), with filters and per-filter counts. With
 * `published`, searches what the public catalogue shows. Records still only in the key-value table
 * are not searched; after the move there are none.
 */
export async function searchRecords(o: SearchOptions): Promise<SearchResult> {
  const { data, error } = await sb().rpc("moon_search_records", {
    p_query: o.query ?? "",
    p_published: !!o.published,
    p_status: o.status || null,
    p_cataloger: o.cataloger || null,
    p_language: o.language || null,
    p_template: o.template || null,
    p_limit: o.limit ?? 50,
    p_offset: o.offset ?? 0,
  });
  if (error) throw new Error(`[records] search failed: ${error.message}`);
  return data as SearchResult;
}

/** The published record that describes `uri` (any node with that @id), or null. */
export async function findPublishedByUri(uri: string): Promise<{ id: string; title: string; document: any; version: number; saved: string } | null> {
  const { data, error } = await sb().rpc("moon_find_published_by_uri", { p_uri: uri });
  if (error) throw new Error(`[records] resolve ${uri} failed: ${error.message}`);
  return data ?? null;
}

export type NotificationKind = "welcome" | "review" | "approved" | "returned";

/**
 * Adds a notification. Never throws: a notification that fails to send must not undo the save or
 * review that caused it.
 */
export async function notify(
  username: string | undefined,
  kind: NotificationKind,
  record: { id?: string; title?: string },
  actor?: string,
  reason?: string,
): Promise<void> {
  if (!username) return;
  const { error } = await sb().rpc("moon_notify", {
    p_user: username, p_kind: kind, p_record_id: record.id ?? null, p_record_title: record.title ?? null,
    p_actor: actor ?? null, p_reason: reason ?? null,
  });
  if (error) console.error(`[notifications] ${kind} for ${username} failed: ${error.message}`);
}

export async function listNotifications(username: string): Promise<{ unread: number; items: any[] }> {
  const { data, error } = await sb().rpc("moon_notifications", { p_user: username, p_limit: 30 });
  if (error) throw new Error(`[notifications] list failed: ${error.message}`);
  return data;
}

export async function markNotificationsRead(username: string, ids?: number[]): Promise<number> {
  const { data, error } = await sb().rpc("moon_notifications_read", { p_user: username, p_ids: ids?.length ? ids : null });
  if (error) throw new Error(`[notifications] mark read failed: ${error.message}`);
  return data as number;
}
