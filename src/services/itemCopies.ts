/**
 * A record's copies (holdings): each physical copy is a BIBFRAME Item of the Instance, shaped as LC's
 * Item profile shapes it:
 *   bf:heldBy → the library (bf:Organization, rdfs:label)
 *   bf:sublocation → where in the library (bf:Sublocation, rdfs:label)
 *   bf:shelfMark → the call number on the spine (bf:ShelfMark, rdfs:label)
 *   bf:identifiedBy → the barcode (bf:Barcode, rdf:value)
 *   bf:enumerationAndChronology → the copy number (bf:Enumeration, rdfs:label "c. 2")
 *   bf:usageAndAccessPolicy → "Reference only" (bf:UsePolicy)
 *   bf:note → a note (bf:Note, rdfs:label)
 */

export interface ItemCopy {
  /** The Item's URI. */
  id: string;
  library: string;
  location: string;
  shelfMark: string;
  barcode: string;
  copyNumber: string;
  referenceOnly: boolean;
  note: string;
}

export const REFERENCE_ONLY = 'Reference only — للاطلاع فقط';

const list = (v: any): any[] => (Array.isArray(v) ? v : v == null ? [] : [v]);

/** The text of a literal or a labelled node: "x", { "@value": "x" }, { "rdfs:label": "x" }, { "rdf:value": "x" }. */
export function textOf(v: any): string {
  for (const x of list(v)) {
    if (typeof x === 'string' || typeof x === 'number') return String(x).trim();
    if (x && typeof x === 'object') {
      const inner = x['@value'] ?? x['rdfs:label'] ?? x['label'] ?? x['rdf:value'] ?? x['value'];
      const t = inner === undefined ? '' : textOf(inner);
      if (t) return t;
    }
  }
  return '';
}

const typeIs = (node: any, name: string) => list(node?.['@type']).some((t) => typeof t === 'string' && (t === `bf:${name}` || t === name || t.endsWith(`/${name}`)));

/** Reads a bf:Item node (as Moon writes it, or as older or imported records have it) into a copy. */
export function nodeToCopy(node: any): ItemCopy {
  const ids = list(node?.['bf:identifiedBy'] ?? node?.['identifiedBy']);
  const barcodeNode = ids.find((i) => typeIs(i, 'Barcode'));
  const copyRaw = textOf(node?.['bf:enumerationAndChronology'] ?? node?.['enumerationAndChronology'] ?? node?.['copyNumber']);
  const policies = list(node?.['bf:usageAndAccessPolicy'] ?? node?.['usageAndAccessPolicy']);
  return {
    id: String(node?.['@id'] || ''),
    library: textOf(node?.['bf:heldBy'] ?? node?.['heldBy']),
    location: textOf(node?.['bf:sublocation'] ?? node?.['sublocation'] ?? node?.['bf:physicalLocation'] ?? node?.['physicalLocation']),
    shelfMark: textOf(node?.['bf:shelfMark'] ?? node?.['shelfMark']),
    barcode: barcodeNode ? textOf(barcodeNode) : textOf(node?.['bf:barcode'] ?? node?.['barcode']),
    copyNumber: copyRaw.replace(/^c\.\s*/i, ''),
    referenceOnly: policies.some((p) => /reference|للاطلاع/i.test(textOf(p))) || node?.['status'] === 'reference_only',
    note: textOf(node?.['bf:note'] ?? node?.['note']),
  };
}

/** Whether a copy says anything a reader could use (an empty Item is not a copy). */
export function hasCopyData(c: ItemCopy): boolean {
  return !!(c.library || c.location || c.shelfMark || c.barcode || c.copyNumber || c.note);
}

/** Writes a copy as a bf:Item of the Instance. */
export function copyToNode(c: ItemCopy, instanceId: string): any {
  const node: any = { '@id': c.id, '@type': 'bf:Item', 'bf:itemOf': { '@id': instanceId } };
  const t = (s: string) => s.trim();
  if (t(c.library)) node['bf:heldBy'] = { '@type': 'bf:Organization', 'rdfs:label': t(c.library) };
  if (t(c.location)) node['bf:sublocation'] = { '@type': 'bf:Sublocation', 'rdfs:label': t(c.location) };
  if (t(c.shelfMark)) node['bf:shelfMark'] = { '@type': 'bf:ShelfMark', 'rdfs:label': t(c.shelfMark) };
  if (t(c.barcode)) node['bf:identifiedBy'] = [{ '@type': 'bf:Barcode', 'rdf:value': t(c.barcode) }];
  if (t(c.copyNumber)) node['bf:enumerationAndChronology'] = { '@type': 'bf:Enumeration', 'rdfs:label': `c. ${t(c.copyNumber)}` };
  if (c.referenceOnly) node['bf:usageAndAccessPolicy'] = { '@type': 'bf:UsePolicy', 'rdfs:label': REFERENCE_ONLY };
  if (t(c.note)) node['bf:note'] = { '@type': 'bf:Note', 'rdfs:label': t(c.note) };
  return node;
}

/** A new copy's URI, next to the Instance's: …/resource/instance/<id> → …/resource/item/<id>-<random>. */
export function newCopyId(instanceId: string): string {
  const tail = Math.random().toString(36).slice(2, 8);
  const m = instanceId.match(/^(.*)\/instance\/([^/#]+)$/);
  return m ? `${m[1]}/item/${m[2]}-${tail}` : `${instanceId.replace(/#.*$/, '')}#item-${tail}`;
}

export function emptyCopy(instanceId: string, like?: ItemCopy): ItemCopy {
  return {
    id: newCopyId(instanceId),
    library: like?.library || '',
    location: like?.location || '',
    shelfMark: like?.shelfMark || '',
    barcode: '',
    copyNumber: like?.copyNumber && /^\d+$/.test(like.copyNumber) ? String(Number(like.copyNumber) + 1) : '',
    referenceOnly: false,
    note: '',
  };
}
