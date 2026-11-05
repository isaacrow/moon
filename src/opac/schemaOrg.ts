/**
 * schema.org markup for a record page in the OPAC, so search engines understand it as a book:
 * title, authors (with their VIAF / LC links), language, subjects, publisher, date, ISBN, pages,
 * summary and cover, and its permanent linked-data address (mooon.site/resource/work/<id>).
 */

export const SITE = 'https://mooon.site';
export const RESOURCE_BASE = `${SITE}/resource`;

/** MARC (ISO 639-2) language codes as the BCP 47 tags schema.org expects; others are kept as they are. */
const LANGUAGES: Record<string, string> = {
  ara: 'ar', eng: 'en', per: 'fa', fas: 'fa', fre: 'fr', fra: 'fr', ger: 'de', deu: 'de', tur: 'tr', urd: 'ur',
  heb: 'he', kur: 'ku', spa: 'es', ita: 'it', rus: 'ru', lat: 'la', syr: 'syr', ota: 'ota',
};

export function languageTag(code: string | undefined): string | undefined {
  const c = String(code || '').trim().toLowerCase().replace(/^.*\//, '');
  if (!c || c === 'und' || c === 'zxx') return undefined;
  return LANGUAGES[c] || c;
}

/** The number of pages in an extent such as "320 p.", "xii, 320 pages" or "٣٢٠ صفحة". */
export function pageCount(extent: string | undefined): number | undefined {
  const s = String(extent || '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  const m = s.match(/(\d+)\s*(?:p\b|pp\b|pages?\b|ص\b|صفحة|صفحات|ص\.)/i);
  const n = m ? Number(m[1]) : NaN;
  return n > 0 && n < 100000 ? n : undefined;
}

/** A four-digit year from a date such as "2020", "c2020", "[2020?]" or "1441 هـ / 2020 م". */
export function year(date: string | undefined): string | undefined {
  const s = String(date || '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  const all = s.match(/(?<!\d)(1[5-9]\d\d|20\d\d)(?!\d)/g);
  return all ? all[all.length - 1] : undefined;
}

export function pageUrl(workId: string): string {
  return `${SITE}/opac.html?work=${encodeURIComponent(workId)}`;
}

/** The Work's permanent address: its @id in the stored record when that is a mooon.site one. */
export function workUri(work: { id: string; document?: any }): string {
  const graph = Array.isArray(work.document?.['@graph']) ? work.document['@graph'] : [];
  const node = graph.find((n: any) => [].concat(n?.['@type'] ?? []).some((t: any) => String(t).endsWith('Work'))
    && String(n?.['@id'] || '').startsWith(`${RESOURCE_BASE}/work/`));
  return node?.['@id'] || `${RESOURCE_BASE}/work/${encodeURIComponent(work.id)}`;
}

interface PersonLike { name?: string; nameArabic?: string; nameEnglish?: string; viafUri?: string; locUri?: string; uri?: string; role?: string }
interface InstanceLike { title?: string; isbn?: string; publisher?: string; publicationYear?: string; publicationPlace?: string; extent?: string }
export interface WorkLike {
  id: string;
  title: string;
  subtitle?: string;
  language?: string;
  summaryArabic?: string;
  summaryEnglish?: string;
  originDate?: string;
  coverUrl?: string;
  genreForm?: string[];
  primaryCreator?: PersonLike;
  contributors?: PersonLike[];
  subjects?: Array<{ label?: string; labelEnglish?: string; uri?: string }>;
  instances?: InstanceLike[];
  publisher?: { name?: string };
  extent?: string;
  document?: any;
}

const UNKNOWN = /^(unknown|anonymous|غير معروف|مؤلف غير معروف|مجهول)$/i;

function person(p: PersonLike | undefined): any | undefined {
  const name = (p?.nameArabic || p?.name || p?.nameEnglish || '').trim();
  if (!name || UNKNOWN.test(name)) return undefined;
  const sameAs = [p?.viafUri, p?.locUri].filter((u): u is string => !!u && /^https?:\/\//.test(u));
  return {
    '@type': 'Person',
    name,
    ...(p?.nameEnglish && p.nameEnglish !== name ? { alternateName: p.nameEnglish } : {}),
    ...(sameAs.length ? { sameAs } : {}),
  };
}

function edition(i: InstanceLike): any {
  const pages = pageCount(i.extent);
  const y = year(i.publicationYear);
  return {
    '@type': 'Book',
    ...(i.title ? { name: i.title } : {}),
    ...(i.isbn ? { isbn: i.isbn } : {}),
    ...(i.publisher ? { publisher: { '@type': 'Organization', name: i.publisher } } : {}),
    ...(y ? { datePublished: y } : {}),
    ...(pages ? { numberOfPages: pages } : {}),
  };
}

/** The schema.org Book for a record page. Empty values are left out. */
export function bookJsonLd(work: WorkLike): Record<string, any> {
  const inst = work.instances?.[0];
  const authors = [person(work.primaryCreator)].filter(Boolean);
  const others = (work.contributors || [])
    .filter((c) => c !== work.primaryCreator && (c.nameArabic || c.name) !== (work.primaryCreator?.nameArabic || work.primaryCreator?.name))
    .map(person).filter(Boolean);
  const subjects = (work.subjects || []).map((s) => (s.label || s.labelEnglish || '').trim()).filter(Boolean);
  const description = (work.summaryArabic || work.summaryEnglish || '').trim();
  const lang = languageTag(work.language);
  const publisher = inst?.publisher || work.publisher?.name;
  const date = year(inst?.publicationYear) || year(work.originDate);
  const pages = pageCount(inst?.extent || work.extent);
  const url = pageUrl(work.id);
  const isbns = [...new Set((work.instances || []).map((i) => i.isbn).filter((x): x is string => !!x))];
  return {
    '@context': 'https://schema.org',
    '@type': 'Book',
    '@id': workUri(work),
    url,
    mainEntityOfPage: url,
    name: work.title,
    ...(work.subtitle ? { alternativeHeadline: work.subtitle } : {}),
    ...(authors.length ? { author: authors.length === 1 ? authors[0] : authors } : {}),
    ...(others.length ? { contributor: others } : {}),
    ...(lang ? { inLanguage: lang } : {}),
    ...(subjects.length ? { about: subjects.map((name) => ({ '@type': 'Thing', name })) } : {}),
    ...(work.genreForm?.length ? { genre: work.genreForm } : {}),
    ...(description ? { description: description.slice(0, 5000) } : {}),
    ...(work.coverUrl ? { image: work.coverUrl } : {}),
    ...(isbns.length === 1 ? { isbn: isbns[0] } : {}),
    ...(publisher ? { publisher: { '@type': 'Organization', name: publisher } } : {}),
    ...(date ? { datePublished: date } : {}),
    ...(pages ? { numberOfPages: pages } : {}),
    ...((work.instances?.length || 0) > 1 ? { workExample: work.instances!.map(edition) } : {}),
  };
}

/** A one-line description of the book for search results: its summary, or title, author, publisher and year. */
export function metaDescription(work: WorkLike): string {
  const summary = (work.summaryArabic || work.summaryEnglish || '').replace(/\s+/g, ' ').trim();
  if (summary) return summary.length > 160 ? `${summary.slice(0, 157)}…` : summary;
  const inst = work.instances?.[0];
  const who = person(work.primaryCreator)?.name;
  return [work.title, who, inst?.publisher || work.publisher?.name, year(inst?.publicationYear) || year(work.originDate)]
    .filter(Boolean).join('، ') + ' — في فهرس مون.';
}
