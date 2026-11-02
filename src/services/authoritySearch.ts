/**
 * Authority Search Service
 * Integrates with LOC, VIAF, and Wikidata APIs
 * Provides unified authority search for cataloging
 */

export interface AuthorityResult {
  label: string;
  uri: string;
  source: 'LOC' | 'VIAF' | 'Wikidata' | 'Local';
  type?: string;
  description?: string;
}

export type LOCScheme =
  | 'names' | 'subjects' | 'genreForms' | 'geographicAreas' | 'languages' | 'countries'
  | 'organizations' | 'contentTypes' | 'carriers' | 'mediaTypes' | 'relators' | 'works' | 'instances';

const LOC_SCHEME_PATHS: Record<LOCScheme, string> = {
  names: 'authorities/names',
  subjects: 'authorities/subjects',
  genreForms: 'authorities/genreForms',
  geographicAreas: 'vocabulary/geographicAreas',
  languages: 'vocabulary/languages',
  countries: 'vocabulary/countries',
  organizations: 'vocabulary/organizations',
  contentTypes: 'vocabulary/contentTypes',
  carriers: 'vocabulary/carriers',
  mediaTypes: 'vocabulary/mediaTypes',
  relators: 'vocabulary/relators',
  works: 'resources/works',
  instances: 'resources/instances'
};

const ARABIC_SCRIPT = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;

/**
 * Search LOC authorities and vocabularies with id.loc.gov's suggest2 service.
 * LC's index does not match Arabic script (it returns unrelated headings), so Arabic queries are left to
 * VIAF and Wikidata, which do.
 */
export async function searchLOCAuthorities(query: string, scheme: LOCScheme): Promise<AuthorityResult[]> {
  if (!query || query.trim().length < 2 || ARABIC_SCRIPT.test(query)) return [];

  try {
    const params = new URLSearchParams({ q: query.trim(), count: '15', searchtype: 'keyword' });
    const response = await fetch(`https://id.loc.gov/${LOC_SCHEME_PATHS[scheme]}/suggest2?${params}`);
    if (!response.ok) throw new Error('LOC API error');

    const data = await response.json();
    return (data.hits || []).map((hit: any) => ({
      label: hit.aLabel || hit.suggestLabel || '',
      uri: hit.uri || '',
      source: 'LOC' as const,
      type: (hit.more?.rdftypes || [])[0],
      description: hit.vLabel && hit.vLabel !== hit.aLabel ? hit.vLabel : undefined
    })).filter((r: AuthorityResult) => r.label && r.uri);
  } catch (error) {
    console.error('LOC search error:', error);
    return [];
  }
}

/**
 * Search VIAF for persons and organizations
 */
export async function searchVIAF(query: string): Promise<AuthorityResult[]> {
  if (!query || query.length < 2) return [];

  try {
    // Use viaf.org (without www) — the AutoSuggest endpoint supports CORS
    const url = `https://viaf.org/viaf/AutoSuggest?query=${encodeURIComponent(query)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });
    clearTimeout(timeout);
    if (!response.ok) throw new Error('VIAF API error');

    const data = await response.json();
    
    return (data.result || []).map((item: any) => ({
      label: item.term || item.displayForm || 'Unknown',
      uri: `https://viaf.org/viaf/${item.viafid || item.recordID || ''}`,
      source: 'VIAF' as const,
      type: item.nametype === 'corporate' ? 'Organization' : 'Person',
      description: item.displayForm || ''
    })).filter((r: AuthorityResult) => r.uri && !r.uri.endsWith('/'));
  } catch (error) {
    console.error('VIAF search error:', error);
    return [];
  }
}

/**
 * Search Wikidata
 */
export async function searchWikidata(query: string, type?: string): Promise<AuthorityResult[]> {
  if (!query || query.length < 2) return [];

  try {
    const url = `https://www.wikidata.org/w/api.php`;
    // Arabic queries match and show Arabic labels; others English.
    const lang = ARABIC_SCRIPT.test(query) ? 'ar' : 'en';
    const params = new URLSearchParams({
      action: 'wbsearchentities',
      search: query,
      language: lang,
      uselang: lang,
      format: 'json',
      origin: '*'
    });

    if (type) params.append('type', type);

    const response = await fetch(`${url}?${params}`);
    if (!response.ok) throw new Error('Wikidata API error');

    const data = await response.json();
    
    return data.search?.map((item: any) => ({
      label: item.label,
      uri: `http://www.wikidata.org/entity/${item.id}`,
      source: 'Wikidata' as const,
      description: item.description
    })) || [];
  } catch (error) {
    console.error('Wikidata search error:', error);
    return [];
  }
}

