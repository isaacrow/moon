/**
 * More authority sources for the editor's search boxes:
 * - FAST (OCLC's faceted LCSH): topical and geographic subject headings with id.worldcat.org/fast URIs;
 * - ORCID: researchers, with orcid.org URIs (many Iraqi academics have one);
 * - ISNI: international name identifiers (LC and national libraries use them), searched through Moon's server.
 * FAST and ORCID allow calls from the browser; the fetch function is a parameter so tests need no network.
 */
import type { AuthorityResult } from './authoritySearch';
import { moonFetch } from '../app/utils/moonApi';

type Fetch = typeof fetch;

/** FAST suggest: one result per heading (its alternative forms only explain why it matched). */
export function parseFast(json: any, type: string): AuthorityResult[] {
  const seen = new Map<string, AuthorityResult>();
  for (const d of json?.response?.docs || []) {
    const root = String((d.idroot || [])[0] || '');
    const num = root.replace(/^fst0*/, '');
    if (!/^\d+$/.test(num) || seen.has(num)) continue;
    const matched = (d.suggestall || [])[0];
    seen.set(num, {
      label: d.auth,
      uri: `http://id.worldcat.org/fast/${num}`,
      source: 'FAST',
      type,
      ...(d.type === 'alt' && matched && matched !== d.auth ? { description: `${matched} → ${d.auth}` } : {}),
    });
  }
  return [...seen.values()];
}

export async function searchFAST(query: string, kind: 'topic' | 'place', fetchImpl: Fetch = fetch): Promise<AuthorityResult[]> {
  if (query.trim().length < 2) return [];
  const params = new URLSearchParams({
    query, queryIndex: kind === 'place' ? 'suggest51' : 'suggestall', queryReturn: 'suggestall,idroot,auth,type',
    // suggest51 is FAST's geographic index; the suggester is autoSubject for every index (checked live).
    suggest: 'autoSubject', rows: '10', wt: 'json',
  });
  try {
    const res = await fetchImpl(`https://fast.oclc.org/searchfast/fastsuggest?${params}`);
    return res.ok ? parseFast(await res.json(), kind === 'place' ? 'Place' : 'Topic') : [];
  } catch {
    return [];
  }
}

/** ORCID expanded search: "Family, Given" (or the credit name), with institutions as the description. */
export function parseOrcid(json: any): AuthorityResult[] {
  return (json?.['expanded-result'] || []).filter((r: any) => /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(r['orcid-id'] || '')).map((r: any) => ({
    label: r['credit-name'] || [r['family-names'], r['given-names']].filter(Boolean).join(', ') || r['orcid-id'],
    uri: `https://orcid.org/${r['orcid-id']}`,
    source: 'ORCID' as const,
    type: 'Person',
    ...((r['institution-name'] || []).length ? { description: r['institution-name'].slice(0, 2).join(' · ') } : {}),
  }));
}

export async function searchORCID(query: string, fetchImpl: Fetch = fetch): Promise<AuthorityResult[]> {
  if (query.trim().length < 3) return [];
  try {
    const res = await fetchImpl(`https://pub.orcid.org/v3.0/expanded-search/?${new URLSearchParams({ q: query, rows: '8' })}`, {
      headers: { Accept: 'application/json' },
    });
    return res.ok ? parseOrcid(await res.json()) : [];
  } catch {
    return [];
  }
}

export async function searchISNI(query: string): Promise<AuthorityResult[]> {
  if (query.trim().length < 2) return [];
  try {
    const { ok, data } = await moonFetch<{ names: { uri: string; label: string; dates?: string; sources: string[] }[] }>(
      `/isni/search?${new URLSearchParams({ q: query })}`);
    return ok ? (data.names || []).map((n) => ({
      label: n.dates ? `${n.label}, ${n.dates}` : n.label,
      uri: n.uri,
      source: 'ISNI' as const,
      type: 'Person',
      ...(n.sources.length ? { description: `ISNI · ${n.sources.slice(0, 3).join(', ')}` } : {}),
    })) : [];
  } catch {
    return [];
  }
}
