/**
 * Saving a whole MARC file (e.g. a Koha export) as Moon records: each record gets its own Moon id and
 * URIs, goes through the same duplicate check as a save from the editor, and is saved one by one.
 * The save and the duplicate check are passed in, so this runs (and is tested) without a server.
 */
import type { ImportedMarcRecord } from './marcToBibframe';
import { mintUriSet, generateRecordId } from '../uriMintingService';

export interface BatchOptions {
  cataloger: string;
  fileName: string;
  save: (record: any) => Promise<{ id: string; status?: string }>;
  findDuplicates: (record: any) => Promise<{ title: string }[]>;
  onProgress?: (done: number, total: number) => void;
  newId?: () => string;
}

export interface BatchResult {
  saved: { title: string; id: string; status?: string }[];
  duplicates: { title: string; existing: string }[];
  failed: { title: string; error: string }[];
}

/** A MARC record as the record the editor saves: linked Work / Instance / Item under fresh Moon URIs. */
export function toMoonRecord(imported: ImportedMarcRecord, recordId: string, cataloger: string, fileName: string) {
  const uriSet = mintUriSet(recordId);
  const work = { ...imported.work, '@id': uriSet.work, 'bf:hasInstance': { '@id': uriSet.instance } };
  const instance = { ...imported.instance, '@id': uriSet.instance, 'bf:instanceOf': { '@id': uriSet.work } };
  const hasItem = Object.keys(imported.item || {}).some((k) => !k.startsWith('@'));
  return {
    '@context': { bf: 'http://id.loc.gov/ontologies/bibframe/', bflc: 'http://id.loc.gov/ontologies/bflc/', rdfs: 'http://www.w3.org/2000/01/rdf-schema#', rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#' },
    work,
    instance,
    ...(hasItem ? { item: { ...imported.item, '@id': uriSet.item, 'bf:itemOf': { '@id': uriSet.instance } } } : {}),
    metadata: {
      recordId, uriSet,
      templateId: 'monograph-complete',
      catalogingInterface: 'MARC import',
      resourceType: `MARC import (${fileName})`,
      descriptionConventions: 'rda',
      createdAt: new Date().toISOString(),
      catalogerId: cataloger,
    },
  };
}

export async function importMarcBatch(records: ImportedMarcRecord[], options: BatchOptions): Promise<BatchResult> {
  const result: BatchResult = { saved: [], duplicates: [], failed: [] };
  const newId = options.newId || generateRecordId;
  for (let i = 0; i < records.length; i++) {
    const imported = records[i];
    const record = toMoonRecord(imported, newId(), options.cataloger, options.fileName);
    try {
      // The same check as a save from the editor: same ISBN, LCCN or title means it is probably already here.
      const existing = await options.findDuplicates(record);
      if (existing.length) {
        result.duplicates.push({ title: imported.title, existing: existing[0].title });
      } else {
        const saved = await options.save(record);
        result.saved.push({ title: imported.title, id: saved.id, status: saved.status });
      }
    } catch (err) {
      result.failed.push({ title: imported.title, error: err instanceof Error ? err.message : String(err) });
    }
    options.onProgress?.(i + 1, records.length);
  }
  return result;
}
