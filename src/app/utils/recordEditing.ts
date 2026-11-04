// Who else has a record open in the editor. The editor reports itself every half minute while the
// record is open and the cataloger is active, and says when it closes the record.
import { moonFetch, moonHeaders, MOON_API } from './moonApi';

export interface ActiveEditor {
  username: string;
  since: string;
  lastSeen: string;
}

const path = (id: string) => `/records/${encodeURIComponent(id)}/editing`;

/** Marks this cataloger as editing the record; returns the other catalogers active on it. */
export async function reportEditing(id: string): Promise<ActiveEditor[]> {
  const { ok, data } = await moonFetch(path(id), { body: {} });
  return ok && Array.isArray(data?.editors) ? data.editors : [];
}

/** This cataloger closed the record. Uses keepalive so it still goes out while the page unloads. */
export function reportStoppedEditing(id: string): void {
  fetch(`${MOON_API}${path(id)}`, { method: 'DELETE', headers: moonHeaders(), keepalive: true }).catch(() => {});
}
