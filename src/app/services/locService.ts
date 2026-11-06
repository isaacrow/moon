/**
 * Library of Congress API Service
 * 
 * Provides functions to search and retrieve data from various LOC APIs:
 * - Name Authority File (NAF)
 * - Subject Headings (LCSH)
 * - Geographic Names
 * - RDA Vocabularies
 * - Classification schemes
 */

import { searchAllAuthorities, linkKey } from '../../services/authoritySearch';
import { searchMoonAuthorities, type MoonAuthorityKind } from '../../services/moonAuthorities';

const LOC_BASE_URL = 'https://id.loc.gov';

const ARABIC_SCRIPT = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;

/** id.loc.gov suggest2 hits for one vocabulary; an empty list when LC cannot be reached. */
async function locSuggest(path: string, query: string, searchtype: 'keyword' | 'leftanchored' = 'keyword'): Promise<any[]> {
  try {
    const params = new URLSearchParams({ q: query.trim(), count: '15', searchtype });
    const response = await fetch(`${LOC_BASE_URL}/${path}/suggest2?${params}`, { headers: { 'Accept': 'application/json' } });
    if (!response.ok) {
      console.warn(`LOC ${path} returned`, response.status);
      return [];
    }
    const data = await response.json();
    return data.hits || [];
  } catch (error) {
    console.error(`Error searching LOC ${path}:`, error);
    return [];
  }
}

/**
 * LC's index does not match Arabic script, so Arabic queries are answered from VIAF and Wikidata
 * (which do), in the same { hits } shape as id.loc.gov.
 */
async function arabicHits(query: string, context: 'person' | 'subject' | 'place'): Promise<any[]> {
  const results = await searchAllAuthorities(query, context);
  return results.map(r => ({ uri: r.uri, aLabel: r.label, suggestLabel: r.label, source: r.source }));
}

/**
 * Moon's own entities first (one permanent address, used by every record), then LC's hits; an LC hit for
 * something a Moon entity already links to is left out, so one person or place is offered once.
 */
async function moonFirst(query: string, kind: MoonAuthorityKind, lcHits: Promise<any[]>): Promise<any[]> {
  const [moon, lc] = await Promise.all([searchMoonAuthorities(query, kind).catch(() => []), lcHits]);
  const twins = new Set(moon.flatMap((m) => m.sameAs || []).map(linkKey));
  return [
    ...moon.map((m) => ({ uri: m.uri, aLabel: m.label, suggestLabel: m.label, vLabel: m.description, source: 'Moon' })),
    ...lc.filter((h: any) => !(h?.uri && twins.has(linkKey(h.uri)))),
  ];
}

/**
 * Search LOC Name Authority File (NAF)
 * For persons, organizations, families
 */
export async function searchLocNames(query: string): Promise<any> {
  if (!query || query.trim().length < 2) return { hits: [] };
  if (ARABIC_SCRIPT.test(query)) return { hits: await arabicHits(query, 'person') };
  return { hits: await moonFirst(query, 'agent', locSuggest('authorities/names', query)) };
}

/**
 * Search LOC Subject Headings (LCSH)
 */
export async function searchLocSubjects(query: string): Promise<any> {
  if (!query || query.trim().length < 2) return { hits: [] };
  if (ARABIC_SCRIPT.test(query)) return { hits: await arabicHits(query, 'subject') };
  return { hits: await moonFirst(query, 'topic', locSuggest('authorities/subjects', query)) };
}

/**
 * Search LOC places: MARC countries and geographic areas, then name authorities (cities such as
 * "Baghdad (Iraq)" are LC name headings).
 */
export async function searchLocPlaces(query: string): Promise<any> {
  if (!query || query.trim().length < 2) return { hits: [] };
  if (ARABIC_SCRIPT.test(query)) return { hits: await arabicHits(query, 'place') };
  const [countries, areas, names] = await Promise.all([
    locSuggest('vocabulary/countries', query),
    locSuggest('vocabulary/geographicAreas', query),
    locSuggest('authorities/names', query, 'leftanchored')
  ]);
  const geographicNames = names.filter((h: any) => (h.more?.rdftypes || []).some((t: string) => /Geographic/i.test(t)));
  return { hits: await moonFirst(query, 'place', Promise.resolve([...countries, ...areas, ...geographicNames])) };
}

