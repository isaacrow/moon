/**
 * Which MARC subfields are filled from an authority, and from which kind: names (1XX/6XX/7XX/8XX $a),
 * works (130/240/630/730/830 $a), subjects (650 $a, 6XX $x), places (651 $a, 6XX $z, 264/260 $a), genres
 * (655 $a, 6XX $v), publishers (264/260 $b). Fields that take an authority link ($0, or $1 for a real-world
 * object such as a Wikidata item) get the picked heading's address; 264 and 260 are transcribed, so only the
 * words are offered there.
 */
import type { DataField } from './marcRecord';
import type { AuthorityResult } from '../authoritySearch';

export type AuthorityContext = 'person' | 'organization' | 'subject' | 'genre' | 'place' | 'work';
export interface AuthoritySpec {
  context: AuthorityContext;
  /** Moon entity kind a new entity is made as; none where a field takes no link. */
  entityKind?: 'agent' | 'place' | 'topic' | 'genre' | 'hub';
  agentType?: 'person' | 'organization' | 'meeting';
  /** Whether the field carries the authority's address ($0/$1). */
  linkable: boolean;
}

export function authorityFor(tag: string, code: string): AuthoritySpec | null {
  if (/^(100|600|700|800)$/.test(tag) && code === 'a') return { context: 'person', entityKind: 'agent', agentType: 'person', linkable: true };
  if (/^(110|610|710|810)$/.test(tag) && code === 'a') return { context: 'organization', entityKind: 'agent', agentType: 'organization', linkable: true };
  if (/^(111|611|711|811)$/.test(tag) && code === 'a') return { context: 'organization', entityKind: 'agent', agentType: 'meeting', linkable: true };
  if (/^(130|240|630|730|830)$/.test(tag) && code === 'a') return { context: 'work', entityKind: 'hub', linkable: true };
  if (tag === '650' && code === 'a') return { context: 'subject', entityKind: 'topic', linkable: true };
  if (tag === '651' && code === 'a') return { context: 'place', entityKind: 'place', linkable: true };
  if (tag === '655' && code === 'a') return { context: 'genre', entityKind: 'genre', linkable: true };
  if (/^6\d\d$/.test(tag) && code === 'x') return { context: 'subject', linkable: false };
  if (/^6\d\d$/.test(tag) && code === 'z') return { context: 'place', linkable: false };
  if (/^6\d\d$/.test(tag) && code === 'v') return { context: 'genre', linkable: false };
  if (/^(264|260)$/.test(tag) && code === 'a') return { context: 'place', linkable: false };
  if (/^(264|260)$/.test(tag) && code === 'b') return { context: 'organization', linkable: false };
  return null;
}

/**
 * The field after a heading is picked for subfield j: the words go in that subfield (a name's dates, as LC
 * gives them after the name, go in $d), and a linkable field gets the address in $0 (authorities) or $1
 * (Wikidata, a real-world object), replacing an earlier one from the same source.
 */
export function applyAuthority(field: DataField, j: number, picked: AuthorityResult, spec: AuthoritySpec): DataField {
  const out: DataField = { ...field, subfields: field.subfields.map((s) => [...s] as [string, string]) };
  let label = picked.label.trim();
  if (spec.context === 'person') {
    const m = label.match(/^(.*?),\s*((?:approximately\s+|active\s+|b\.\s*|d\.\s*)?\d{3,4}\??-(?:\d{3,4}\??)?)\.?$/);
    if (m) {
      label = `${m[1]},`;
      const di = out.subfields.findIndex(([c]) => c === 'd');
      if (di >= 0) out.subfields[di][1] = m[2];
      else out.subfields.splice(j + 1, 0, ['d', m[2]]);
    }
  }
  out.subfields[j][1] = label;
  if (spec.linkable && picked.uri && /^https?:\/\//.test(picked.uri)) {
    const code = /wikidata\.org/.test(picked.uri) ? '1' : '0';
    const host = (u: string) => (u.match(/^https?:\/\/([^/]+)/) || [])[1]?.replace(/^www\./, '') || '';
    const same = out.subfields.findIndex(([c, v]) => c === code && host(v) === host(picked.uri));
    if (same >= 0) out.subfields[same][1] = picked.uri;
    else out.subfields.push([code, picked.uri]);
  }
  return out;
}
