/**
 * Copy from outside (Phase 10, step 3): turns a person, body, place, subject or genre at LC (id.loc.gov),
 * Wikidata or VIAF into a Moon entity draft, so nothing is typed twice and the link back is kept (sameAs).
 *
 * LC and Wikidata describe each other: an LC name record links its Wikidata item and a Wikidata item carries
 * its LC number (P244). A copy reads both when it can: LC gives the authorized form and LC's variants as LC
 * writes them; Wikidata gives the Arabic and English names, occupations and the other identifiers (VIAF,
 * ISNI, FAST, ORCID). VIAF is read through the Wikidata item that carries its number (P214), since VIAF's own
 * record service no longer answers.
 */
import type { AgentType, EntityKind, EntityForm } from '../app/utils/entityForm';

export type OutsideSource = 'lc' | 'wikidata' | 'viaf';
export interface OutsideRef { source: OutsideSource; id: string; uri: string }

export interface EntityDraft {
  kind: EntityKind;
  agentType: AgentType;
  label: string;
  variants: string[];
  sameAs: string[];
  note: string;
  details: Record<string, string>;
  /** Extra data kept on the entity beyond the form's fields (coordinates, LC broader terms …). */
  data: Record<string, unknown>;
  /** Where each part came from, for the cataloguer to see before saving. */
  sources: OutsideSource[];
}

type FetchJson = (url: string) => Promise<any>;

const MADS = 'http://www.loc.gov/mads/rdf/v1#';
const RDF_TYPE = '@type';

/** The outside links Moon's server keeps on an entity (others, such as GeoNames, it refuses). */
export const SAME_AS_HOSTS = /^https?:\/\/(id\.loc\.gov\/(authorities|rwo)\/|viaf\.org\/viaf\/|(www\.)?wikidata\.org\/(wiki|entity)\/Q\d+$|id\.worldcat\.org\/fast\/|isni\.org\/isni\/|orcid\.org\/)/;

/** Which outside record a pasted or picked link names, in its canonical form; null when it is none of them. */
export function outsideRef(link: string): OutsideRef | null {
  const s = (link || '').trim();
  const wd = s.match(/wikidata\.org\/(?:wiki|entity)\/(Q\d+)/i);
  if (wd) return { source: 'wikidata', id: wd[1].toUpperCase(), uri: `http://www.wikidata.org/entity/${wd[1].toUpperCase()}` };
  const lc = s.match(/id\.loc\.gov\/authorities\/(names|subjects|genreForms|childrensSubjects|demographicTerms)\/([a-z]{1,3}\d+)/i);
  if (lc) return { source: 'lc', id: lc[2], uri: `http://id.loc.gov/authorities/${lc[1]}/${lc[2]}` };
  const viaf = s.match(/viaf\.org\/(?:en\/)?viaf\/(\d+)/i);
  if (viaf) return { source: 'viaf', id: viaf[1], uri: `http://viaf.org/viaf/${viaf[1]}` };
  return null;
}

const uniq = (xs: string[]) => [...new Set(xs.map((x) => x.trim()).filter(Boolean))];
const keepLinks = (xs: string[]) => uniq(xs).filter((u) => SAME_AS_HOSTS.test(u)).slice(0, 20);

// ---------------------------------------------------------------------------------------------------------
// LC (MADS/RDF from id.loc.gov/authorities/…/<id>.json)
// ---------------------------------------------------------------------------------------------------------

const LC_TYPES: Record<string, { kind: EntityKind; agentType?: AgentType }> = {
  PersonalName: { kind: 'agent', agentType: 'person' },
  FamilyName: { kind: 'agent', agentType: 'family' },
  CorporateName: { kind: 'agent', agentType: 'organization' },
  ConferenceName: { kind: 'agent', agentType: 'meeting' },
  Geographic: { kind: 'place' },
  Topic: { kind: 'topic' },
  ComplexSubject: { kind: 'topic' },
  GenreForm: { kind: 'genre' },
  Temporal: { kind: 'period' },
  NameTitle: { kind: 'hub' },
  Title: { kind: 'hub' },
};