/**
 * Get LOC Relators (contributor roles)
 */
export async function getRelators(): Promise<any[]> {
  // Common relators - in production, this could fetch from LOC API
  return [
    { code: 'aut', uri: 'http://id.loc.gov/vocabulary/relators/aut', label: 'Author' },
    { code: 'edt', uri: 'http://id.loc.gov/vocabulary/relators/edt', label: 'Editor' },
    { code: 'trl', uri: 'http://id.loc.gov/vocabulary/relators/trl', label: 'Translator' },
    { code: 'ill', uri: 'http://id.loc.gov/vocabulary/relators/ill', label: 'Illustrator' },
    { code: 'pbl', uri: 'http://id.loc.gov/vocabulary/relators/pbl', label: 'Publisher' },
    { code: 'ctb', uri: 'http://id.loc.gov/vocabulary/relators/ctb', label: 'Contributor' },
    { code: 'com', uri: 'http://id.loc.gov/vocabulary/relators/com', label: 'Compiler' },
    { code: 'cre', uri: 'http://id.loc.gov/vocabulary/relators/cre', label: 'Creator' },
    { code: 'ann', uri: 'http://id.loc.gov/vocabulary/relators/ann', label: 'Annotator' },
    { code: 'ant', uri: 'http://id.loc.gov/vocabulary/relators/ant', label: 'Bibliographic antecedent' },
    { code: 'prf', uri: 'http://id.loc.gov/vocabulary/relators/prf', label: 'Performer' },
    { code: 'nrt', uri: 'http://id.loc.gov/vocabulary/relators/nrt', label: 'Narrator' },
  ];
}

/**
 * Get RDA Content Types
 */
export function getRdaContentTypes(): any[] {
  return [
    { uri: 'http://id.loc.gov/vocabulary/contentTypes/txt', label: 'Text', code: 'txt' },
    { uri: 'http://id.loc.gov/vocabulary/contentTypes/tct', label: 'Tactile text', code: 'tct' },
    { uri: 'http://id.loc.gov/vocabulary/contentTypes/sti', label: 'Still image', code: 'sti' },
    { uri: 'http://id.loc.gov/vocabulary/contentTypes/tdi', label: 'Two-dimensional moving image', code: 'tdi' },
    { uri: 'http://id.loc.gov/vocabulary/contentTypes/tdm', label: 'Three-dimensional moving image', code: 'tdm' },
    { uri: 'http://id.loc.gov/vocabulary/contentTypes/tdf', label: 'Three-dimensional form', code: 'tdf' },
    { uri: 'http://id.loc.gov/vocabulary/contentTypes/cri', label: 'Cartographic image', code: 'cri' },
    { uri: 'http://id.loc.gov/vocabulary/contentTypes/crm', label: 'Cartographic moving image', code: 'crm' },
    { uri: 'http://id.loc.gov/vocabulary/contentTypes/crt', label: 'Cartographic tactile image', code: 'crt' },
    { uri: 'http://id.loc.gov/vocabulary/contentTypes/crd', label: 'Cartographic three-dimensional form', code: 'crd' },
    { uri: 'http://id.loc.gov/vocabulary/contentTypes/prm', label: 'Performed music', code: 'prm' },
    { uri: 'http://id.loc.gov/vocabulary/contentTypes/ntm', label: 'Notated music', code: 'ntm' },
    { uri: 'http://id.loc.gov/vocabulary/contentTypes/spw', label: 'Spoken word', code: 'spw' },
    { uri: 'http://id.loc.gov/vocabulary/contentTypes/snd', label: 'Sounds', code: 'snd' },
    { uri: 'http://id.loc.gov/vocabulary/contentTypes/cod', label: 'Computer dataset', code: 'cod' },
    { uri: 'http://id.loc.gov/vocabulary/contentTypes/cop', label: 'Computer program', code: 'cop' },
  ];
}

/**
 * Get RDA Media Types
 */
