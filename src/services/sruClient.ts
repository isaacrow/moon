/**
 * Copy cataloguing from other library catalogues over SRU (the Library of Congress and any configured on
 * the server): the server fetches MARCXML; here it is read into Moon records with the MARC importer.
 */
import { moonFetch } from '../app/utils/moonApi';
import { parseMarcXml } from './marc/marcRecord';
import { marcToBibframe, ImportedMarcRecord } from './marc/marcToBibframe';

export type SruIndex = 'keyword' | 'title' | 'author' | 'isbn' | 'lccn';
export interface SruTargetInfo { id: string; name: string }

export async function listSruTargets(): Promise<SruTargetInfo[]> {
  const { ok, data } = await moonFetch<{ targets: SruTargetInfo[] }>('/sru/targets');
  return ok && Array.isArray(data?.targets) ? data.targets : [{ id: 'lc', name: 'Library of Congress' }];
}

/** Reads an SRU searchRetrieve response (MARCXML records) into Moon records. */
export function readSruResponse(xml: string): ImportedMarcRecord[] {
  return parseMarcXml(xml).map(marcToBibframe);
}

export async function searchSru(target: string, index: SruIndex, q: string, start = 1): Promise<{ total: number; records: ImportedMarcRecord[] }> {
  const params = new URLSearchParams({ target, index, q, start: String(start) });
  const { ok, data } = await moonFetch<any>(`/sru/search?${params}`);
  if (!ok) throw new Error(data?.error || 'The catalogue could not be searched.');
  if (data.diagnostic && !data.total) throw new Error(`The catalogue says: ${data.diagnostic}`);
  return { total: data.total || 0, records: readSruResponse(data.xml || '') };
}