/** The draft from LC's record for `uri` (the expanded JSON-LD id.loc.gov serves at <uri>.json). */
export function draftFromLc(json: any[], uri: string): EntityDraft {
  const nodes: Record<string, any> = Object.fromEntries((Array.isArray(json) ? json : []).map((n) => [n['@id'], n]));
  const me = nodes[uri] || nodes[uri.replace(/^http:/, 'https:')];
  if (!me) throw new Error('LC sent no record for this address');
  const types: string[] = (me[RDF_TYPE] || []).map((t: string) => t.split('#').pop() as string);
  const mapped = types.map((t) => LC_TYPES[t]).find(Boolean) || { kind: 'topic' as EntityKind };
  const vals = (n: any, p: string): any[] => (n?.[MADS + p] || []);
  const ids = (n: any, p: string): string[] => vals(n, p).map((v) => v['@id']).filter((x: unknown): x is string => typeof x === 'string');

  // The authorized form: the untagged (or Latin) label; labels in other scripts become other forms, as LC
  // gives Arabic-script forms of Arabic names and places.
  const labels = vals(me, 'authoritativeLabel');
  const main = labels.find((l: any) => !l['@language'] || /-latn$|^en$/i.test(l['@language'])) || labels[0];
  const label = String(main?.['@value'] || '').trim();
  const variants = uniq([
    ...labels.filter((l: any) => l !== main).map((l: any) => l['@value']),
    ...ids(me, 'hasVariant').flatMap((v) => vals(nodes[v], 'variantLabel').map((l: any) => l['@value'])),
  ]).filter((v) => v !== label);

  // The real-world thing (RWO) carries dates; the record links VIAF, ISNI, FAST and Wikidata.
  const rwo = ids(me, 'identifiesRWO').map((id) => nodes[id]).find((n) => n && (n[MADS + 'birthDate'] || n[MADS + 'deathDate']));
  const date = (p: string) => String(vals(rwo, p)[0]?.['@value'] || '').trim();
  const sameAs = keepLinks([
    uri,
    ...ids(me, 'identifiesRWO').filter((u) => /viaf\.org\/viaf\/\d+$|isni\.org\/isni\/|orcid\.org\/|wikidata\.org\/entity\//.test(u)),
    ...ids(me, 'hasCloseExternalAuthority'),
    ...ids(me, 'hasExactExternalAuthority').filter((u) => /viaf\.org\/viaf\/\d+$/.test(u)),
  ]);

  const details: Record<string, string> = {};
  const data: Record<string, unknown> = {};
  if (mapped.kind === 'agent' && mapped.agentType === 'person') {
    if (date('birthDate')) details.birthDate = date('birthDate');
    if (date('deathDate')) details.deathDate = date('deathDate');
  }
  if (mapped.kind === 'topic') {
    details.source = 'http://id.loc.gov/authorities/subjects';
    const broader = ids(me, 'hasBroaderAuthority');
    if (broader.length) details.broader = broader.join('\n');
  }
  if (mapped.kind === 'genre') details.source = 'http://id.loc.gov/authorities/genreForms';

  return {
    kind: mapped.kind, agentType: mapped.agentType || 'person', label, variants: variants.slice(0, 50), sameAs,
    note: '', details, data, sources: ['lc'],
  };
}

// ---------------------------------------------------------------------------------------------------------
// Wikidata (wbgetentities with labels, aliases, descriptions and claims, Arabic and English)
// ---------------------------------------------------------------------------------------------------------

const ORGANIZATION = new Set(['Q43229', 'Q4830453', 'Q2085381', 'Q7075', 'Q3918', 'Q163740', 'Q31855', 'Q327333', 'Q1664720', 'Q875538', 'Q15265344', 'Q41487', 'Q1320047', 'Q210167', 'Q1371037', 'Q149566']);
const FAMILY = new Set(['Q8436', 'Q13417114', 'Q164950']);
const MEETING = new Set(['Q2020153', 'Q1656682', 'Q625994', 'Q2761147']);
const GENRE = new Set(['Q483394', 'Q223393', 'Q1792379']);
const PERIOD = new Set(['Q11514315', 'Q6428674', 'Q3024240']);
const WORK = new Set(['Q7725634', 'Q47461344', 'Q571', 'Q732577']);

const claimValues = (e: any, p: string): any[] => (e?.claims?.[p] || []).map((c: any) => c?.mainsnak?.datavalue?.value).filter((v: unknown) => v != null);
const claimIds = (e: any, p: string): string[] => claimValues(e, p).map((v) => v?.id).filter(Boolean);
const claimStrings = (e: any, p: string): string[] => claimValues(e, p).filter((v) => typeof v === 'string');
/** "+1332-05-27T00:00:00Z" → "1332-05-27" (a year alone when the date is only that precise). */
const wikidataDate = (v: any): string => {
  const m = String(v?.time || '').match(/^([+-])(\d{1,4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  const year = `${m[1] === '-' ? '-' : ''}${m[2].padStart(4, '0')}`;
  return v.precision >= 11 && m[3] !== '00' && m[4] !== '00' ? `${year}-${m[3]}-${m[4]}` : year;
};

/** The draft from a Wikidata item; `occupationLabels` names the occupation items (P106) when they were fetched. */
export function draftFromWikidata(json: any, qid: string, occupationLabels: Record<string, string> = {}, lang: 'ar' | 'en' = 'en'): EntityDraft {
  const e = json?.entities?.[qid];
  if (!e || e.missing !== undefined) throw new Error('Wikidata has no item with this number');
  const is = new Set(claimIds(e, 'P31'));
  const lcNumber = claimStrings(e, 'P244')[0] || '';
  const any = (set: Set<string>) => [...is].some((q) => set.has(q));

  let kind: EntityKind = 'topic';
  let agentType: AgentType = 'person';
  if (is.has('Q5')) kind = 'agent';
  else if (any(FAMILY)) { kind = 'agent'; agentType = 'family'; }
  else if (any(MEETING)) { kind = 'agent'; agentType = 'meeting'; }
  else if (any(ORGANIZATION)) { kind = 'agent'; agentType = 'organization'; }
  else if (claimValues(e, 'P625').length) kind = 'place';
  else if (any(WORK)) kind = 'hub';
  else if (any(GENRE) || /^gf/.test(lcNumber)) kind = 'genre';
  else if (any(PERIOD)) kind = 'period';

  const name = (l: string) => String(e.labels?.[l]?.value || '').trim();
  // The romanized (English) name leads, as in LC; the Arabic name and every alias become other forms.
  const label = name('en') || name('ar');
  const variants = uniq([name('ar'), name('en'), ...['ar', 'en'].flatMap((l) => (e.aliases?.[l] || []).map((a: any) => a.value))])
    .filter((v) => v !== label);

  const lcPath = /^sh/.test(lcNumber) ? 'subjects' : /^gf/.test(lcNumber) ? 'genreForms' : 'names';
  const sameAs = keepLinks([
    `http://www.wikidata.org/entity/${qid}`,
    ...(lcNumber ? [`http://id.loc.gov/authorities/${lcPath}/${lcNumber}`] : []),
    // VIAF numbers are digits; Wikidata also lists withdrawn long ones, which VIAF no longer serves.
    ...claimStrings(e, 'P214').filter((n) => /^\d{1,12}$/.test(n)).map((n) => `http://viaf.org/viaf/${n}`),
    ...claimStrings(e, 'P213').map((n) => `https://isni.org/isni/${n.replace(/\s+/g, '')}`),
    ...claimStrings(e, 'P496').map((n) => `https://orcid.org/${n}`),
    ...claimStrings(e, 'P2163').map((n) => `http://id.worldcat.org/fast/${n}`),
  ]);

  const details: Record<string, string> = {};
  const data: Record<string, unknown> = {};
  if (kind === 'agent' && agentType === 'person') {
    const born = wikidataDate(claimValues(e, 'P569')[0]);
    const died = wikidataDate(claimValues(e, 'P570')[0]);
    if (born) details.birthDate = born;
    if (died) details.deathDate = died;
    const jobs = claimIds(e, 'P106').map((q) => occupationLabels[q]).filter(Boolean);
    if (jobs.length) details.occupation = uniq(jobs).slice(0, 5).join('; ');
  }
  if (kind === 'place') {
    const c = claimValues(e, 'P625')[0];
    if (c && typeof c.latitude === 'number') data.coordinates = `${+c.latitude.toFixed(5)}, ${+c.longitude.toFixed(5)}`;
  }
  if (kind === 'topic' && lcPath === 'subjects' && lcNumber) details.source = 'http://id.loc.gov/authorities/subjects';
  if (kind === 'genre' && lcPath === 'genreForms' && lcNumber) details.source = 'http://id.loc.gov/authorities/genreForms';

  const note = String(e.descriptions?.[lang]?.value || e.descriptions?.[lang === 'ar' ? 'en' : 'ar']?.value || '').trim();
  return { kind, agentType, label, variants: variants.slice(0, 50), sameAs, note, details, data, sources: ['wikidata'] };
}

// ---------------------------------------------------------------------------------------------------------
// Both together
// ---------------------------------------------------------------------------------------------------------

/** LC's draft and Wikidata's draft of one thing as one: LC's authorized form and its kind, every name form
 *  of both, all links, LC's dates first, Wikidata's occupation, coordinates and description. */
export function combineDrafts(lc: EntityDraft | null, wd: EntityDraft | null): EntityDraft {
  if (!lc && !wd) throw new Error('Nothing to copy');
  if (!lc) return wd!;
  if (!wd) return lc;
  const label = lc.label || wd.label;
  return {
    kind: lc.kind,
    agentType: lc.agentType,
    label,
    variants: uniq([...lc.variants, wd.label, ...wd.variants]).filter((v) => v !== label).slice(0, 50),
    sameAs: keepLinks([...lc.sameAs, ...wd.sameAs]),
    note: wd.note || lc.note,
    details: { ...wd.details, ...lc.details, ...(wd.details.occupation ? { occupation: wd.details.occupation } : {}) },
    data: { ...wd.data, ...lc.data },
    sources: ['lc', 'wikidata'],
  };
}

const wikidataApi = (params: Record<string, string>) =>
  `https://www.wikidata.org/w/api.php?${new URLSearchParams({ format: 'json', origin: '*', ...params })}`;

async function readWikidata(qid: string, fetchJson: FetchJson, lang: 'ar' | 'en'): Promise<EntityDraft> {
  const json = await fetchJson(wikidataApi({ action: 'wbgetentities', ids: qid, props: 'labels|aliases|descriptions|claims', languages: 'ar|en' }));
  const jobs = claimIds(json?.entities?.[qid], 'P106').slice(0, 8);
  const labels: Record<string, string> = {};
  if (jobs.length) {
    const j = await fetchJson(wikidataApi({ action: 'wbgetentities', ids: jobs.join('|'), props: 'labels', languages: lang === 'ar' ? 'ar|en' : 'en|ar' })).catch(() => null);
    for (const q of jobs) {
      const l = j?.entities?.[q]?.labels;
      const v = l?.[lang]?.value || l?.en?.value || l?.ar?.value;
      if (v) labels[q] = v;
    }
  }
  return draftFromWikidata(json, qid, labels, lang);
}

async function readLc(uri: string, fetchJson: FetchJson): Promise<EntityDraft> {
  return draftFromLc(await fetchJson(`${uri.replace(/^http:/, 'https:')}.json`), uri);
}

/** The Wikidata item that carries a VIAF number (P214), found with Wikidata's statement search. */
async function wikidataForViaf(viafId: string, fetchJson: FetchJson): Promise<string | null> {
  const j = await fetchJson(wikidataApi({ action: 'query', list: 'search', srsearch: `haswbstatement:P214=${viafId}`, srlimit: '1' }));
  return j?.query?.search?.[0]?.title || null;
}

/**
 * Everything LC and Wikidata say about the thing at `link` (an LC, Wikidata or VIAF address), as one draft.
 * The second source is optional: when it cannot be read the first one's draft is returned alone.
 * `fallbackLabel` names a VIAF record that no Wikidata item carries, so it can still be copied as a link.
 */
export async function fetchOutsideEntity(
  link: string,
  options: { fetchJson?: FetchJson; lang?: 'ar' | 'en'; fallbackLabel?: string } = {},
): Promise<EntityDraft> {
  const ref = outsideRef(link);
  if (!ref) throw new Error('Not an LC, Wikidata or VIAF address');
  const lang = options.lang || 'en';
  const fetchJson: FetchJson = options.fetchJson || (async (url) => {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`${new URL(url).hostname} answered ${res.status}`);
    return res.json();
  });

  if (ref.source === 'lc') {
    const lc = await readLc(ref.uri, fetchJson);
    const qid = lc.sameAs.map((u) => outsideRef(u)).find((r) => r?.source === 'wikidata')?.id;
    const wd = qid ? await readWikidata(qid, fetchJson, lang).catch(() => null) : null;
    return combineDrafts(lc, wd);
  }

  let qid = ref.source === 'wikidata' ? ref.id : await wikidataForViaf(ref.id, fetchJson).catch(() => null);
  if (!qid) {
    if (!options.fallbackLabel?.trim()) throw new Error('No LC or Wikidata record links this VIAF number');
    return {
      kind: 'agent', agentType: 'person', label: options.fallbackLabel.trim(), variants: [], sameAs: [ref.uri],
      note: '', details: {}, data: {}, sources: ['viaf'],
    };
  }
  const wd = await readWikidata(qid, fetchJson, lang);
  if (ref.source === 'viaf' && !wd.sameAs.includes(ref.uri)) wd.sameAs = keepLinks([...wd.sameAs, ref.uri]);
  const lcUri = wd.sameAs.find((u) => outsideRef(u)?.source === 'lc');
  const lc = lcUri ? await readLc(lcUri, fetchJson).catch(() => null) : null;
  const both = combineDrafts(lc, wd);
  if (ref.source === 'viaf') both.sources = [...new Set<OutsideSource>([...both.sources, 'viaf'])];
  return both;
}

// ---------------------------------------------------------------------------------------------------------
// Into Moon's form
// ---------------------------------------------------------------------------------------------------------

/** A draft as the Entities form, ready to review and save. */
export function formFromDraft(d: EntityDraft): EntityForm {
  return {
    kind: d.kind, agentType: d.agentType, label: d.label, variants: d.variants.join('\n'),
    sameAs: d.sameAs.join('\n'), note: d.note, details: { ...d.details },
  };
}

/**
 * An entity Moon already has, with what the draft adds: name forms and links it lacks, and details it has
 * left empty. Nothing the cataloguer entered is overwritten; the entity's own name stays.
 */
export function mergeDraftIntoForm(form: EntityForm, d: EntityDraft): EntityForm {
  const lines = (s: string) => s.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  const details = { ...form.details };
  for (const [k, v] of Object.entries(d.details)) if (!(details[k] || '').trim()) details[k] = v;
  return {
    ...form,
    variants: uniq([...lines(form.variants), ...(d.label !== form.label ? [d.label] : []), ...d.variants]).filter((v) => v !== form.label).join('\n'),
    sameAs: keepLinks([...lines(form.sameAs), ...d.sameAs]).join('\n'),
    note: form.note.trim() ? form.note : d.note,
    details,
  };
}