/**
 * Combined authority search across all sources
 */
export async function searchAllAuthorities(
  query: string,
  context: 'person' | 'organization' | 'subject' | 'genre' | 'place' | 'language' | 'holder' | 'work'
): Promise<AuthorityResult[]> {
  const results: AuthorityResult[] = [];

  try {
    // Parallel search across sources
    const searches: Promise<AuthorityResult[]>[] = [];

    switch (context) {
      case 'person':
      case 'organization':
        searches.push(searchLOCAuthorities(query, 'names'));
        searches.push(searchVIAF(query));
        searches.push(searchWikidata(query, 'item'));
        break;

      case 'holder':
        // Holding institutions: MARC organization codes first, then name authorities.
        searches.push(searchLOCAuthorities(query, 'organizations'));
        searches.push(searchLOCAuthorities(query, 'names'));
        searches.push(searchWikidata(query, 'item'));
        break;

      case 'subject':
        searches.push(searchLOCAuthorities(query, 'subjects'));
        searches.push(searchWikidata(query, 'item'));
        break;

      case 'genre':
        searches.push(searchLOCAuthorities(query, 'genreForms'));
        searches.push(searchWikidata(query, 'item'));
        break;

      case 'place':
        searches.push(searchLOCAuthorities(query, 'countries'));
        searches.push(searchLOCAuthorities(query, 'geographicAreas'));
        searches.push(searchWikidata(query, 'item'));
        break;

      case 'language':
        searches.push(searchLOCAuthorities(query, 'languages'));
        break;

      case 'work':
        // Related works and instances: LC's BIBFRAME resources, then Wikidata.
        searches.push(searchLOCAuthorities(query, 'works'));
        searches.push(searchWikidata(query, 'item'));
        break;
    }

    const allResults = await Promise.all(searches);
    allResults.forEach(sourceResults => results.push(...sourceResults));

    // Deduplicate by label and by URI (VIAF returns several name forms of one person)
    const seen = new Set<string>();
    const seenUris = new Set<string>();
    return results.filter(r => {
      if (!r.label) return false;
      const labelLower = r.label.toLowerCase();
      if (seen.has(labelLower) || (r.uri && seenUris.has(r.uri))) return false;
      seen.add(labelLower);
      if (r.uri) seenUris.add(r.uri);
      return true;
    });
  } catch (error) {
    console.error('Authority search error:', error);
    return [];
  }
}

/**
 * Search LOC Languages
 */
export async function searchLanguages(query: string): Promise<AuthorityResult[]> {
  // Common languages (fallback for offline)
  const commonLanguages: AuthorityResult[] = [
    { label: 'English', uri: 'http://id.loc.gov/vocabulary/languages/eng', source: 'LOC' },
    { label: 'Spanish', uri: 'http://id.loc.gov/vocabulary/languages/spa', source: 'LOC' },
    { label: 'French', uri: 'http://id.loc.gov/vocabulary/languages/fre', source: 'LOC' },
    { label: 'German', uri: 'http://id.loc.gov/vocabulary/languages/ger', source: 'LOC' },
    { label: 'Italian', uri: 'http://id.loc.gov/vocabulary/languages/ita', source: 'LOC' },
    { label: 'Arabic', uri: 'http://id.loc.gov/vocabulary/languages/ara', source: 'LOC' },
    { label: 'Chinese', uri: 'http://id.loc.gov/vocabulary/languages/chi', source: 'LOC' },
    { label: 'Japanese', uri: 'http://id.loc.gov/vocabulary/languages/jpn', source: 'LOC' },
    { label: 'Russian', uri: 'http://id.loc.gov/vocabulary/languages/rus', source: 'LOC' },
    { label: 'Portuguese', uri: 'http://id.loc.gov/vocabulary/languages/por', source: 'LOC' },
  ];

  if (!query) return commonLanguages;

  const filtered = commonLanguages.filter(l => 
    l.label && query && l.label.toLowerCase().includes(query.toLowerCase())
  );

  // Try LOC API if query is specific
  if (query.length >= 2) {
    try {
      const locResults = await searchLOCAuthorities(query, 'languages');
      return [...locResults, ...filtered];
    } catch {
      return filtered;
    }
  }

  return filtered;
}

