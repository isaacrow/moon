/**
 * BIBFRAME Hub Service
 * Implements BIBFRAME Primer Appendix A ("More about Hubs") and Marva Hubs:
 * - Hubs are collocation and aggregation resources (functional equivalent of MARC Title/NameTitle 1XX+$t/130/240/830)
 * - Authorized Access Point (bflc:aap) & Normalized AAP (bflc:aap-normalized)
 * - Hub Stub creation directly from Work
 * - Hub Expression linking
 */
import { moonFetch } from '../app/utils/moonApi';

export interface BibframeHub {
  id: string;
  uri: string;
  title: string;
  creator?: string;
  creatorUri?: string;
  keyOrOpus?: string;
  mediumOfPerformance?: string;
  language?: string;
  aap: string;
  aapNormalized: string;
  expressionOf?: string;
  originDate?: string;
  historyNote?: string;
  createdDate: string;
  /** Where the hub lives: Moon's authority file or LC's id.loc.gov. */
  source?: 'Moon' | 'LC';
}

/**
 * Generate Authorized Access Point (bflc:aap) according to LC/PCC conventions:
 * Format: [Creator].[Title] [Medium] [Key/Opus] ([Language])
 */
export function generateHubAAP(data: {
  title: string;
  creator?: string;
  keyOrOpus?: string;
  mediumOfPerformance?: string;
  language?: string;
}): string {
  let aap = '';
  if (data.creator && data.creator.trim()) {
    aap += `${data.creator.trim().replace(/\.$/, '')}. `;
  }
  aap += data.title ? data.title.trim() : 'Untitled Hub';

  if (data.mediumOfPerformance && data.mediumOfPerformance.trim()) {
    aap += `, ${data.mediumOfPerformance.trim()}`;
  }
  if (data.keyOrOpus && data.keyOrOpus.trim()) {
    aap += `, ${data.keyOrOpus.trim()}`;
  }
  if (data.language && data.language.trim() && data.language.toLowerCase() !== 'eng' && data.language.toLowerCase() !== 'english') {
    aap += `. ${data.language.trim()}`;
  }

  return aap;
}

/**
 * Generate normalized AAP (bflc:aap-normalized):
 * Lowercase, stripped punctuation, single spaces
 */
export function normalizeAAP(aap: string): string {
  if (!aap) return '';
  return aap
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents for normalization
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Real hubs: Moon's own (server authority file, kind "hub") and LC's (id.loc.gov/resources/hubs) ──

interface MoonHubEntry {
  id: string;
  uri: string;
  label: string;
  sameAs: string[];
  data: Record<string, any>;
  createdAt?: string;
}

function fromMoonEntry(a: MoonHubEntry): BibframeHub {
  return {
    id: a.id,
    uri: a.uri,
    title: a.data?.title || a.label,
    creator: a.data?.creator || undefined,
    creatorUri: a.data?.creatorUri || undefined,
    keyOrOpus: a.data?.keyOrOpus || undefined,
    language: a.data?.language || undefined,
    aap: a.label,
    aapNormalized: normalizeAAP(a.label),
    expressionOf: a.sameAs?.find((s) => s.includes('id.loc.gov/resources/hubs/')),
    createdDate: a.createdAt || '',
    source: 'Moon',
  };
}

/** Moon's own hubs whose access point matches every word (Arabic spellings folded). Never throws. */
export async function searchMoonHubs(query: string): Promise<BibframeHub[]> {
  try {
    const params = new URLSearchParams({ q: query, kind: 'hub', limit: '20' });
    const { ok, data } = await moonFetch<{ authorities: MoonHubEntry[] }>(`/authorities?${params}`);
    return ok && Array.isArray(data?.authorities) ? data.authorities.map(fromMoonEntry) : [];
  } catch {
    return [];
  }
}

/** LC's hubs (id.loc.gov), searched from the start of the access point. Never throws. */
export async function searchLcHubs(query: string): Promise<BibframeHub[]> {
  if (query.trim().length < 2) return [];
  try {
    const url = `https://id.loc.gov/resources/hubs/suggest2/?q=${encodeURIComponent(query.trim())}&count=15`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const json = await res.json();
    return (Array.isArray(json?.hits) ? json.hits : []).map((h: any): BibframeHub => {
      const aap: string = h.aLabel || h.suggestLabel || '';
      const creator: string | undefined = h.more?.contributors?.[0];
      const title = creator && aap.startsWith(creator) ? aap.slice(creator.length).replace(/^[.\s]+/, '') : aap;
      return {
        id: h.token || h.uri,
        uri: h.uri,
        title: title || aap,
        creator,
        aap,
        aapNormalized: normalizeAAP(aap),
        createdDate: h.more?.lastmods?.[0] || '',
        source: 'LC',
      };
    });
  } catch {
    return [];
  }
}

/** Moon's hubs first, then LC's. */
export async function searchHubs(query: string): Promise<BibframeHub[]> {
  const [moon, lc] = await Promise.all([searchMoonHubs(query), searchLcHubs(query)]);
  return [...moon, ...lc];
}

/**
 * Saves a new hub in Moon's authority file, which gives it a permanent https://mooon.site/resource/hub/<id>
 * address. A hub with the same access point (any Arabic spelling) is returned instead of a duplicate.
 */
export async function saveMoonHub(input: {
  title: string; creator?: string; creatorUri?: string; keyOrOpus?: string; language?: string; lcHubUri?: string;
}): Promise<{ ok: true; existing: boolean; hub: BibframeHub } | { ok: false; status: number; error: string }> {
  const aap = generateHubAAP(input);
  const data: Record<string, string> = { title: input.title.trim() };
  for (const k of ['creator', 'creatorUri', 'keyOrOpus', 'language'] as const) {
    if (input[k]?.trim()) data[k] = input[k]!.trim();
  }
  try {
    const { ok, status, data: res } = await moonFetch('/authorities', {
      body: { kind: 'hub', label: aap, sameAs: input.lcHubUri ? [input.lcHubUri] : [], data },
    });
    if (!ok) return { ok: false, status, error: res?.error || `HTTP ${status}` };
    return { ok: true, existing: !!res.existing, hub: fromMoonEntry(res.authority) };
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : String(e) };
  }
}