export function getRdaMediaTypes(): any[] {
  return [
    { uri: 'http://id.loc.gov/vocabulary/mediaTypes/n', label: 'Unmediated', code: 'n' },
    { uri: 'http://id.loc.gov/vocabulary/mediaTypes/s', label: 'Audio', code: 's' },
    { uri: 'http://id.loc.gov/vocabulary/mediaTypes/c', label: 'Computer', code: 'c' },
    { uri: 'http://id.loc.gov/vocabulary/mediaTypes/h', label: 'Microform', code: 'h' },
    { uri: 'http://id.loc.gov/vocabulary/mediaTypes/p', label: 'Microscopic', code: 'p' },
    { uri: 'http://id.loc.gov/vocabulary/mediaTypes/g', label: 'Projected', code: 'g' },
    { uri: 'http://id.loc.gov/vocabulary/mediaTypes/e', label: 'Stereographic', code: 'e' },
    { uri: 'http://id.loc.gov/vocabulary/mediaTypes/v', label: 'Video', code: 'v' },
    { uri: 'http://id.loc.gov/vocabulary/mediaTypes/x', label: 'Other', code: 'x' },
    { uri: 'http://id.loc.gov/vocabulary/mediaTypes/z', label: 'Unspecified', code: 'z' },
  ];
}

/**
 * Get RDA Carrier Types
 */
export function getRdaCarrierTypes(): any[] {
  return [
    // Unmediated carriers
    { uri: 'http://id.loc.gov/vocabulary/carriers/nc', label: 'Volume', code: 'nc' },
    { uri: 'http://id.loc.gov/vocabulary/carriers/no', label: 'Sheet', code: 'no' },
    { uri: 'http://id.loc.gov/vocabulary/carriers/nr', label: 'Object', code: 'nr' },
    
    // Audio carriers
    { uri: 'http://id.loc.gov/vocabulary/carriers/sd', label: 'Audio disc', code: 'sd' },
    { uri: 'http://id.loc.gov/vocabulary/carriers/ss', label: 'Audiocassette', code: 'ss' },
    { uri: 'http://id.loc.gov/vocabulary/carriers/st', label: 'Audio cylinder', code: 'st' },
    { uri: 'http://id.loc.gov/vocabulary/carriers/sq', label: 'Audio roll', code: 'sq' },
    
    // Computer carriers
    { uri: 'http://id.loc.gov/vocabulary/carriers/cr', label: 'Online resource', code: 'cr' },
    { uri: 'http://id.loc.gov/vocabulary/carriers/cd', label: 'Computer disc', code: 'cd' },
    { uri: 'http://id.loc.gov/vocabulary/carriers/ce', label: 'Computer disc cartridge', code: 'ce' },
    { uri: 'http://id.loc.gov/vocabulary/carriers/ca', label: 'Computer tape cartridge', code: 'ca' },
    { uri: 'http://id.loc.gov/vocabulary/carriers/cb', label: 'Computer chip cartridge', code: 'cb' },
    { uri: 'http://id.loc.gov/vocabulary/carriers/ck', label: 'Computer card', code: 'ck' },
    
    // Microform carriers
    { uri: 'http://id.loc.gov/vocabulary/carriers/hd', label: 'Microfilm reel', code: 'hd' },
    { uri: 'http://id.loc.gov/vocabulary/carriers/he', label: 'Microfiche', code: 'he' },
    { uri: 'http://id.loc.gov/vocabulary/carriers/hf', label: 'Microfiche cassette', code: 'hf' },
    { uri: 'http://id.loc.gov/vocabulary/carriers/hg', label: 'Microfilm cassette', code: 'hg' },
    { uri: 'http://id.loc.gov/vocabulary/carriers/hj', label: 'Microfilm slip', code: 'hj' },
    
    // Video carriers
    { uri: 'http://id.loc.gov/vocabulary/carriers/vd', label: 'Videodisc', code: 'vd' },
    { uri: 'http://id.loc.gov/vocabulary/carriers/vf', label: 'Videocassette', code: 'vf' },
    { uri: 'http://id.loc.gov/vocabulary/carriers/vr', label: 'Videotape reel', code: 'vr' },
  ];
}