/**
 * Search LOC Carriers
 */
export async function searchCarriers(query: string): Promise<AuthorityResult[]> {
  const commonCarriers: AuthorityResult[] = [
    { label: 'volume (print)', uri: 'http://id.loc.gov/vocabulary/carriers/nc', source: 'LOC' },
    { label: 'online resource', uri: 'http://id.loc.gov/vocabulary/carriers/cr', source: 'LOC' },
    { label: 'computer disc', uri: 'http://id.loc.gov/vocabulary/carriers/cd', source: 'LOC' },
    { label: 'audio disc', uri: 'http://id.loc.gov/vocabulary/carriers/sd', source: 'LOC' },
    { label: 'videodisc', uri: 'http://id.loc.gov/vocabulary/carriers/vd', source: 'LOC' },
    { label: 'microfilm reel', uri: 'http://id.loc.gov/vocabulary/carriers/hd', source: 'LOC' },
  ];

  if (!query) return commonCarriers;

  return commonCarriers.filter(c => 
    c.label && query && c.label.toLowerCase().includes(query.toLowerCase())
  );
}

/**
 * Search LOC Media Types
 */
export async function searchMediaTypes(query: string): Promise<AuthorityResult[]> {
  const commonMedia: AuthorityResult[] = [
    { label: 'unmediated', uri: 'http://id.loc.gov/vocabulary/mediaTypes/n', source: 'LOC' },
    { label: 'computer', uri: 'http://id.loc.gov/vocabulary/mediaTypes/c', source: 'LOC' },
    { label: 'audio', uri: 'http://id.loc.gov/vocabulary/mediaTypes/s', source: 'LOC' },
    { label: 'video', uri: 'http://id.loc.gov/vocabulary/mediaTypes/v', source: 'LOC' },
    { label: 'microform', uri: 'http://id.loc.gov/vocabulary/mediaTypes/h', source: 'LOC' },
  ];

  if (!query) return commonMedia;

  return commonMedia.filter(m => 
    m.label && query && m.label.toLowerCase().includes(query.toLowerCase())
  );
}

/**
 * Search LOC Countries
 */
export async function searchCountries(query: string): Promise<AuthorityResult[]> {
  const commonCountries: AuthorityResult[] = [
    { label: 'United States', uri: 'http://id.loc.gov/vocabulary/countries/xxu', source: 'LOC' },
    { label: 'United Kingdom', uri: 'http://id.loc.gov/vocabulary/countries/xxk', source: 'LOC' },
    { label: 'Canada', uri: 'http://id.loc.gov/vocabulary/countries/xxc', source: 'LOC' },
    { label: 'France', uri: 'http://id.loc.gov/vocabulary/countries/fr', source: 'LOC' },
    { label: 'Germany', uri: 'http://id.loc.gov/vocabulary/countries/gw', source: 'LOC' },
    { label: 'Spain', uri: 'http://id.loc.gov/vocabulary/countries/sp', source: 'LOC' },
    { label: 'Italy', uri: 'http://id.loc.gov/vocabulary/countries/it', source: 'LOC' },
    { label: 'Japan', uri: 'http://id.loc.gov/vocabulary/countries/ja', source: 'LOC' },
    { label: 'China', uri: 'http://id.loc.gov/vocabulary/countries/cc', source: 'LOC' },
    { label: 'Australia', uri: 'http://id.loc.gov/vocabulary/countries/at', source: 'LOC' },
  ];

  if (!query) return commonCountries;

  return commonCountries.filter(c => 
    c.label && query && c.label.toLowerCase().includes(query.toLowerCase())
  );
}

/**
 * LOC Relators (common roles)
 */
