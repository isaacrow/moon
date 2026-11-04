// A saved record's version history on the server: list, read one version, revert to it.
import { moonFetch } from './moonApi';

export interface RecordVersionSummary {
  version: number;
  title: string;
  status: string;
  savedBy?: string;
  savedAt: string;
  note?: string;
}

export interface RecordVersion extends RecordVersionSummary {
  document: any;
}

export class HistoryError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const path = (id: string) => `/records/${encodeURIComponent(id)}`;

/** Versions newest first, plus the current one and the one the public catalogue shows. */
export async function fetchVersions(id: string): Promise<{ current: number | null; published: number | null; versions: RecordVersionSummary[] }> {
  const { ok, status, data } = await moonFetch(`${path(id)}/versions`);
  if (!ok) throw new HistoryError(data?.error || 'Could not load the history', status);
  return { current: data.current ?? null, published: data.published ?? null, versions: data.versions || [] };
}

export async function fetchVersion(id: string, version: number): Promise<RecordVersion> {
  const { ok, status, data } = await moonFetch(`${path(id)}/versions/${version}`);
  if (!ok) throw new HistoryError(data?.error || `Could not load version ${version}`, status);
  return data;
}

/** Makes `version` current again as a new version; returns the new version's number and status. */
export async function revertToVersion(id: string, version: number): Promise<{ version: number; status: string }> {
  const { ok, status, data } = await moonFetch(`${path(id)}/revert`, { body: { version } });
  if (!ok) throw new HistoryError(data?.error || 'Could not revert the record', status);
  return { version: data.version, status: data.status };
}
