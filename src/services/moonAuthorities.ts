/**
 * Moon's local authority file on the server: people, organizations, places and topics that LC and
 * VIAF may not have, each with a permanent https://mooon.site/resource/<kind>/<id> address.
 */
import { moonFetch } from '../app/utils/moonApi';
import type { AuthorityResult } from './authoritySearch';
import type { AISuggestionProfile } from './authorFinderService';

export type MoonAuthorityKind = 'agent' | 'place' | 'topic';

export interface MoonAuthority {
  id: string;
  kind: MoonAuthorityKind;
  uri: string;
  label: string;
  variants: string[];
  sameAs: string[];
  note?: string | null;
  data: Record<string, unknown>;
  createdBy?: string | null;
}

/** Entries matching every word of the query, as editor search results. Never throws. */
export async function searchMoonAuthorities(query: string, kind: MoonAuthorityKind): Promise<AuthorityResult[]> {
  if (!query.trim()) return [];
  try {
    const params = new URLSearchParams({ q: query, kind, limit: '10' });
    const { ok, data } = await moonFetch<{ authorities: MoonAuthority[] }>(`/authorities?${params}`);
    if (!ok || !Array.isArray(data?.authorities)) return [];
    return data.authorities.map((a) => ({
      label: a.label,
      uri: a.uri,
      source: 'Moon' as const,
      type: kind,
      description: [a.variants.slice(0, 2).join(' · '), [a.data?.birthDate, a.data?.deathDate].filter(Boolean).join('–')]
        .filter(Boolean).join(' — ') || undefined,
    }));
  } catch {
    return [];
  }
}

/** The LC / VIAF / Wikidata addresses an Author Finder profile knows for the person. */
function sameAsLinks(p: AISuggestionProfile): string[] {
  const links = new Set<string>();
  const id = (v?: string) => (v || '').trim().split('/').filter(Boolean).pop() || '';
  if (id(p.locId)) links.add(`http://id.loc.gov/authorities/names/${id(p.locId)}`);
  if (/^\d+$/.test(id(p.viafId))) links.add(`https://viaf.org/viaf/${id(p.viafId)}`);
  if (/^Q\d+$/i.test(id(p.wikidataId))) links.add(`http://www.wikidata.org/entity/${id(p.wikidataId).toUpperCase()}`);
  (p.authorities || []).forEach((a) => { if (a.uri && /^https?:\/\//.test(a.uri)) links.add(a.uri); });
  return [...links];
}

/**
 * Saves an Author Finder profile into the local authority file. When an entry with this name already
 * exists (any Arabic spelling), that entry is returned instead (existing = true).
 */
export async function saveProfileAsMoonAuthority(p: AISuggestionProfile): Promise<
  { ok: true; existing: boolean; authority: MoonAuthority } | { ok: false; status: number; error: string }
> {
  const label = (p.suggestedNameArabic || p.primarySuggestion || '').trim();
  const variants = [p.suggestedNameEnglish, p.primarySuggestion, p.normalizedAuthorName, p.kunyaAndLaqab]
    .filter((v): v is string => !!v && !!v.trim() && v.trim() !== label);
  const data: Record<string, unknown> = { agentType: 'person', source: 'author-finder' };
  for (const k of ['birthDate', 'deathDate', 'hijriDates', 'nationality', 'occupation', 'birthCity', 'affiliation', 'summaryEn'] as const) {
    if (p[k]) data[k] = p[k];
  }
  try {
    const { ok, status, data: res } = await moonFetch('/authorities', {
      body: { kind: 'agent', label, variants, sameAs: sameAsLinks(p), note: p.summaryAr || undefined, data },
    });
    if (!ok) return { ok: false, status, error: res?.error || `HTTP ${status}` };
    return { ok: true, existing: !!res.existing, authority: res.authority };
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : String(e) };
  }
}