export const COMMON_RELATORS = [
  { code: 'aut', label: 'Author', uri: 'http://id.loc.gov/vocabulary/relators/aut' },
  { code: 'edt', label: 'Editor', uri: 'http://id.loc.gov/vocabulary/relators/edt' },
  { code: 'trl', label: 'Translator', uri: 'http://id.loc.gov/vocabulary/relators/trl' },
  { code: 'ill', label: 'Illustrator', uri: 'http://id.loc.gov/vocabulary/relators/ill' },
  { code: 'pbl', label: 'Publisher', uri: 'http://id.loc.gov/vocabulary/relators/pbl' },
  { code: 'ctb', label: 'Contributor', uri: 'http://id.loc.gov/vocabulary/relators/ctb' },
  { code: 'cre', label: 'Creator', uri: 'http://id.loc.gov/vocabulary/relators/cre' },
  { code: 'com', label: 'Compiler', uri: 'http://id.loc.gov/vocabulary/relators/com' },
  { code: 'pht', label: 'Photographer', uri: 'http://id.loc.gov/vocabulary/relators/pht' },
  { code: 'nrt', label: 'Narrator', uri: 'http://id.loc.gov/vocabulary/relators/nrt' },
  { code: 'drt', label: 'Director', uri: 'http://id.loc.gov/vocabulary/relators/drt' },
];

export function searchRelators(query: string) {
  if (!query) return COMMON_RELATORS;
  
  return COMMON_RELATORS.filter(r => {
    if (!query) return true;
    const queryLower = query.toLowerCase();
    return (r.label && r.label.toLowerCase().includes(queryLower)) ||
           (r.code && r.code.toLowerCase().includes(queryLower));
  });
}

/**
 * ISBN Lookup using Open Library API
 */
export interface ISBNData {
  title?: string;
  subtitle?: string;
  authors?: string[];
  publishers?: string[];
  publishDate?: string;
  numberOfPages?: number;
  isbn10?: string;
  isbn13?: string;
}

