/**
 * MARC → Moon → MARC, and what did not come back (Phase 13 S17). A record goes through Moon's import
 * (marcToBibframe) and export (bibframeToMarc); each field of the original is looked for in the result:
 * - lost: no field with that tag came back;
 * - subfields lost: the field came back without one of its subfields;
 * - changed: the subfield came back with other words (punctuation and spacing aside).
 * Fields Moon makes itself (001, 003, 005, 008, 040, 336-338 …) are left out of the comparison.
 * Kept free of the browser so CI and the tests can run it.
 */
import type { DataField, MarcRecord } from './marcRecord';
import { isControl } from './marcRecord';
import { marcToBibframe } from './marcToBibframe';
import { bibframeToMarc } from './bibframeToMarc';

export interface RoundTripIssue { tag: string; kind: 'lost' | 'subfield-lost' | 'changed'; code?: string; before?: string; after?: string }

/** Tags whose content Moon rebuilds rather than carries (compared elsewhere, or system fields). */
const SKIP = /^(001|003|005|008|035|040|066|336|337|338|880|9\d\d)$/;
const norm = (s: string) => s.normalize('NFC').replace(/[\s.,:;/=+،؛]+$/u, '').replace(/^[\s[(]+|[\s\])]+$/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

export function toMoonDocument(r: MarcRecord): { '@graph': any[] } {
  const { work, instance, item } = marcToBibframe(r);
  const w = { '@id': 'https://mooon.site/resource/work/rt', ...work };
  const i = { '@id': 'https://mooon.site/resource/instance/rt', ...instance, 'bf:instanceOf': { '@id': w['@id'] } };
  const graph = [w, i];
  if (item && Object.keys(item).length > 1) graph.push({ '@id': 'https://mooon.site/resource/item/rt', ...item, 'bf:itemOf': { '@id': i['@id'] } });
  return { '@graph': graph };
}

export function roundTrip(r: MarcRecord): { back: MarcRecord; issues: RoundTripIssue[] } {
  const back = bibframeToMarc(toMoonDocument(r) as any, { recordId: 'rt' });
  const issues: RoundTripIssue[] = [];
  const out = back.fields.filter((f): f is DataField => !isControl(f));
  for (const f of r.fields) {
    if (isControl(f) || SKIP.test(f.tag)) continue;
    const same = out.filter((g) => g.tag === f.tag);
    if (!same.length) { issues.push({ tag: f.tag, kind: 'lost' }); continue; }
    // The returned field of this tag that shares most subfields with the original.
    const score = (g: DataField) => f.subfields.filter(([c, v]) => g.subfields.some(([d, w]) => d === c && norm(w) === norm(v))).length;
    const best = same.reduce((a, g) => (score(g) > score(a) ? g : a), same[0]);
    for (const [code, value] of f.subfields) {
      if (/^[0-9]$/.test(code) || !norm(value)) continue; // links and system subfields ($0 $1 $6 …) are compared elsewhere
      const there = best.subfields.filter(([c]) => c === code);
      if (!there.length) issues.push({ tag: f.tag, kind: 'subfield-lost', code, before: value });
      else if (!there.some(([, v]) => norm(v) === norm(value))) issues.push({ tag: f.tag, kind: 'changed', code, before: value, after: there[0][1] });
    }
  }
  return { back, issues };
}

/** Many records: how often each tag (or tag$code) is lost or changed, most frequent first. */
export function roundTripReport(records: MarcRecord[]): { records: number; clean: number; counts: Array<[string, number]> } {
  const counts = new Map<string, number>();
  let clean = 0;
  for (const r of records) {
    let issues: RoundTripIssue[];
    try { issues = roundTrip(r).issues; } catch { issues = [{ tag: '*', kind: 'lost' }]; }
    if (!issues.length) clean++;
    for (const k of new Set(issues.map((i) => `${i.kind} ${i.tag}${i.code ? '$' + i.code : ''}`))) counts.set(k, (counts.get(k) || 0) + 1);
  }
  return { records: records.length, clean, counts: [...counts.entries()].sort((a, b) => b[1] - a[1]) };
}
