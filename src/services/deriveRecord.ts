/**
 * Copy and derive (Phase 7, as Libris and Marva do): start a new record from the one that is open.
 *
 * - "edition": the same Work (creators, subjects, classification, language, genre all kept) with a fresh
 *   Instance that keeps only the title and the kind of carrier — the new edition's publisher, date,
 *   ISBN, extent and copies are typed new.
 * - "translation": a new Work linked to the original with bf:translationOf; creators, subjects and
 *   classification kept, language left to fill; the Instance starts empty but for media and carrier.
 *
 * Both get new Moon URIs (the editor mints them), and the new record's AdminMetadata names the record it
 * came from (bf:derivedFrom). Nothing of the source record's own identity (its URIs, identifiers, holdings,
 * admin metadata) is copied. Links to authorities (LC, VIAF, Moon) are kept as they are.
 */

export type DeriveKind = 'edition' | 'translation';

const WORK_KEEP: Record<DeriveKind, string[]> = {
  edition: ['bf:title', 'bf:contribution', 'bf:language', 'bf:content', 'bf:subject', 'bf:genreForm', 'bf:classification',
    'bf:summary', 'bf:intendedAudience', 'bf:originDate', 'bf:originPlace', 'bf:geographicCoverage', 'bf:temporalCoverage',
    'bf:expressionOf', 'bf:translationOf', 'bf:notation', 'bflc:governmentPubType'],
  translation: ['bf:contribution', 'bf:content', 'bf:subject', 'bf:genreForm', 'bf:classification', 'bf:intendedAudience',
    'bf:originDate', 'bf:originPlace', 'bf:geographicCoverage', 'bf:temporalCoverage', 'bf:expressionOf', 'bflc:governmentPubType'],
};
const INSTANCE_KEEP: Record<DeriveKind, string[]> = {
  edition: ['bf:title', 'bf:media', 'bf:carrier', 'bf:issuance', 'bf:responsibilityStatement'],
  translation: ['bf:media', 'bf:carrier', 'bf:issuance'],
};

const all = (v: any): any[] => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);

/** A deep copy without the source record's own node ids (its URIs and #fragments); outside URIs stay. */
function detach(value: any, own: (id: string) => boolean): any {
  if (Array.isArray(value)) return value.map((v) => detach(v, own));
  if (!value || typeof value !== 'object') return value;
  const out: any = {};
  for (const [k, v] of Object.entries(value)) {
    if (k === '@id' && typeof v === 'string' && own(v)) continue;
    out[k] = detach(v, own);
  }
  return out;
}

/** The main title words of a Work or Instance, for the translationOf label. */
function titleOf(node: any): string {
  const t = all(node?.['bf:title']).find((x) => !all(x?.['@type']).includes('bf:VariantTitle')) ?? all(node?.['bf:title'])[0];
  const main = all(t?.['bf:mainTitle'])[0];
  return String(main?.['@value'] ?? main ?? t?.['rdfs:label'] ?? '').trim();
}

export function deriveRecord(source: { work: any; instance: any }, kind: DeriveKind, newIds: { work: string; instance: string }): { work: any; instance: any } {
  const sourceWork = source.work || {};
  const sourceInstance = source.instance || {};
  const sourceIds = [sourceWork['@id'], sourceInstance['@id']].filter((x): x is string => typeof x === 'string' && !!x);
  // The record's own nodes: its Work and Instance URIs and anything under them (#title, -item …).
  const own = (id: string) => sourceIds.some((s) => id === s || id.startsWith(`${s}#`) || id.startsWith(`${s}-`));

  const work: any = { '@id': newIds.work, '@type': sourceWork['@type'] || 'bf:Work' };
  for (const k of WORK_KEEP[kind]) if (sourceWork[k] !== undefined) work[k] = detach(sourceWork[k], own);
  const instance: any = { '@id': newIds.instance, '@type': sourceInstance['@type'] || 'bf:Instance', 'bf:instanceOf': { '@id': newIds.work } };
  for (const k of INSTANCE_KEEP[kind]) if (sourceInstance[k] !== undefined) instance[k] = detach(sourceInstance[k], own);

  if (kind === 'translation' && sourceWork['@id']) {
    const label = titleOf(sourceWork) || titleOf(sourceInstance);
    work['bf:translationOf'] = { '@id': sourceWork['@id'], '@type': 'bf:Work', ...(label ? { 'rdfs:label': label } : {}) };
    // The original title stays findable as a variant until the translated title is typed.
    if (label) work['bf:title'] = [{ '@type': 'bf:VariantTitle', 'bf:mainTitle': label, 'bf:variantType': 'original title' }];
  }

  const from = sourceWork['@id'] || sourceInstance['@id'];
  if (from) {
    // One object, as the record builder reads it (buildAdminNode keeps bf:derivedFrom from it).
    work['bf:adminMetadata'] = { '@type': 'bf:AdminMetadata', 'bf:derivedFrom': { '@id': from } };
  }
  return { work, instance };
}