export async function lookupISBN(isbn: string): Promise<ISBNData | null> {
  try {
    // Clean ISBN
    const cleanISBN = isbn.replace(/[-\s]/g, '');
    
    // Try Open Library
    const response = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${cleanISBN}&format=json&jscmd=data`);
    if (!response.ok) return null;

    const data = await response.json();
    const bookData = data[`ISBN:${cleanISBN}`];
    
    if (!bookData) return null;

    return {
      title: bookData.title,
      subtitle: bookData.subtitle,
      authors: bookData.authors?.map((a: any) => a.name) || [],
      publishers: bookData.publishers?.map((p: any) => p.name) || [],
      publishDate: bookData.publish_date,
      numberOfPages: bookData.number_of_pages,
      isbn10: bookData.identifiers?.isbn_10?.[0],
      isbn13: bookData.identifiers?.isbn_13?.[0],
    };
  } catch (error) {
    console.error('ISBN lookup error:', error);
    return null;
  }
}

// Every URI below was checked against id.loc.gov (each returns 200). Where LC publishes no vocabulary,
// the option has no URI and is exported as a labelled node instead of a link to a page that does not exist.

const filterOptions = (options: Array<{ label: string; labelAr?: string; uri: string }>, query: string, type: string): AuthorityResult[] => {
  const q = (query || '').toLowerCase();
  return options
    .filter(opt => opt.label.toLowerCase().includes(q) || (opt.labelAr || '').includes(query || ''))
    .map(opt => ({ label: opt.label, uri: opt.uri, type, source: (opt.uri ? 'LOC' : 'Local') as AuthorityResult['source'] }));
};

/**
 * Search for Accessibility Content (bf:contentAccessibility). LC has no vocabulary for this, so values are labels.
 */
export async function searchAccessibilityContent(query: string): Promise<AuthorityResult[]> {
  return filterOptions([
    { label: 'Large print', labelAr: 'طباعة بحروف كبيرة', uri: '' },
    { label: 'Braille', labelAr: 'برايل', uri: '' },
    { label: 'Audio description', labelAr: 'وصف صوتي', uri: '' },
    { label: 'Captions', labelAr: 'ترجمة نصية', uri: '' },
    { label: 'Sign language', labelAr: 'لغة الإشارة', uri: '' },
    { label: 'Tactile graphics', labelAr: 'رسوم لمسية', uri: '' },
    { label: 'Screen reader compatible', labelAr: 'متوافق مع قارئ الشاشة', uri: '' },
    { label: 'High contrast', labelAr: 'تباين عالٍ', uri: '' },
    { label: 'Accessible PDF', labelAr: 'PDF ميسّر', uri: '' }
  ], query, 'accessibilityContent');
}

/**
 * Search for Notation (bf:notation): scripts (LC "mscript") and tactile notations (LC "mtactile").
 */
export async function searchNotationTypes(query: string): Promise<AuthorityResult[]> {
  return filterOptions([
    { label: 'Arabic script', labelAr: 'الخط العربي', uri: 'http://id.loc.gov/vocabulary/mscript/f' },
    { label: 'Latin script', labelAr: 'الخط اللاتيني', uri: 'http://id.loc.gov/vocabulary/mscript/a' },
    { label: 'Extended Latin script', labelAr: 'اللاتيني الموسع', uri: 'http://id.loc.gov/vocabulary/mscript/b' },
    { label: 'Hebrew script', labelAr: 'الخط العبري', uri: 'http://id.loc.gov/vocabulary/mscript/h' },
    { label: 'Cyrillic script', labelAr: 'الخط السيريلي', uri: 'http://id.loc.gov/vocabulary/mscript/c' },
    { label: 'Greek script', labelAr: 'الخط اليوناني', uri: 'http://id.loc.gov/vocabulary/mscript/g' },
    { label: 'Braille code', labelAr: 'رموز برايل', uri: 'http://id.loc.gov/vocabulary/mtactile/brail' },
    { label: 'Mathematics braille code', labelAr: 'برايل للرياضيات', uri: 'http://id.loc.gov/vocabulary/mtactile/math' },
    { label: 'Music braille code', labelAr: 'برايل للموسيقى', uri: 'http://id.loc.gov/vocabulary/mtactile/music' },
    { label: 'Tactile graphic', labelAr: 'رسم لمسي', uri: 'http://id.loc.gov/vocabulary/mtactile/graph' },
    { label: 'Moon code', labelAr: 'رموز مون', uri: 'http://id.loc.gov/vocabulary/mtactile/moon' }
  ], query, 'notation');
}

/**
 * Search for Government Publication types (LC "mgovtpubtype").
 * "Not a government publication" has no code in MARC or LC; leave the field empty instead.
 */
export async function searchGovernmentPub(query: string): Promise<AuthorityResult[]> {
  return filterOptions([
    { label: 'Federal/national', labelAr: 'وطني / اتحادي', uri: 'http://id.loc.gov/vocabulary/mgovtpubtype/f' },
    { label: 'State, provincial, territorial', labelAr: 'محافظة / إقليم', uri: 'http://id.loc.gov/vocabulary/mgovtpubtype/s' },
    { label: 'Multistate', labelAr: 'عدة محافظات', uri: 'http://id.loc.gov/vocabulary/mgovtpubtype/m' },
    { label: 'Local', labelAr: 'محلي', uri: 'http://id.loc.gov/vocabulary/mgovtpubtype/l' },
    { label: 'Multilocal', labelAr: 'عدة جهات محلية', uri: 'http://id.loc.gov/vocabulary/mgovtpubtype/c' },
    { label: 'Autonomous', labelAr: 'ذاتي الحكم', uri: 'http://id.loc.gov/vocabulary/mgovtpubtype/a' },
    { label: 'International intergovernmental', labelAr: 'دولي حكومي', uri: 'http://id.loc.gov/vocabulary/mgovtpubtype/i' },
    { label: 'Government (level undetermined)', labelAr: 'حكومي (المستوى غير محدد)', uri: 'http://id.loc.gov/vocabulary/mgovtpubtype/g' }
  ], query, 'governmentPublication');
}

/**
 * Search for Description Authentication codes (LC "marcauthen").
 */
export async function searchDescriptionAuth(query: string): Promise<AuthorityResult[]> {
  return filterOptions([
    { label: 'PCC (Program for Cooperative Cataloging)', uri: 'http://id.loc.gov/vocabulary/marcauthen/pcc' },
    { label: 'NSDP (National Serials Data Program)', uri: 'http://id.loc.gov/vocabulary/marcauthen/nsdp' },
    { label: 'LC (Library of Congress)', uri: 'http://id.loc.gov/vocabulary/marcauthen/lc' },
    { label: 'MSC (Monographic Series Control)', uri: 'http://id.loc.gov/vocabulary/marcauthen/msc' }
  ], query, 'authentication');
}
